# Converge — QA Broken Features Spec

**QA run date:** 2026-05-03
**Method:** 10 parallel Playwright agents, demo user `demo@hackstack.dev`
**Build under test:** `main` @ `50e0960`

The single biggest finding is that **one schema bug cascades into roughly half the visible breakage in the app.** Fixing it unblocks Courses, Recent notes, sidebar, Lecture detail tabs, Per-course notes, and Upcoming classes.

---

## P0 — Blockers

### 1. `sort=-updated` / `sort=-created` returns HTTP 400 (root cause of most other P0s)

The recent migration `backend/pb_migrations/1777700000_add_autodate_fields.js` adds `created`/`updated` autodate fields to multiple collections, but it does **not backfill** the seeded rows. PocketBase rejects sort queries on these fields with a 400. Every list query that uses `sort: "-updated"` or `sort: "-created"` silently fails — frontend `.catch()` handlers swallow the error and the list renders empty.

**Confirmed broken queries:**

| Caller | File:Line | Effect |
|---|---|---|
| Dashboard "Recent notes" | `frontend/src/routes/index.tsx:602` | Recent notes always empty |
| Sidebar recent lectures | `frontend/src/components/layout/AppShell.tsx:92` | Sidebar always empty |
| `UpcomingClasses` | `frontend/src/components/dashboard/UpcomingClasses.tsx` | Always empty / "Nothing scheduled" |
| `/courses` list | `frontend/src/routes/courses.tsx:54` | Course list empty even when courses exist |
| `/courses/$id` notes | `frontend/src/routes/courses.$courseId.tsx:47` | Per-course notes empty |
| `/lectures/$id` transcripts | `frontend/src/routes/lectures.$lectureId.tsx:74` | Transcript tab always empty |
| `/lectures/$id` notes | `frontend/src/routes/lectures.$lectureId.tsx:88` | Notes tab always empty |

**Fix options:**
- (a) Backfill `created`/`updated` on seeded rows in `1777600000_demo_seed.js` migration so the autodate fields are queryable.
- (b) Switch all the broken sorts to a known-existing field (`-recorded_at` for `lectures`, `-id` as a fallback).
- (c) Both — defensively change the frontend sorts AND backfill.

Recommended: (c). Without (a), the moment any user edits any record the sorts will start working incrementally and you'll get inconsistent state.

### 2. Lecture detail page is missing 2 of 4 tabs

`frontend/src/routes/lectures.$lectureId.tsx` ships with `type View = "transcript" | "notes"`. The spec (and the existing `Flashcard`/`Quiz` data shapes) call for **four** tabs: Transcript, Notes, Flashcards, Quiz. Flashcards and Quiz tabs do not exist on the lecture page at all.

Workaround: users can reach flashcards via `/study/flashcards` and quizzes via the auto-generated quiz route, but the lecture-scoped views are missing.

### 3. Personal-notes save creates duplicate `notes` rows instead of updating

When the lecture's `notes` GET fails (because of P0 #1), the local state stays `null`. The save handler then unconditionally calls `pb.collection("notes").create(...)` — every keystroke after a debounce makes a new row. Two stray rows were observed during a single QA test.

Fix: gate `create` behind a "load succeeded and was empty" branch, or fix P0 #1 first so the GET works and the save uses `update`.

### 4. Personal notes never persist across reload

Same root cause as #3: the GET 400s, state never hydrates from the existing record. Fixing #1 fixes this.

---

## P1 — Major feature gaps

### 5. Courses CRUD is incomplete

Despite `tasks/remaining-features-spec.md` claiming feature #1 (Course Edit) is done:

- No edit (pencil) affordance on course cards.
- No color picker in the create form — `handleCreate` hard-codes `color: "#5fbf78"` (`courses.tsx:100-106`).
- No delete control on cards. PB's delete API is unreachable from the UI.
- Cards do not display the `course.color` stripe the spec describes.

### 6. Calendar is partially functional

- **"+ New event" toolbar button is silently broken on weekends or after `DAY_END_HOUR=20`.** `calendar.tsx:274` anchors the draft to today; if today's weekday isn't rendered or the current hour is off-grid, the draft is positioned out of view. Click produces no visible input.
- **Personal events are in-memory only.** `commitEvent` pushes to local state; reload wipes everything. No PB persistence.
- **No edit/delete modal.** Click-on-tile only navigates for lectures (and `window.open()` for assignments). Personal events have no `href`, so clicking them does nothing.
- **Multi-calendar legend is inert** (`CalendarLegendRow`, lines 414-421) — visual pills, no checkboxes, no show/hide.
- **Sidebar "Add calendar" + "Booking page" are disabled stubs** (lines 303-304).
- **Assignments never appear** because the seeded `assignments` collection is empty (verified 0 records for demo user). Wiring is fine; it's a seed-data gap.

### 7. Trash is a placeholder

`trash.tsx:23-26` states there is no `deleted_at` / `archived` field anywhere. No restore button. No soft-delete plumbing exists in any route. The "30-day recovery" copy is aspirational — it doesn't reflect any real implementation.

### 8. Settings: missing tabs + silently broken backend writes

- **Notifications + Privacy tabs are entirely absent** (not even with "Soon" badges). Actual nav: Profile / Preferences / Accessibility / Account / Data.
- **`display_name` field doesn't exist on the `users` collection schema.** `settings.tsx:339` calls `pb.users.update(user.id, { display_name })` — PB silently drops the unknown key. Profile reverts to email-prefix fallback on reload. Either add `display_name` to schema or use the built-in `name` field.
- **`preferences` field doesn't exist on the `users` collection schema.** `lib/preferences.tsx:148-158` writes preferences JSON on every change; PB returns 400 every time. Functionally masked because localStorage is the real source of truth, but the noisy 400 fires on every settings toggle.

