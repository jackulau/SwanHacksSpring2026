/// <reference path="../pb_data/types.d.ts" />
//
// Tighten calendar_events.createRule.
//
// Background:
//   1777570000_security_rules.js consolidated user-attributed collections to
//   the createRule "@request.auth.id = @request.body.user", preventing
//   user-id spoofing on create. calendar_events was added later by
//   1777900000_calendar_events.js with the loose pre-consolidation rule
//   "@request.auth.id != ''", silently re-introducing the bug the
//   consolidation was specifically written to eliminate.
//
//   This migration applies the canonical pattern to calendar_events. The
//   class-level invariant — every collection with a relation to the users
//   auth collection must contain "@request.auth.id = @request.body.user" in
//   its createRule — is enforced going forward by
//   `backend/scripts/check-collection-rules.ts` (npm run check-rules).
//
//   Behavioral repro:
//     docs/demo-prep/04-repro-scripts/11-calendar-events-privesc.sh

migrate((app) => {
  const collection = app.findCollectionByNameOrId("calendar_events");
  if (!collection) return;
  collection.createRule = "@request.auth.id = @request.body.user";
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("calendar_events");
  if (!collection) return;
  collection.createRule = "@request.auth.id != ''";
  app.save(collection);
});
