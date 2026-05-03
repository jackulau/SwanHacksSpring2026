/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const assignments = new Collection({
    "id": "pbc_assignments",
    "name": "assignments",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_courses", "hidden": false, "id": "f_course", "maxSelect": 1, "minSelect": 0, "name": "course", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "hidden": false, "id": "f_canvas_id", "max": null, "min": 0, "name": "canvas_id", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_title", "max": 0, "min": 1, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_description", "max": 0, "min": 0, "name": "description", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_due_at", "max": "", "min": "", "name": "due_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_points", "max": null, "min": 0, "name": "points_possible", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_status", "max": 0, "min": 0, "name": "status", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_canvas_url", "max": 0, "min": 0, "name": "canvas_url", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_sub_types", "maxSize": 5000, "name": "submission_types", "presentable": false, "required": false, "system": false, "type": "json" }
    ]
  });
  app.save(assignments);
}, (app) => {
  const col = app.findCollectionByNameOrId("assignments");
  app.delete(col);
});
