/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = [
    "courses", "lectures", "transcripts", "notes",
    "flashcards", "quizzes", "quiz_attempts", "assignments", "study_sessions",
  ];

  for (const name of collections) {
    let col;
    try {
      col = app.findCollectionByNameOrId(name);
    } catch {
      continue;
    }

    const hasCreated = col.fields.find((f) => f.name === "created");
    const hasUpdated = col.fields.find((f) => f.name === "updated");

    if (!hasCreated) {
      col.fields.push(new Field({
        id: "autodate_created_" + name,
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      }));
    }

    if (!hasUpdated) {
      col.fields.push(new Field({
        id: "autodate_updated_" + name,
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      }));
    }

    app.save(col);
  }
}, (app) => {
  // no rollback needed
});
