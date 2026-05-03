/// <reference path="../pb_data/types.d.ts" />
//
// Backfill migration: populate `created` and `updated` on rows that pre-date
// the autodate field migration (1777700000_add_autodate_fields.js).
//
// Why this is needed:
//   The autodate migration adds `created`/`updated` autodate fields to several
//   collections, but PocketBase does NOT backfill historical rows. Existing
//   records end up with empty-string values. Any list query that uses
//   `sort=-created` or `sort=-updated` then returns HTTP 400 because PB
//   refuses to sort on rows where the field is unset.
//
// Symptom (frontend):
//   Dashboard "Recent notes", sidebar recent lectures, /courses list, per-
//   course notes, lecture transcript/notes tabs — all use `-updated` /
//   `-created` sorts and silently render empty. See tasks/qa-broken-features.md
//   P0 #1 for the full list.
//
// Fix:
//   Pick the best available timestamp per collection (recorded_at for
//   lectures, started_at for study_sessions, completed_at for quiz_attempts,
//   due_at for assignments) and copy it into `created` and `updated`. For
//   collections without a domain timestamp, fall back to the current time —
//   the rows already exist; we just need a deterministic, sortable value.
//
// Idempotency:
//   The UPDATE statements use `WHERE created = '' OR created IS NULL` so re-
//   running the migration is a no-op once rows are populated. New rows
//   created via PB's normal API path get `created`/`updated` filled by the
//   autodate field automatically — those are not touched.
//
// Safety:
//   - Each collection update is wrapped in a try/catch so a missing column
//     (e.g. autodate migration didn't yet run for some reason) just skips
//     that collection rather than failing the whole migration.
//   - Down handler is a no-op: clearing the timestamps would re-introduce
//     the original 400 bug, which is never desirable.

migrate((app) => {
  // Format: "YYYY-MM-DD HH:MM:SS.sssZ" — PocketBase's autodate string format.
  function pbNow() {
    const d = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
    return (
      d.getUTCFullYear() +
      "-" + pad(d.getUTCMonth() + 1) +
      "-" + pad(d.getUTCDate()) +
      " " + pad(d.getUTCHours()) +
      ":" + pad(d.getUTCMinutes()) +
      ":" + pad(d.getUTCSeconds()) +
      "." + ms + "Z"
    );
  }

  const now = pbNow();
  // Inline the timestamp as a quoted SQL literal. Safe because `pbNow()`
  // produces a fixed-format string with no user input. We can't use a named
  // bind here because PocketBase's dbx requires one bind per placeholder
  // occurrence and our COALESCE expressions reference :now multiple times.
  const nowLit = "'" + now + "'";

  // Each entry: [collectionName, sourceColumnExpr]. sourceExpr yields a
  // non-empty timestamp via COALESCE + NULLIF (handles both NULL and '').
  const plan = [
    ["courses",        nowLit],
    ["lectures",       "COALESCE(NULLIF(recorded_at, ''), " + nowLit + ")"],
    ["transcripts",    nowLit],
    ["notes",          nowLit],
    ["flashcards",     "COALESCE(NULLIF(last_review, ''), NULLIF(next_review, ''), " + nowLit + ")"],
    ["quizzes",        nowLit],
    ["quiz_attempts",  "COALESCE(NULLIF(completed_at, ''), " + nowLit + ")"],
    ["assignments",    "COALESCE(NULLIF(due_at, ''), " + nowLit + ")"],
    ["study_sessions", "COALESCE(NULLIF(started_at, ''), NULLIF(ended_at, ''), " + nowLit + ")"],
  ];

  for (const [table, sourceExpr] of plan) {
    try {
      // Confirm the table exists before running UPDATE; missing table = skip.
      app.findCollectionByNameOrId(table);
    } catch (e) {
      console.log("[backfill_autodates] skip missing collection: " + table);
      continue;
    }

    const sql =
      "UPDATE " + table +
      " SET created = " + sourceExpr +
      ", updated = " + sourceExpr +
      " WHERE (created = '' OR created IS NULL) " +
      "    OR (updated = '' OR updated IS NULL)";

    try {
      app.db().newQuery(sql).execute();
      console.log("[backfill_autodates] backfilled " + table);
    } catch (e) {
      // Most likely cause: the autodate columns haven't been added yet
      // (e.g. autodate migration ordered after this one in some env). Log
      // and continue — once that migration runs, rerunning this one will
      // backfill correctly.
      console.log("[backfill_autodates] " + table + " skipped: " + e);
    }
  }
}, (app) => {
  // No rollback. Clearing the timestamps would re-break sort=-created queries.
});
