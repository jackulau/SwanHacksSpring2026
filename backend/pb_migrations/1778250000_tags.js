/// <reference path="../pb_data/types.d.ts" />
//
// Unified tagging — extend `lectures` and `quizzes` with a `tags` json
// column so the four primary surfaces (note_pages.properties.tags,
// flashcards.tags, lectures.tags, quizzes.tags) all carry first-class
// tag arrays. The frontend then aggregates across these surfaces in
// lib/tags.ts.
//
// Idempotent: each field add checks for prior presence on the
// collection. Re-running the migration is a no-op.

migrate((app) => {
  const addTags = (name, fieldId) => {
    const col = app.findCollectionByNameOrId(name);
    if (!col) {
      console.log(`[tags] ${name} collection not found, skipping`);
      return;
    }
    if (col.fields.find((f) => f.name === "tags")) return;
    col.fields.add(new Field({
      id: fieldId,
      name: "tags",
      type: "json",
      hidden: false,
      maxSize: 20000,
      presentable: false,
      required: false,
      system: false,
    }));
    app.save(col);
  };

  addTags("lectures", "f_lec_tags");
  addTags("quizzes", "f_quiz_tags");
}, (app) => {
  const drop = (name) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col) return;
      col.fields = col.fields.filter((f) => f.name !== "tags");
      app.save(col);
    } catch (e) {
      // ignore
    }
  };
  drop("lectures");
  drop("quizzes");
});
