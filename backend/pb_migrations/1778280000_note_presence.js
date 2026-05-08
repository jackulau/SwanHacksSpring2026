/// <reference path="../pb_data/types.d.ts" />
//
// note_presence — lightweight collaborative-presence rows on note_pages.
//
// Each viewing client upserts a single row keyed by (user, page) every
// few seconds with last_seen=now. Peers subscribe to the collection over
// PB realtime and render small avatars in the page top-bar for any row
// whose last_seen is within a recent window (the UI uses 15s).
//
// Rules: presence is intentionally public-on-the-page so anyone with a
// valid auth token can see who else is here. Writes pin the row to the
// authenticated user via @request.body.user (matches the canonical
// user-scoped create pattern). Updates also enforce the user pin so a
// client can't impersonate someone else's heartbeat. Deletes are
// owner-only — used for graceful cleanup on unmount.
migrate((app) => {
  const presence = new Collection({
    "id": "pbc_note_presence",
    "name": "note_presence",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_note_presence_page ON note_presence (page)",
      "CREATE INDEX idx_note_presence_user ON note_presence (user)",
      "CREATE UNIQUE INDEX idx_note_presence_user_page ON note_presence (user, page)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_np_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_note_pages", "hidden": false, "id": "f_np_page", "maxSelect": 1, "minSelect": 0, "name": "page", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_np_display_name", "max": 64, "min": 0, "name": "display_name", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_np_last_seen", "name": "last_seen", "presentable": false, "required": false, "system": false, "type": "date" },
      { "id": "autodate_created_note_presence", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_note_presence", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(presence);
}, (app) => {
  const col = app.findCollectionByNameOrId("note_presence");
  if (col) app.delete(col);
});
