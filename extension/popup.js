const loginView = document.getElementById("login-view");
const connectedView = document.getElementById("connected-view");
const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const userAvatar = document.getElementById("user-avatar");
const lastSync = document.getElementById("last-sync");
const pbUrlInput = document.getElementById("pb-url");
const saveUrlBtn = document.getElementById("save-url");
const syncBtn = document.getElementById("sync-btn");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

function showView(view) {
  loginView.classList.toggle("hidden", view !== "login");
  connectedView.classList.toggle("hidden", view !== "connected");
}

function setProgress(pct, text) {
  progressContainer.classList.remove("hidden");
  progressBar.style.width = pct + "%";
  progressText.textContent = text;
}

function hideProgress() {
  progressContainer.classList.add("hidden");
  progressBar.style.width = "0%";
}

async function checkAuth() {
  const res = await chrome.runtime.sendMessage({ type: "GET_AUTH" });
  if (res.ok) {
    showConnected(res.user);
  } else {
    showView("login");
  }
}

function showConnected(user) {
  userName.textContent = user.name || user.email;
  userEmail.textContent = user.email;
  userAvatar.textContent = (user.name || user.email)[0].toUpperCase();
  showView("connected");
  loadSyncStatus();
}

async function loadSyncStatus() {
  const res = await chrome.runtime.sendMessage({ type: "GET_SYNC_STATUS" });
  if (res.ok && res.lastSync) {
    const date = new Date(res.lastSync);
    lastSync.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} — ${res.lastSyncCourses} courses, ${res.lastSyncAssignments} assignments`;
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await chrome.runtime.sendMessage({
    type: "LOGIN",
    email,
    password,
  });

  if (res.ok) {
    showConnected(res.user);
  } else {
    loginError.textContent = res.error || "Login failed";
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";
});

logoutBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "LOGOUT" });
  showView("login");
});

saveUrlBtn.addEventListener("click", async () => {
  const url = pbUrlInput.value.trim();
  if (url) {
    await chrome.runtime.sendMessage({ type: "SET_PB_URL", url });
    saveUrlBtn.textContent = "Saved!";
    setTimeout(() => (saveUrlBtn.textContent = "Save"), 1500);
  }
});

syncBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setProgress(0, "Navigate to your Canvas LMS page first");
    return;
  }

  const isCanvas =
    tab.url.includes("instructure.com") ||
    tab.url.includes("/courses") ||
    tab.url.includes("canvas.");
  if (!isCanvas) {
    setProgress(0, "Navigate to your Canvas LMS page first");
    setTimeout(hideProgress, 3000);
    return;
  }

  syncBtn.disabled = true;
  setProgress(5, "Injecting sync script...");

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
    setProgress(0, "Cannot access this page — check extension permissions");
    syncBtn.disabled = false;
    setTimeout(hideProgress, 3000);
    return;
  }

  setProgress(10, "Fetching Canvas data...");

  try {
    const canvasData = await chrome.tabs.sendMessage(tab.id, { type: "FETCH_CANVAS_DATA" });
    if (!canvasData.ok) {
      setProgress(0, canvasData.error || "Failed to fetch Canvas data");
      syncBtn.disabled = false;
      setTimeout(hideProgress, 3000);
      return;
    }

    const payload = canvasData.data;
    setProgress(30, `Found ${payload.courses.length} courses, ${payload.assignments.length} assignments`);

    const port = chrome.runtime.connect({ name: "sync-progress" });

    port.onMessage.addListener((msg) => {
      if (msg.type === "PROGRESS") {
        setProgress(msg.pct, msg.text);
      }
      if (msg.type === "DONE") {
        setProgress(100, `Synced! ${msg.result.created} new, ${msg.result.updated} updated`);
        loadSyncStatus();
        syncBtn.disabled = false;
        setTimeout(hideProgress, 4000);
        port.disconnect();
      }
      if (msg.type === "ERROR") {
        setProgress(0, msg.error);
        syncBtn.disabled = false;
        setTimeout(hideProgress, 4000);
        port.disconnect();
      }
    });

    port.postMessage({ type: "SYNC_CANVAS", payload });
  } catch (e) {
    setProgress(0, e.message || "Sync failed");
    syncBtn.disabled = false;
    setTimeout(hideProgress, 3000);
  }
});

chrome.storage.local.get("pbUrl").then(({ pbUrl }) => {
  if (pbUrl) pbUrlInput.value = pbUrl;
});

checkAuth();
