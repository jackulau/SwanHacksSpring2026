/// <reference path="../pb_data/types.d.ts" />
//
// knowledge_chunks + knowledge_edges — Converge's source-of-truth retrieval
// layer. Every user-owned content surface (notes, lecture transcripts,
// flashcards, quiz questions, course modules, calendar events, ASL
// segments, files) gets sliced into ~300-500-token chunks here.
//
// v1 retrieval is keyword/BM25-style; the optional `embedding` JSON column
// is reserved so a real vector layer can drop in later. `knowledge_edges`
// stores adjacency for the graphRAG one-hop walk; populated heuristically
// during ingest (entity extraction is TODO).
migrate((app) => {
  const chunks = new Collection({
    "id": "pbc_knowledge_chunks",
    "name": "knowledge_chunks",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_kc_user ON knowledge_chunks (user)",
      "CREATE INDEX idx_kc_source ON knowledge_chunks (source_type, source_id)",
      "CREATE INDEX idx_kc_user_source ON knowledge_chunks (user, source_type)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_kc_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_kc_st", "max": 32, "min": 0, "name": "source_type", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_kc_sid", "max": 64, "min": 0, "name": "source_id", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_kc_section", "max": 128, "min": 0, "name": "section", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_kc_title", "max": 512, "min": 0, "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_kc_text", "max": 0, "min": 0, "name": "text", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "f_kc_tokens", "name": "tokens", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "onlyInt": true },
      { "hidden": false, "id": "f_kc_emb", "maxSize": 200000, "name": "embedding", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_kc_meta", "maxSize": 50000, "name": "meta", "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "f_kc_from", "name": "created_from_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "id": "autodate_created_kc", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
      { "id": "autodate_updated_kc", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
    ]
  });
  app.save(chunks);

  const edges = new Collection({
    "id": "pbc_knowledge_edges",
    "name": "knowledge_edges",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id = user.id",
    "viewRule": "@request.auth.id = user.id",
    "createRule": "@request.auth.id = @request.body.user",
    "updateRule": "@request.auth.id = user.id",
    "deleteRule": "@request.auth.id = user.id",
    "indexes": [
      "CREATE INDEX idx_ke_user ON knowledge_edges (user)",
      "CREATE INDEX idx_ke_from ON knowledge_edges (from_chunk)",
      "CREATE INDEX idx_ke_to ON knowledge_edges (to_chunk)",
      "CREATE UNIQUE INDEX uniq_ke_pair ON knowledge_edges (from_chunk, to_chunk, kind)"
    ],
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": false, "collectionId": "_pb_users_auth_", "hidden": false, "id": "f_ke_user", "maxSelect": 1, "minSelect": 0, "name": "user", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_knowledge_chunks", "hidden": false, "id": "f_ke_from", "maxSelect": 1, "minSelect": 0, "name": "from_chunk", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "pbc_knowledge_chunks", "hidden": false, "id": "f_ke_to", "maxSelect": 1, "minSelect": 0, "name": "to_chunk", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "autogeneratePattern": "", "hidden": false, "id": "f_ke_kind", "max": 32, "min": 0, "name": "kind", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "f_ke_weight", "name": "weight", "presentable": false, "required": false, "system": false, "type": "number", "min": 0, "max": 1, "onlyInt": false },
      { "id": "autodate_created_ke", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false }
    ]
  });
  app.save(edges);
}, (app) => {
  for (const name of ["knowledge_edges", "knowledge_chunks"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
