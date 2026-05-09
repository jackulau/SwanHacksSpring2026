(() => {
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

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "FETCH_CANVAS_DATA") {
      fetchCanvasData()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
