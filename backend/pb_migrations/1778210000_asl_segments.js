/// <reference path="../pb_data/types.d.ts" />
//
// asl_segments — persistent history of ASL transcription segments.
//
// One row per ~1.5-2.5s motion segment captured by the webcam pipeline.
// `frames` stores the sampled JPEG frames (as data-URLs or PB file refs)
// so the user can replay and re-sign without recapturing video; the chat
// surface shows a row per segment with its transcription.
migrate((app) => {
  const segments = new Collection({
    "id": "pbc_asl_segments",
    "name": "asl_segments",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_asl_segments_user ON asl_segments (user)",
      "CREATE INDEX idx_asl_segments_session ON asl_segments (session_id)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_asg_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_asg_session", "max": 64, "min": 0, "name": "session_id", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_asg_text", "max": 1000, "min": 0, "name": "transcription", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_asg_conf", "name": "confidence", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "max": 1, "onlyInt": false },
      { "hidden": false, "id": "f_asg_provider", "name": "provider", "presentable": false, "required": false, "system": false, "type": "text", "max": 32 },
      { "hidden": false, "id": "f_asg_model", "name": "model", "presentable": false, "required": false, "system": false, "type": "text", "max": 64 },
      { "hidden": false, "id": "f_asg_dur", "name": "duration_ms", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_asg_frames", "maxSize": 4000000, "name": "frames", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_asg_meta", "maxSize": 50000, "name": "meta", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_asg_resigned", "name": "resigned", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "id": "autodate_created_asl_segments", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_asl_segments", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(segments);
}, (app) => {
  const col = app.findCollectionByNameOrId("asl_segments");
  if (col) app.delete(col);
});
