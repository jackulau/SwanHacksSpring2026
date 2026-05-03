/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const calendarEvents = new Collection({
    "id": "pbc_calendar_events",
    "name": "calendar_events",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_cal_events_user ON calendar_events (user)",
      "CREATE INDEX idx_cal_events_start ON calendar_events (start_at)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_ce_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_ce_title", "max": 0, "min": 1, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_ce_start", "max": "", "min": "", "name": "start_at", "presentable": false, "required": true, "system": false, "type": "date" },
      { "hidden": false, "id": "f_ce_end", "max": "", "min": "", "name": "end_at", "presentable": false, "required": true, "system": false, "type": "date" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_ce_notes", "max": 0, "min": 0, "name": "notes", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_ce_color", "max": 0, "min": 0, "name": "color", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_ce_ext_href", "max": 0, "min": 0, "name": "external_href", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "id": "autodate_created_calendar_events", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_calendar_events", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(calendarEvents);
}, (app) => {
  const col = app.findCollectionByNameOrId("calendar_events");
  app.delete(col);
});
