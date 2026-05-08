/// <reference path="../pb_data/types.d.ts" />
//
// note_comments — threaded comments hung off note_pages.
//
// v1 is single-user friendly (the page owner reads/writes their own
// comments) but the schema is multi-user ready: `user` is a relation to
// users, list/view rules permit either the page owner or the comment
// author, and the parent column is a free-form text id so we can later
// fan threads out without a migration. Threading is one level deep in
// the v1 UI (root + replies). Resolved is a boolean toggle on the root.
//
// Standard user-scoped pattern with a slightly broader read rule:
//   listRule: page owner OR comment author
//   createRule: pin author to the auth id
//   updateRule: only the comment author
//   deleteRule: comment author OR page owner (so the owner can clean up)
migrate((app) => {
  const comments = new Collection({
    "id": "pbc_note_comments",
    "name": "note_comments",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = page.user.id || @request.auth.id = user.id",
    "viewRule": "@request.auth.id = page.user.id || @request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id || @request.auth.id = page.user.id",
    "indexes": [
      "CREATE INDEX idx_note_comments_page ON note_comments (page)",
      "CREATE INDEX idx_note_comments_user ON note_comments (user)",
      "CREATE INDEX idx_note_comments_page_parent ON note_comments (page, parent)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_nc_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_note_pages", "hidden": false, "id": "f_nc_page", "maxSelect": 1, "minSelect": 0, "name": "page", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_nc_parent", "max": 15, "min": 0, "name": "parent", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_nc_body", "max": 4000, "min": 0, "name": "body", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_nc_resolved", "name": "resolved", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "id": "autodate_created_note_comments", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_note_comments", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(comments);
}, (app) => {
  const col = app.findCollectionByNameOrId("note_comments");
  if (col) app.delete(col);
});
