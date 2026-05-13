/// <reference path="../pb_data/types.d.ts" />
//
// Re-assert note_pages collection rules.
//
// The original 1778100000_note_pages migration creates the collection with
// the canonical user-scoped rules, then does a SECOND save to add the
// self-referencing `parent` relation field after the collection exists.
// On some PB builds that second save can drop or normalize away the
// createRule, leaving create requests rejected with a bare 400 "Failed to
// create record" (the PB 0.22+ symptom for a rule mismatch with no
// validation details). This migration is idempotent — it just re-applies
// the canonical rules so create works again.
migrate((app) => {
  const c = app.findCollectionByNameOrId("note_pages");
  if (!c) return;
  c.listRule = "@request.auth.id = user.id";
  c.viewRule = "@request.auth.id = user.id";
  c.createRule = "@request.auth.id = @request.body.user";
  c.updateRule = "@request.auth.id = user.id";
  c.deleteRule = "@request.auth.id = user.id";
  app.save(c);
}, (app) => {
  // No-op down — leaving the rules in place is the safer default.
});
