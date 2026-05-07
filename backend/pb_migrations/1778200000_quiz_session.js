/// <reference path="../pb_data/types.d.ts" />
//
// quiz_session — host-owned multiplayer quiz session.
//
// One row per "live game" the host has running. The 6-char `code` is the
// join key friends type at /play. State machine:
//   "lobby"   — open for joining
//   "running" — host has clicked Start; questions advance
//   "complete"— final results screen
//
// Rules: list/view permissive (any auth user can read a session by code so
// /play can find it before they're enrolled); update/delete restricted to
// host. Create rule pins host_user to caller — same canonical pattern as
// the rest of the user-attributed collections.
migrate((app) => {
  const sessions = new Collection({
    "id": "pbc_quiz_session",
    "name": "quiz_session",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id = @request.body.host_user",
    "updateRule": "@request.auth.id = host_user.id",
    "deleteRule": "@request.auth.id = host_user.id",
    "indexes": [
      "CREATE INDEX idx_quiz_session_host ON quiz_session (host_user)",
      "CREATE INDEX idx_quiz_session_quiz ON quiz_session (quiz)",
      "CREATE UNIQUE INDEX uniq_quiz_session_code ON quiz_session (code)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_qs_host", "maxSelect": 1, "minSelect": 0, "name": "host_user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "pbc_quizzes", "hidden": false, "id": "f_qs_quiz", "maxSelect": 1, "minSelect": 0, "name": "quiz", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_qs_code", "max": 6, "min": 6, "name": "code", "pattern": "^[A-Z0-9]{6}$", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_qs_state", "max": 16, "min": 0, "name": "state", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_qs_qix", "name": "current_question_index", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qs_started", "name": "started_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_qs_ended", "name": "ended_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_qs_qstart", "name": "question_started_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_qs_settings", "maxSize": 50000, "name": "settings", "presentable": false, "required": false, "system": false, "type": "json" },
      { "id": "autodate_created_quiz_session", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_quiz_session", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(sessions);

  const participants = new Collection({
    "id": "pbc_quiz_participant",
    "name": "quiz_session_participant",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id || @request.auth.id = session.host_user.id",
    "deleteRule": "@request.auth.id = user.id || @request.auth.id = session.host_user.id",
    "indexes": [
      "CREATE INDEX idx_qsp_session ON quiz_session_participant (session)",
      "CREATE INDEX idx_qsp_user ON quiz_session_participant (user)",
      "CREATE UNIQUE INDEX uniq_qsp_pair ON quiz_session_participant (session, user)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": true, "collectionId": "pbc_quiz_session", "hidden": false, "id": "f_qsp_session", "maxSelect": 1, "minSelect": 0, "name": "session", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_qsp_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_qsp_dn", "max": 64, "min": 0, "name": "display_name", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_qsp_score", "name": "score", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qsp_streak", "name": "streak", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qsp_last", "name": "last_answer_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "id": "autodate_created_qsp", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_qsp", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(participants);

  const answers = new Collection({
    "id": "pbc_quiz_answer",
    "name": "quiz_session_answer",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = session.host_user.id",
    "indexes": [
      "CREATE INDEX idx_qsa_session ON quiz_session_answer (session)",
      "CREATE INDEX idx_qsa_participant ON quiz_session_answer (participant)",
      "CREATE UNIQUE INDEX uniq_qsa_part_q ON quiz_session_answer (participant, question_index)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": true, "collectionId": "pbc_quiz_session", "hidden": false, "id": "f_qsa_session", "maxSelect": 1, "minSelect": 0, "name": "session", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_quiz_participant", "hidden": false, "id": "f_qsa_part", "maxSelect": 1, "minSelect": 0, "name": "participant", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_qsa_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "hidden": false, "id": "f_qsa_qix", "name": "question_index", "presentable": false, "required": true, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qsa_choice", "maxSize": 4000, "name": "choice", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_qsa_correct", "name": "correct", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "f_qsa_pts", "name": "points_earned", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qsa_ms", "name": "ms_to_answer", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_qsa_at", "name": "answered_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "id": "autodate_created_qsa", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false }
    ]
  });
  app.save(answers);
}, (app) => {
  for (const name of ["quiz_session_answer", "quiz_session_participant", "quiz_session"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
