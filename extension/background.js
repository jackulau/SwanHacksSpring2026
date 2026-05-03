const DEFAULT_PB_URL = "http://127.0.0.1:8090";

async function getPbUrl() {
  const { pbUrl } = await chrome.storage.local.get("pbUrl");
  return pbUrl || DEFAULT_PB_URL;
}

async function getAuth() {
  const { authToken, authUserId } = await chrome.storage.local.get([
    "authToken",
    "authUserId",
  ]);
  if (!authToken || !authUserId) return null;
  return { token: authToken, userId: authUserId };
}

async function pbRequest(method, path, body) {
  const pbUrl = await getPbUrl();
  const auth = await getAuth();
  const headers = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = auth.token;

  const res = await fetch(`${pbUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PocketBase ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function pbGetAll(collection, filter) {
  const items = [];
  let page = 1;
  while (true) {
    const encoded = encodeURIComponent(filter);
    const res = await pbRequest(
      "GET",
      `/api/collections/${collection}/records?filter=${encoded}&perPage=200&page=${page}`
    );
    items.push(...(res.items || []));
    if (page >= res.totalPages) break;
    page++;
  }
  return items;
}

async function login(email, password) {
  const pbUrl = await getPbUrl();
  const res = await fetch(
    `${pbUrl}/api/collections/users/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: email, password }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Login failed (${res.status})`);
  }

  const data = await res.json();
  await chrome.storage.local.set({
    authToken: data.token,
    authUserId: data.record.id,
    authEmail: data.record.email,
    authName: data.record.name || data.record.email,
  });
  return data.record;
}

async function logout() {
  await chrome.storage.local.remove([
    "authToken",
    "authUserId",
    "authEmail",
    "authName",
  ]);
}

function getAssignmentStatus(ca) {
  if (ca.has_submitted_submissions) return "submitted";
  if (ca.due_at && new Date(ca.due_at) < new Date()) return "missing";
  return "upcoming";
}

async function syncCanvasData(payload, onProgress) {
  const auth = await getAuth();
  if (!auth) throw new Error("Not logged in to Converge");

  const { userId } = auth;
  const totalSteps = payload.courses.length + payload.assignments.length;
  let completed = 0;

  function report(text) {
    const pct = Math.round(30 + (completed / Math.max(totalSteps, 1)) * 65);
    if (onProgress) onProgress(pct, text);
  }

  // Sync courses
  const existingCourses = await pbGetAll("courses", `user = "${userId}"`);
  const colors = ["#2f5d4f", "#e07a5f", "#3d8b7a", "#d4a373", "#c1666b", "#5b8e7d", "#4a7c6f"];
  const courseMap = new Map();
  let colorIdx = 0;

  for (let i = 0; i < payload.courses.length; i++) {
    const cc = payload.courses[i];
    report(`Syncing course ${i + 1}/${payload.courses.length}: ${cc.name}`);

    const existing = existingCourses.find(
      (c) => c.code === cc.course_code && c.name === cc.name
    );
    if (existing) {
      courseMap.set(cc.id, existing.id);
    } else {
      const created = await pbRequest(
        "POST",
        "/api/collections/courses/records",
        {
          user: userId,
          name: cc.name,
          code: cc.course_code,
          color: colors[colorIdx % colors.length],
          semester: "",
        }
      );
      courseMap.set(cc.id, created.id);
      colorIdx++;
    }
    completed++;
  }

  // Sync assignments
  const existingAssignments = await pbGetAll("assignments", `user = "${userId}"`);
  const existingByCanvasId = new Map(
    existingAssignments.map((a) => [a.canvas_id, a])
  );

  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < payload.assignments.length; i++) {
    const ca = payload.assignments[i];
    const courseId = courseMap.get(ca.course_id);
    if (!courseId) { completed++; continue; }

    report(`Syncing assignment ${i + 1}/${payload.assignments.length}: ${ca.name}`);

    const status = getAssignmentStatus(ca);
    const data = {
      user: userId,
      course: courseId,
      canvas_id: ca.id,
      title: ca.name,
      description: ca.description || "",
      due_at: ca.due_at || null,
      points_possible: ca.points_possible || 0,
      status,
      canvas_url: ca.html_url || "",
      submission_types: JSON.stringify(ca.submission_types || []),
    };

    const existing = existingByCanvasId.get(ca.id);
    if (existing) {
      await pbRequest(
        "PATCH",
        `/api/collections/assignments/records/${existing.id}`,
        data
      );
      updatedCount++;
    } else {
      await pbRequest("POST", "/api/collections/assignments/records", data);
      createdCount++;
    }
    completed++;
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({
    lastSync: now,
    lastSyncCourses: payload.courses.length,
    lastSyncAssignments: payload.assignments.length,
  });

  return { created: createdCount, updated: updatedCount, courses: payload.courses.length };
}

// Port-based sync with progress (used by popup)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sync-progress") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "SYNC_CANVAS") {
      try {
        const result = await syncCanvasData(msg.payload, (pct, text) => {
          port.postMessage({ type: "PROGRESS", pct, text });
        });
        port.postMessage({ type: "DONE", result });
      } catch (e) {
        port.postMessage({ type: "ERROR", error: e.message });
      }
    }
  });
});

// Simple message-based handlers (used by content script floating button)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "LOGIN") {
    login(msg.email, msg.password)
      .then((user) => sendResponse({ ok: true, user }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "LOGOUT") {
    logout().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "GET_AUTH") {
    chrome.storage.local
      .get(["authToken", "authUserId", "authEmail", "authName"])
      .then((data) => {
        if (data.authToken && data.authUserId) {
          sendResponse({
            ok: true,
            user: {
              id: data.authUserId,
              email: data.authEmail,
              name: data.authName,
            },
          });
        } else {
          sendResponse({ ok: false });
        }
      });
    return true;
  }

  if (msg.type === "SYNC_CANVAS") {
    syncCanvasData(msg.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "GET_SYNC_STATUS") {
    chrome.storage.local
      .get(["lastSync", "lastSyncCourses", "lastSyncAssignments"])
      .then((data) => sendResponse({ ok: true, ...data }));
    return true;
  }

  if (msg.type === "SET_PB_URL") {
    chrome.storage.local
      .set({ pbUrl: msg.url })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});
