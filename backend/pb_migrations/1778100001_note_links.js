/// <reference path="../pb_data/types.d.ts" />
//
// note_links — directed page-to-page references for backlinks panel.
//
// Whenever a page contains an @-mention or a "link to page" inline ref,
// the frontend writes one row per (source_page, target_page) on save.
// Backlinks panel queries by target_page and groups by source_page.
//
// Rules: standard user-scoped pattern.
migrate((app) => {
  const links = new Collection({
    "id": "pbc_note_links",
    "name": "note_links",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_note_links_source ON note_links (source_page)",
      "CREATE INDEX idx_note_links_target ON note_links (target_page)",
      "CREATE UNIQUE INDEX uniq_note_links_pair ON note_links (source_page, target_page)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_nl_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_note_pages", "hidden": false, "id": "f_nl_source", "maxSelect": 1, "minSelect": 0, "name": "source_page", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_note_pages", "hidden": false, "id": "f_nl_target", "maxSelect": 1, "minSelect": 0, "name": "target_page", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "id": "autodate_created_note_links", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false }
    ]
  });
  app.save(links);
}, (app) => {
  const col = app.findCollectionByNameOrId("note_links");
  if (col) app.delete(col);
});
