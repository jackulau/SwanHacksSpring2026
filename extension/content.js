(() => {
  if (document.getElementById("hackstack-sync-btn")) return;

  const btn = document.createElement("button");
  btn.id = "hackstack-sync-btn";
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
    <span>Sync to HackStack</span>
  `;
  document.body.appendChild(btn);

  const toast = document.createElement("div");
  toast.id = "hackstack-toast";
  document.body.appendChild(toast);

  function showToast(message, type) {
    toast.textContent = message;
    toast.className = "hackstack-toast-show hackstack-toast-" + type;
    setTimeout(() => {
      toast.className = "";
    }, 4000);
  }

  function setLoading(loading) {
    btn.classList.toggle("hackstack-loading", loading);
    btn.disabled = loading;
  }

  async function fetchCanvasData() {
    const baseUrl = window.location.origin;

    const profileRes = await fetch("/api/v1/users/self/profile");
    if (!profileRes.ok) throw new Error("Not logged in to Canvas");
    const user = await profileRes.json();

    const coursesRes = await fetch(
      "/api/v1/courses?enrollment_state=active&per_page=50&include[]=term"
    );
    if (!coursesRes.ok) throw new Error("Failed to fetch courses");
    const courses = await coursesRes.json();
    if (!Array.isArray(courses)) throw new Error("Unexpected courses response");

    const assignments = [];
    for (const c of courses) {
      try {
        const res = await fetch(
          `/api/v1/courses/${c.id}/assignments?per_page=100&order_by=due_at&include[]=submission`
        );
        const data = await res.json();
        if (Array.isArray(data)) assignments.push(...data);
      } catch (e) {
        // skip failed course
      }
    }

    return { base_url: baseUrl, user: user.name, courses, assignments };
  }

  btn.addEventListener("click", async () => {
    setLoading(true);

    try {
      const authCheck = await chrome.runtime.sendMessage({ type: "GET_AUTH" });
      if (!authCheck.ok) {
        showToast("Log in to HackStack first (click extension icon)", "error");
        setLoading(false);
        return;
      }

      showToast("Fetching Canvas data...", "info");
      const payload = await fetchCanvasData();

      showToast(
        `Syncing ${payload.courses.length} courses, ${payload.assignments.length} assignments...`,
        "info"
      );
      const result = await chrome.runtime.sendMessage({
        type: "SYNC_CANVAS",
        payload,
      });

      if (result.ok) {
        showToast(
          `Synced! ${result.result.created} new, ${result.result.updated} updated`,
          "success"
        );
      } else {
        showToast(result.error || "Sync failed", "error");
      }
    } catch (e) {
      showToast(e.message || "Sync failed", "error");
    }

    setLoading(false);
  });
})();
