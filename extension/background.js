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
    throw new Error(`PocketBase ${res.status}: ${text}`);
  }
  return res.json();
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

async function syncCanvasData(payload) {
  const auth = await getAuth();
  if (!auth) throw new Error("Not logged in to HackStack");

  const { userId } = auth;

  const existingCourses = await pbRequest(
    "GET",
    `/api/collections/courses/records?filter=user="${userId}"&perPage=200`
  ).then((r) => r.items || []);

  const colors = [
    "#6366f1",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
  ];

  const courseMap = new Map();
  let colorIdx = 0;

  for (const cc of payload.courses) {
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
  }

  const existingAssignments = await pbRequest(
    "GET",
    `/api/collections/assignments/records?filter=user="${userId}"&perPage=500`
  ).then((r) => r.items || []);

  const existingByCanvasId = new Map(
    existingAssignments.map((a) => [a.canvas_id, a])
  );

  let created = 0;
  let updated = 0;

  for (const ca of payload.assignments) {
    const courseId = courseMap.get(ca.course_id);
    if (!courseId) continue;

    const status = getAssignmentStatus(ca);
    const data = {
      user: userId,
      course: courseId,
      canvas_id: ca.id,
      title: ca.name,
      description: ca.description || "",
      due_at: ca.due_at || "",
      points_possible: ca.points_possible || 0,
      status,
      canvas_url: ca.html_url,
      submission_types: JSON.stringify(ca.submission_types),
    };

    const existing = existingByCanvasId.get(ca.id);
    if (existing) {
      await pbRequest(
        "PATCH",
        `/api/collections/assignments/records/${existing.id}`,
        data
      );
      updated++;
    } else {
      await pbRequest("POST", "/api/collections/assignments/records", data);
      created++;
    }
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({
    lastSync: now,
    lastSyncCourses: payload.courses.length,
    lastSyncAssignments: payload.assignments.length,
  });

  return { created, updated, courses: payload.courses.length };
}

function getAssignmentStatus(ca) {
  if (ca.has_submitted_submissions) return "submitted";
  if (ca.due_at && new Date(ca.due_at) < new Date()) return "missing";
  return "upcoming";
}

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
