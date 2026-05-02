/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ── 1. courses ──
  const courses = new Collection({
    "id": "pbc_courses",
    "name": "courses",
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
      { "autogeneratePattern": "", "hidden": false, "id": "f_name", "max": 0, "min": 1, "name": "name", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_code", "max": 0, "min": 0, "name": "code", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_color", "max": 0, "min": 0, "name": "color", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_semester", "max": 0, "min": 0, "name": "semester", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(courses);

  // ── 2. lectures ──
  const lectures = new Collection({
    "id": "pbc_lectures",
    "name": "lectures",
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
      { "autogeneratePattern": "", "hidden": false, "id": "f_title", "max": 0, "min": 1, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_audio", "maxSelect": 1, "maxSize": 0, "mimeTypes": [], "name": "audio_file", "presentable": false, "protected": false, "required": false, "system": false, "thumbs": [], "type": "file" },
      { "hidden": false, "id": "f_dur", "max": null, "min": null, "name": "duration_secs", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_status", "maxSelect": 1, "name": "status", "presentable": false, "required": false, "system": false, "type": "select", "values": ["uploading","processing","transcribing","generating","ready","error"] },
      { "autogeneratePattern": "", "hidden": false, "id": "f_err", "max": 0, "min": 0, "name": "error_message", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_rec_at", "max": "", "min": "", "name": "recorded_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_lec_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "pbc_courses", "hidden": false, "id": "f_course", "maxSelect": 1, "minSelect": 0, "name": "course", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(lectures);

  // ── 3. transcripts ──
  const transcripts = new Collection({
    "id": "pbc_transcripts",
    "name": "transcripts",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_raw", "max": 0, "min": 0, "name": "raw_text", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_clean", "max": 0, "min": 0, "name": "clean_text", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_segs", "maxSize": 0, "name": "segments", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_spk", "maxSize": 0, "name": "speakers", "presentable": false, "required": false, "system": false, "type": "json" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_lang", "max": 0, "min": 0, "name": "language", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_wc", "max": null, "min": null, "name": "word_count", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "cascadeDelete": true, "collectionId": "pbc_lectures", "hidden": false, "id": "f_t_lec", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(transcripts);

  // ── 4. notes ──
  const notes = new Collection({
    "id": "pbc_notes",
    "name": "notes",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_n_title", "max": 0, "min": 1, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_content", "maxSize": 0, "name": "content", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_ct", "maxSelect": 1, "name": "content_type", "presentable": false, "required": false, "system": false, "type": "select", "values": ["auto_generated","manual","hybrid"] },
      { "hidden": false, "id": "f_kc", "maxSize": 0, "name": "key_concepts", "presentable": false, "required": false, "system": false, "type": "json" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_summary", "max": 0, "min": 0, "name": "summary", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "cascadeDelete": true, "collectionId": "pbc_lectures", "hidden": false, "id": "f_n_lec", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_n_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(notes);

  // ── 5. flashcards ──
  const flashcards = new Collection({
    "id": "pbc_flashcards",
    "name": "flashcards",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_deck", "max": 0, "min": 1, "name": "deck_name", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_front", "max": 0, "min": 1, "name": "front", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_back", "max": 0, "min": 1, "name": "back", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_tags", "maxSize": 0, "name": "tags", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_diff", "maxSelect": 1, "name": "difficulty", "presentable": false, "required": false, "system": false, "type": "select", "values": ["easy","medium","hard"] },
      { "hidden": false, "id": "f_src", "maxSelect": 1, "name": "source", "presentable": false, "required": false, "system": false, "type": "select", "values": ["auto_generated","manual"] },
      { "hidden": false, "id": "f_ef", "max": null, "min": null, "name": "ease_factor", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_intd", "max": null, "min": null, "name": "interval_days", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_reps", "max": null, "min": null, "name": "repetitions", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_nr", "max": "", "min": "", "name": "next_review", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_lr", "max": "", "min": "", "name": "last_review", "presentable": false, "required": false, "system": false, "type": "date" },
      { "cascadeDelete": true, "collectionId": "pbc_lectures", "hidden": false, "id": "f_fc_lec", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_fc_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(flashcards);

  // ── 6. quizzes ──
  const quizzes = new Collection({
    "id": "pbc_quizzes",
    "name": "quizzes",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_q_title", "max": 0, "min": 1, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_qs", "maxSize": 0, "name": "questions", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_tp", "max": null, "min": null, "name": "total_points", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_qsrc", "maxSelect": 1, "name": "source", "presentable": false, "required": false, "system": false, "type": "select", "values": ["auto_generated","manual"] },
      { "cascadeDelete": true, "collectionId": "pbc_lectures", "hidden": false, "id": "f_q_lec", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_q_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(quizzes);

  // ── 7. quiz_attempts ──
  const quizAttempts = new Collection({
    "id": "pbc_quiz_attempts",
    "name": "quiz_attempts",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "hidden": false, "id": "f_ans", "maxSize": 0, "name": "answers", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_score", "max": null, "min": null, "name": "score", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_ms", "max": null, "min": null, "name": "max_score", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_pct", "max": null, "min": null, "name": "percentage", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_tts", "max": null, "min": null, "name": "time_taken_secs", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_ca", "max": "", "min": "", "name": "completed_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "cascadeDelete": true, "collectionId": "pbc_quizzes", "hidden": false, "id": "f_qa_q", "maxSelect": 1, "minSelect": 0, "name": "quiz", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_qa_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(quizAttempts);

  // ── 8. study_sessions ──
  const studySessions = new Collection({
    "id": "pbc_study_sessions",
    "name": "study_sessions",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "indexes": [],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "hidden": false, "id": "f_st", "maxSelect": 1, "name": "session_type", "presentable": false, "required": false, "system": false, "type": "select", "values": ["flashcard_review","quiz","pomodoro","free_study"] },
      { "hidden": false, "id": "f_cr", "max": null, "min": null, "name": "cards_reviewed", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_cc", "max": null, "min": null, "name": "cards_correct", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_ds", "max": null, "min": null, "name": "duration_secs", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" },
      { "hidden": false, "id": "f_sa", "max": "", "min": "", "name": "started_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "hidden": false, "id": "f_ea", "max": "", "min": "", "name": "ended_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "cascadeDelete": true, "collectionId": "pbc_lectures", "hidden": false, "id": "f_ss_lec", "maxSelect": 1, "minSelect": 0, "name": "lecture", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_ss_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": false, "system": false, "type": "relation" }
    ]
  });
  app.save(studySessions);

}, (app) => {
  const names = ["study_sessions","quiz_attempts","quizzes","flashcards","notes","transcripts","lectures","courses"];
  for (const name of names) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch (e) {}
  }
})
