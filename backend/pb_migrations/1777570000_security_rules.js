/// <reference path="../pb_data/types.d.ts" />
//
// Security migration: lock down collection access rules.
//
// Findings driving this migration:
//   1. transcripts/notes/flashcards/quizzes/quiz_attempts shipped with every
//      rule set to "" (open). Authenticated users (or anyone, depending on
//      PB version) can read/write any user's data.
//   2. courses/lectures/assignments createRule was `@request.auth.id != ''`,
//      which checks logged-in but does not prevent writing records attributed
//      to a different user (user-id spoofing on create).
//
// Strategy:
//   - For collections with a direct `user` field, scope every rule to
//     `@request.auth.id = user.id` and tighten the createRule to also assert
//     that the new record's user field equals the caller.
//   - transcripts has no `user` field; scope rules through its lecture.user
//     parent relation.

migrate((app) => {
  const userScoped = (createBody = "@request.auth.id = @request.body.user") => ({
    listRule: "@request.auth.id = user.id",
    viewRule: "@request.auth.id = user.id",
    createRule: createBody,
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id",
  });

  const apply = (name, rules) => {
    const collection = app.findCollectionByNameOrId(name);
    if (!collection) return;
    collection.listRule = rules.listRule;
    collection.viewRule = rules.viewRule;
    collection.createRule = rules.createRule;
    collection.updateRule = rules.updateRule;
    collection.deleteRule = rules.deleteRule;
    app.save(collection);
  };

  // Collections with a direct user relation
  apply("courses", userScoped());
  apply("lectures", userScoped());
  apply("notes", userScoped());
  apply("flashcards", userScoped());
  apply("quizzes", userScoped());
  apply("quiz_attempts", userScoped());
  apply("assignments", userScoped());

  // study_sessions was tightened by an earlier migration (1777560000).
  // Re-apply here for idempotency (no-op if rules already match).
  apply("study_sessions", userScoped());

  // transcripts has no `user` field — scope through lecture.user. PB rule
  // expressions can't dereference relations from @request.body, so the
  // create rule falls back to "logged-in" — server-side ownership is still
  // enforced by the lecture.user view/update/delete rules.
  apply("transcripts", {
    listRule: "@request.auth.id = lecture.user",
    viewRule: "@request.auth.id = lecture.user",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = lecture.user",
    deleteRule: "@request.auth.id = lecture.user",
  });
}, (app) => {
  // Down: restore the prior (open / loose) rules. We don't realistically want
  // this rollback path to ever run, but PB requires a down handler.
  const open = {
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  };
  const looseUserScoped = {
    listRule: "@request.auth.id = user.id",
    viewRule: "@request.auth.id = user.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id",
  };
  const apply = (name, rules) => {
    const collection = app.findCollectionByNameOrId(name);
    if (!collection) return;
    collection.listRule = rules.listRule;
    collection.viewRule = rules.viewRule;
    collection.createRule = rules.createRule;
    collection.updateRule = rules.updateRule;
    collection.deleteRule = rules.deleteRule;
    app.save(collection);
  };
  apply("courses", looseUserScoped);
  apply("lectures", looseUserScoped);
  apply("assignments", looseUserScoped);
  apply("transcripts", open);
  apply("notes", open);
  apply("flashcards", open);
  apply("quizzes", open);
  apply("quiz_attempts", open);
});
