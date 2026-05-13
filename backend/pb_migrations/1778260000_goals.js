/// <reference path="../pb_data/types.d.ts" />
//
// goals — user-defined learning goals with optional target date and a
// linked source (course / lecture / note_page). Powers the /goals route.

migrate((app) => {
  const goals = new Collection({
    "id": "pbc_goals",
    "name": "goals",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_goals_user ON goals (user)",
      "CREATE INDEX idx_goals_due ON goals (target_date)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_g_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_g_title", "max": 256, "min": 0, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_g_desc", "max": 4000, "min": 0, "name": "description", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_g_target", "name": "target_date", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_g_completed", "name": "completed", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "f_g_completed_at", "name": "completed_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_g_meta", "maxSize": 50000, "name": "meta", "presentable": false, "required": false, "system": false, "type": "json" },
      { "id": "autodate_created_g", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_g", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(goals);
}, (app) => {
  const col = app.findCollectionByNameOrId("goals");
  if (col) app.delete(col);
});