### 9. Sign-language toggle has silent camera failure

`frontend/src/routes/capture.tsx:130-132` swallows `getUserMedia` errors with an empty `catch {}` (only a comment). When the camera is denied or unavailable:

- The `SignLanguageDetector` aside still mounts.
- The video pane shows black, no permission gate, no recovery affordance.
- MediaPipe emits `Failed to acquire camera feed: NotSupportedError` to console + a `pageerror` — none surfaced.
- The toggle button stays at `aria-pressed=true` regardless of failure.

Needs a visible permission/error state.

---

## P2 — Polish / spec drift

### 10. Quiz results don't show `concept_tag` breakdown
The schema includes `concept_tag` on every question and the spec's results screen calls for a per-concept score. The UI only renders question text + explanation. Add a grouped breakdown.

### 11. `QuizQuestion.tsx` and `QuizResults.tsx` don't exist
Spec lists them under `components/study/` but the rendering is inlined in `QuizRunner.tsx`. Not a bug, just doc drift.

### 12. File upload hint omits `mp4`
`FileUpload.tsx:84` lists "mp3, m4a, wav, webm, ogg, flac" but `ACCEPTED_FORMATS` and the validation error both include `.mp4`. Either drop `.mp4` from acceptance or add it to the hint.

### 13. Theme set diverges from spec
Spec lists light / dark / high-contrast / sepia. Implementation is dark-only with a single high-contrast toggle (`lib/preferences.tsx:25-29`) — light & sepia removed. Either update spec or restore.

### 14. Reading level lives under Preferences, not Accessibility
Spec puts it under `/settings/accessibility`; it's actually at `/settings` Preferences (`settings.tsx:423-437`). Move or update spec.

### 15. Study hub: launcher style vs. spec
Spec calls for "3 study mode cards with progress stats and tips." Implementation is a Things-3-style launcher list with no progress panel and no tips. Functional; design choice.

### 16. Study hub Quizzes row links to `/study` (self)
The Quizzes launcher href is the current page. Should point to a quiz list or the most-due quiz; reachable today only by clicking through a lecture's quiz tab (which is also missing — see P0 #2).

### 17. Seeded data is dated 2026-05-02 but "today" is 2026-05-03
Most recent `study_sessions.ended_at` is `2026-05-02 22:39:53Z`. In UTC, today is 2026-05-03, so the streak shows "5-day streak" without "today complete." Bump the seed to `now()` or shift relative to the migration timestamp.

### 18. All seeded lectures have empty `audio_file`
Audio player + click-to-seek + ±10s + speed selector cannot be exercised against demo data. Seed at least one lecture with a real audio attachment for demo / E2E coverage.

### 19. Login form is `noValidate` — invalid email format reaches the server
A submission like `notanemail` / `password` returns the generic server error `"Failed to create record."` instead of a client-side format hint.

### 20. AppShell renders `UserMenu` twice
Mobile in `<header lg:hidden>` and desktop in `hidden lg:block`. Both have `aria-haspopup="menu"`. Not user-facing, but Playwright `.first` lookups can target the hidden one.

---

## Verified working (no issues)

- Auth: signup, login, logout, redirects, password length validation.
- Landing page: Hero, hub-and-spoke workflow, features, accessibility, demo, CTA, footer.
- Quick actions strip on dashboard: all 5 links navigate cleanly.
- Greeting + streak indicator render with correct values.
- Live capture: idle render, record button, timer, Whisper model load, stop, lecture row creation, pipeline kickoff (correctly hits "No speech detected" branch with fake mic).
- File upload page: drag-drop zone, format validation rejects `.txt`, file input via `set_input_files()` works.
- Sign-language toggle (when camera allowed): video + canvas mount, `asl-templates.json` returns 200.
- Pomodoro timer: ready/start/pause/resume/skip transitions, no drift, study_session writer correct.
- Quiz runner: all 4 question types render and accept input, options highlight, submit creates `quiz_attempts` row.
- Study hub: due/available counts populate; streak chip renders.
- Flashcard review: 60 cards due, flip via click/space, rate via 1-4, SM-2 math correct (`next_review` advanced from May 2 → May 4 after Good rating), `study_sessions` row written with all fields, "Session complete" + "No cards due" empty state both render.
- Accessibility panel: font/theme/font-size/line-spacing/reduced-motion live-apply and persist (via localStorage). Reading ruler and focus-mode wiring exists. TTS toggle flips and `window.speechSynthesis` is available.
- Canvas integration card renders without errors.

---

## Suggested fix order

1. **P0 #1** — backfill `created`/`updated` on seed rows + defensively swap to `-recorded_at`/`-id` sorts in the frontend. Unblocks #2 (transcript/notes loading), #3, #4, #5 partially, #6 partially, plus three other cascading symptoms.
2. **P0 #2** — add Flashcards + Quiz tabs to the lecture detail page (or merge with study routes). High-visibility for demo.
3. **P1 #5** — finish Courses CRUD (edit, color picker, delete with confirm). Maps cleanly to the existing remaining-features spec.
4. **P1 #8** — add `display_name` and `preferences` fields to the `users` collection schema, kill the recurring 400.
5. **P1 #9** — add a visible permission/error state when camera is denied for sign language.
6. **P1 #6, #7** — calendar event persistence + soft-delete plumbing. These are larger scope; consider deferring past hackathon if the demo flow doesn't need them.
7. **P2** — copy/spec-drift items as time allows.
