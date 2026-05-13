/// <reference path="../pb_data/types.d.ts" />
//
// note_versions — point-in-time snapshots of a note_pages document.
//
// Each row captures the prior `blocks` (and `title`) of a page just
// before the autosave that materially changed it. The frontend writes
// these from the editor's persist() flow — capped to at most one
// snapshot per minute to avoid keystroke-driven churn — and renders a
// History panel that lets the user revert to any prior version.
//
// Cascade is owned by the page: when a page is hard-deleted the entire
// version trail goes with it. Standard user-scoped pattern: createRule
// pins user against @request.body.user (matches the convention used by
// note_pages, note_comments, note_links, etc.). No update path — a
// snapshot is immutable; restoration just creates a new version row
// for the new state.
migrate((app) => {
  const versions = new Collection({
    "id": "pbc_note_versions",
    "name": "note_versions",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": null,
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_note_versions_page ON note_versions (page)",
      "CREATE INDEX idx_note_versions_user_page ON note_versions (user, page)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_nv_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_note_pages", "hidden": false, "id": "f_nv_page", "maxSelect": 1, "minSelect": 0, "name": "page", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "hidden": false, "id": "f_nv_blocks", "maxSize": 2000000, "name": "blocks", "presentable": false, "required": false, "system": false, "type": "json" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_nv_title", "max": 256, "min": 0, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "id": "autodate_created_note_versions", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false }
    ]
  });
  app.save(versions);
}, (app) => {
  const col = app.findCollectionByNameOrId("note_versions");
  if (col) app.delete(col);
});
