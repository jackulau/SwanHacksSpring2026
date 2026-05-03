# Feature #6 — Demo Data Seeding — DONE

## Summary
Implemented an idempotent, two-surface demo seed that hydrates a fresh PocketBase instance with everything needed for a hackathon-grade demo: a known demo user, three realistic courses, five lectures with full transcripts, polished notes, twelve flashcards each, and an eight-question quiz each, plus five days of study sessions for the streak. The dataset lives once in `backend/seed/demo-data.js` and is consumed by both a PocketBase JSVM migration (`backend/pb_migrations/1777600000_demo_seed.js`) and a Node script (`frontend/scripts/seed.ts`) that auths as a superuser via the JS SDK. Every record uses a deterministic 15-char `[a-z0-9]` id, so re-running either surface skips existing rows and never duplicates.

## Files created
- `backend/seed/demo-data.js` — single source of truth dataset (~620 lines)
- `backend/pb_migrations/1777600000_demo_seed.js` — JSVM migration: upsert by id with `findRecordById` + create-on-404 (~190 lines)
- `frontend/scripts/seed.ts` — Node script: superuser auth, `getOne` + `create` upsert pattern, typed `DemoData` interface (~330 lines)

## Files modified
- `frontend/package.json` — added `seed` script (`tsx scripts/seed.ts`) and devDependencies `tsx` (^4.19.2) and `@types/node` (^22.10.5; required for the script to type-check cleanly).

## Files NOT modified
- No tsconfig / migration to rules / no other backend or frontend code touched.

## Total record count: 89 records
| Collection      | Rows |
|-----------------|------|
| users           | 1    |
| courses         | 3    |
| lectures        | 5    |
| transcripts     | 5    |
| notes           | 5    |
| flashcards      | 60   |
| quizzes         | 5    |
| study_sessions  | 5    |

All 89 ids are unique, exactly 15 chars, and match `^[a-z0-9]+$` (verified programmatically).

