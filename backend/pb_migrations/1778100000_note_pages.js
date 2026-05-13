/// <reference path="../pb_data/types.d.ts" />
//
// note_pages — top-level rich note pages (Notion-style block documents).
//
// A page owns:
//   - title (text, can be empty for "Untitled")
//   - icon (text, lucide icon name; renderer falls back if unknown)
//   - parent (self-relation for nested pages; "" for root pages)
//   - course (optional relation to courses)
//   - lecture (optional relation to lectures, for "from lecture" pages)
//   - blocks (json, ordered array of typed block objects)
//   - properties (json, page-level metadata: tags, status, due_at, etc.)
//   - archived (bool, soft-delete)
//
// Rules follow the canonical user-scoped pattern: createRule pins the
// user against @request.body.user (matches check-collection-rules.ts), and
// list/view/update/delete all gate on @request.auth.id = user.id.
migrate((app) => {
  // Save the collection first without the self-relation `parent` field,
  // because PocketBase validates relation collectionIds at save time and
  // the collection itself does not yet exist at that moment. We then
  // do a second save that adds the parent relation.
  const pages = new Collection({
    "id": "pbc_note_pages",
    "name": "note_pages",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_note_pages_user ON note_pages (user)",
      "CREATE INDEX idx_note_pages_course ON note_pages (course)",
      "CREATE INDEX idx_note_pages_archived ON note_pages (archived)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_np_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_np_title", "max": 0, "min": 0, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_np_icon", "max": 32, "min": 0, "name": "icon", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "cascadeDelete": false, "collectionId": "pbc_courses", "hidden": false, "id": "f_np_course", "maxSelect": 1, "minSelect": 0, "name": "course", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "pbc_lectures", "hidden": false, "id": "f_np_lecture", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "hidden": false, "id": "f_np_blocks", "maxSize": 2000000, "name": "blocks", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_np_props", "maxSize": 200000, "name": "properties", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_np_archived", "name": "archived", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "id": "autodate_created_note_pages", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_note_pages", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(pages);

  // Now that the collection exists, add the self-referencing parent
  // relation and the index that covers it.
  const created = app.findCollectionByNameOrId("note_pages");
  created.fields.add(new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_note_pages",
    "hidden": false,
    "id": "f_np_parent",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "parent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }));
  created.indexes = [
    ...created.indexes,
    "CREATE INDEX idx_note_pages_parent ON note_pages (parent)"
  ];
  app.save(created);
}, (app) => {
  const col = app.findCollectionByNameOrId("note_pages");
  if (col) app.delete(col);
});
