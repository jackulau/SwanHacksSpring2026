/// <reference path="../pb_data/types.d.ts" />
//
// Add flexible profile badges to users.
//
// Shape:
//   [
//     {
//       "label": "Administrator",
//       "backgroundColor": "#42a36e",
//       "textColor": "#ffffff",
//       "borderColor": "#2f8d5a"
//     }
//   ]
//
// The field is JSON so integrations can attach role, cohort, or account-state
// badges without a migration for each new label/color pair.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users) {
    console.log("[user_badges] users collection not found, skipping");
    return;
  }

  const hasBadges = Boolean(users.fields.find((f) => f.name === "badges"));
  if (!hasBadges) {
    users.fields.push(new Field({
      id: "f_users_badges",
      name: "badges",
      type: "json",
      hidden: false,
      maxSize: 10000,
      presentable: false,
      required: false,
      system: false,
    }));
  }

  app.save(users);
}, (app) => {
  try {
    const users = app.findCollectionByNameOrId("users");
    if (!users) return;
    users.fields = users.fields.filter((f) => f.name !== "badges");
    app.save(users);
  } catch (e) {
    // ignore
  }
});