## Acceptance criteria — verified
1. **Migration up applies cleanly** — PocketBase JSVM migration file (`1777600000_demo_seed.js`) loads the dataset via `require(`${__hooks}/../seed/demo-data.js`)`, then for each row calls `app.findRecordById(coll, id)` inside try/catch and creates the record only on 404. Re-running is a no-op. Validated with `node --check` (syntax) and a manual review of the JSVM API surface against `backend/pb_data/types.d.ts`.
2. **Demo user `demo@hackstack.dev` / `demohackstack` is auto-created if missing** — both seed surfaces upsert the user with `emailVisibility=true`, `verified=true`, and `setPassword(...)` (migration) / `password + passwordConfirm` (Node SDK). `name`, `display_name`, and `onboarding_done` are set defensively (try/catch around unknown-field setters) so the seed works regardless of which optional user fields exist on the deployed schema.
3. **3 demo courses** — Biology 201 (BIO 201, #14b8a6), Intro to Cognitive Science (COGS 101, #6366f1), Linear Algebra (MATH 1B, #ec4899). All Spring 2026.
4. **5 demo lectures distributed 2/2/1** — BIO: "Cell Membrane Transport", "Photosynthesis Light Reactions". COGS: "Theories of Consciousness", "Memory & Forgetting". MATH: "Eigenvalues & Eigenvectors". `audio_file=""`, `status="ready"`, `duration_secs` ∈ {1620, 2280, 1980, 1740, 2520} (all in the 25–45 min window), `recorded_at` spread across the past 14 days (12, 7, 9, 4, 2 days ago). Each lecture has an associated transcript (3–4 paragraphs of authored domain content + 6–8 timestamped segments + computed `word_count`), a note (exactly 1 heading / 2 paragraph / 1 bullet_list with 3 items / 2 key_term / 1 callout variant `tip`, plus a `summary` and 3 `key_concepts`), 12 flashcards split 4 easy / 5 medium / 3 hard with real Q/A and `tags=[course code]`, and a quiz with 8 questions split 4 multiple_choice / 2 true_false / 1 short_answer / 1 fill_blank totaling 80 points.
5. **5 days of study_sessions** — one session per day for the last 5 days, each `session_type="flashcard_review"`, `duration_secs=1200` (20 min), `cards_reviewed=15`, `cards_correct=12`, `lecture` = the first BIO 201 lecture id. `started_at` = today minus N days, `ended_at` = `started_at + duration_secs`. Sufficient to drive the streak component into "On fire" territory once the streak hook lands.
6. **Idempotent** — both the migration and the Node script check existence by deterministic id before creating. Migration uses `try { findRecordById(c, id); skip } catch { create }`. Script uses `try { getOne(id); log skipped; return } catch (404) { create }`. Re-running either surface neither duplicates rows nor errors. Verified by tracing every collection block and confirming the same upsert pattern is applied uniformly.
7. **Both surfaces share the dataset** — `frontend/scripts/seed.ts` loads `backend/seed/demo-data.js` via `createRequire(import.meta.url)` against an absolute resolved path, so changes to the dataset propagate to both the migration and the script with zero duplication. Adds `"seed": "tsx scripts/seed.ts"` to `frontend/package.json` as required.

## Quality verification
- `cd frontend && npx tsc --noEmit` — exits 0 (project tsc, unchanged).
- `cd frontend && npx tsc --noEmit --types node scripts/seed.ts` (with the project's strict + bundler resolution flags) — exits 0; the script's types are clean (no `any`, all errors narrowed via `instanceof ClientResponseError`, dataset shape declared via local `DemoData` interface).
- `node --check backend/pb_migrations/1777600000_demo_seed.js` — exits 0 (JS syntax valid; migration uses only globals available in PB's JSVM context: `migrate`, `Record`, `__hooks`, `require`, plus the `app` parameter).
- Dataset integrity script: 89 unique ids, all 15-char `[a-z0-9]`, no duplicates, 0 malformed segments (`start < end`, text non-empty), every quiz totals 80 points, every flashcard set splits 4/5/3 across difficulties.

## Quality bar — production-grade content
- Transcripts are hand-authored, 60–90 words per paragraph, 3–4 paragraphs per lecture, in plausible lecture-style prose. `clean_text` is a polished pass through a small `polish()` helper that strips filler ("okay so", "you know"), upgrades "basically" → "essentially", and sentence-cases the opener — judges reading the demo will see real-feeling content, not lorem ipsum.
- Flashcards are real Q/A pairs with content-specific answers (e.g., "How many ions does the Na+/K+ pump move per ATP?" → "3 sodium out, 2 potassium in").
- Quizzes include `concept_tag`, `explanation`, `points`, `difficulty`, and `accept_also` arrays for short_answer/fill_blank tolerance — they're judge-runnable end-to-end, not skeletons.
- Notes use the exact NoteBlock schema from `lib/types.ts`: `HeadingBlock`, `ParagraphBlock`, `BulletListBlock`, `KeyTermBlock`, `CalloutBlock` with `variant: "tip"`, plus `summary` and 3 `KeyConcept`s with `importance` levels.
- All `tags` on flashcards = `[course_code]` so they group by class in the UI.

## Deviations from spec
- **Added `@types/node` as a devDependency** alongside `tsx`. The spec only listed `tsx`, but the script must type-check cleanly against `process.env`, `import.meta.url`, `node:module`, `node:url`, and `node:path` — none of which TypeScript can resolve without `@types/node`. Adding the types package is consistent with "TypeScript on the script must be clean" being a hard quality gate.
- **PB JSVM migration omits `app.runInTransaction`** — the `migrate(up, down)` JSVM helper already runs the up callback inside a transaction (per `backend/pb_data/types.d.ts:1096`, `up: (txApp: CoreApp) => void`). Wrapping again would either nest unnecessarily or fail. Idempotency + atomicity are still preserved end-to-end.
- **Notes have exactly 2 paragraph blocks (matching the spec)** — initial draft had 3 paragraphs per note for narrative flow; trimmed to exactly 2 to honor the spec's specific block count.
- **PocketBase ids are 15 chars `[a-z0-9]`** — the spec says "pad/truncate as needed". I hand-derived a deterministic naming scheme: courses `democourse{slug}` (15), lectures `demolec{course3}{nn}{seq}` (15), transcripts/notes mirror the lecture suffix (`demotrn…`, `demonot…`), flashcards `demofc{lec7}{seq2}` (15) using `lec.id.slice(-7)` for uniqueness, quizzes `demoqz{course3}{nn}000{n}` (15), sessions `demosess000000{n}` (15). All 89 ids verified unique and well-formed.
- **No verification against a live PocketBase instance** — per task instructions ("Don't actually run this — just verify the migration syntax mentally"), I validated migration syntax via `node --check`, confirmed the JSVM globals match PocketBase's exposed API, and traced the upsert pattern against the `findRecordById` / `Record(...)` / `app.save` idioms used in the existing `1777500000_hackstack_collections.js`. The teammate running the seed end-to-end will need either a fresh `pb_data` (migration auto-applies on `pocketbase serve`) or `npm run seed` after creating a superuser.
