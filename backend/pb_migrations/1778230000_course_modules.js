/// <reference path="../pb_data/types.d.ts" />
//
// course_modules — ordered learning units within a course. Each module
// owns a checklist (json array of {id, title, done}) and a description.
// The user-attributed `user` field plus the canonical create-rule pattern
// keeps it consistent with the rest of the schema.
migrate((app) => {
  const modules = new Collection({
    "id": "pbc_course_modules",
    "name": "course_modules",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_cm_user ON course_modules (user)",
      "CREATE INDEX idx_cm_course ON course_modules (course)",
      "CREATE INDEX idx_cm_order ON course_modules (course, sort_index)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_cm_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "pbc_courses", "hidden": false, "id": "f_cm_course", "maxSelect": 1, "minSelect": 0, "name": "course", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_cm_title", "max": 256, "min": 0, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_cm_desc", "max": 4000, "min": 0, "name": "description", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_cm_sort", "name": "sort_index", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_cm_check", "maxSize": 100000, "name": "checklist", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_cm_done", "name": "done", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "id": "autodate_created_cm", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_cm", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(modules);
}, (app) => {
  const col = app.findCollectionByNameOrId("course_modules");
  if (col) app.delete(col);
});
