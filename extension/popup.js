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

function showView(view) {
  loginView.classList.toggle("hidden", view !== "login");
  connectedView.classList.toggle("hidden", view !== "connected");
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

chrome.storage.local.get("pbUrl").then(({ pbUrl }) => {
  if (pbUrl) pbUrlInput.value = pbUrl;
});

checkAuth();
