# Converge — Improvement Spec (Safe Additive Only)

**Audit date:** 2026-05-08
**Branch:** `champ`
**Stack reviewed:** React 19 + TanStack Router (Vite, port 3000) frontend; PocketBase 0.26 (port 8090) backend with JS hooks; local Whisper (transformers.js), MediaPipe + Gemini Vision for ASL, OpenAI-compatible LLM router.
**Scope:** This file is filtered to **purely additive improvements** — no schema migrations, no behavior changes to existing flows, no refactors of hot paths. Everything below either layers new UI on top, adds optional metadata, or improves error messaging. None should regress existing users. Effort tags: S (≤1 day) / M (2–4 days).

---

## 1 · Functionality (additive)

### 1.1 Capture page polish

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 1.1.1 | **No-speech detection is too coarse.** `capture.tsx:231` shows "No speech detected in recording." for any empty transcript — including short clips and pre-warmup whisper drops. | Replace with a 3-tier message based on `audio.duration` and `stt.modelLoading`: (a) very short clip, (b) probable mic issue, (c) model still warming up. Add a "Transcribe again from saved audio" button that re-runs `transcribeAudioFile` against the existing blob. | S |
| 1.1.2 | **Pause state isn't reflected in caption status.** When the user pauses recording, `sttStatus` still reads "Whisper transcribing." | Show "Paused — captions resume on play" when `audio.isPaused`; hide the pulsing red dot. Pure string + conditional class change. | S |
| 1.1.3 | **No "stale captions" indicator.** If Whisper falls behind, the timer keeps ticking but the user has no signal. | Track `lastCaptionAt` timestamp. If `>8s` since the last caption while recording, render an amber pill: "Captions catching up…" | S |
| 1.1.4 | **No mic level indicator.** Common failure mode is a muted system mic; the user only finds out post-record. | Add a 3-bar VU meter under the timer, fed from an `AnalyserNode` on the existing `MediaStream`. ~30 lines of canvas/SVG. Visible only while recording. | S |
| 1.1.5 | **Lecture is saved as `Lecture {date}` with no course association.** The user has to rename and link from the detail page. | Optional pre-record form: course dropdown (existing courses, with "skip" option) + title input. Defaults pre-fill from the previous record. Persists to `localStorage`; if skipped, behavior is identical to today. | S |

### 1.2 Lecture / study UX

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 1.2.1 | **Quiz progress is lost on refresh.** Mid-quiz tab close = start over. | Persist current question index + selected answers to `localStorage` keyed by `quizId`. On mount, render a "Resume?" banner if state exists; user opts in. Doesn't touch the existing quiz schema. | S |
| 1.2.2 | **Flashcard rating buttons (1/2/3/4) lack labels and predicted intervals.** SRS semantics are non-obvious. | Render labels under each button (Again / Hard / Good / Easy) and one line below: "Next review: in 1 day · 4 days · 12 days · 30 days." Intervals are computable from current SM-2 state — read-only display. | S |
| 1.2.3 | **No active-line auto-scroll in transcript when audio plays.** Click-to-seek works; the inverse doesn't. | `useEffect` on `currentTime`: find the segment whose `start <= currentTime < end`, scroll its element into view with `block: 'nearest'`. Already have `currentTime` plumbed. | S |
| 1.2.4 | **Quiz UI shows no time spent.** No timer, no "you spent 45s on Q3." | Add a top-right elapsed-time chip during a quiz run. Don't persist anywhere yet — purely UI. | S |
| 1.2.5 | **Returning from a sub-flow always lands in the global queue or the hub.** Opening flashcards from a lecture and finishing them dumps you in `/study`, not back to the lecture. | Pass a `from` search param through navigations; on completion, route back to it (with a fallback to `/study` if absent). Pure routing addition. | S |

### 1.3 Search and palette

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 1.3.1 | **No "recently visited" group in the command palette.** Nothing surfaces what the user just looked at. | Track last 10 visited routes in `localStorage` (writes via `useLocation` effect). Render at the top of the palette with route-specific labels (lecture title, course code). Doesn't change existing palette results. | S |

### 1.4 Trust around AI output

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 1.4.1 | **AI-generated content is indistinguishable from user-authored content.** Notes and cards look the same whether the user wrote them or the LLM did. | Show a small `AI` chip next to artifacts where `content_type === 'auto_generated'` or `source === 'auto_generated'` (fields already exist in the schema). Tooltip: "Generated from this lecture. Edit to override." | S |
| 1.4.2 | **No "test AI connection" CTA when generation will fail.** Users hit the generate button and only then see an error. | On dashboard mount, run `testLLMConnection` (already exists in `lib/ai-pipeline.ts:54`). If it fails, render a non-blocking banner: "AI model not reachable — Configure in Settings." | S |
| 1.4.3 | **No "custom instructions" tuning.** `lib/prompts.ts` ships fixed system prompts. | Settings → AI Model → "Custom instructions" textarea. Stored in `localStorage` (same place as the LLM config), appended to each system prompt at runtime. | S |

---

## 2 · User Experience (additive)

### 2.1 First-run

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 2.1.1 | **First-run dashboard is a blank slate** — three empty cards, no guidance. | Onboarding checklist component for users where `lectures_count == 0`: "1. Add your first course · 2. Connect Canvas (optional) · 3. Record your first lecture." Auto-dismisses when complete. Renders above existing `QuickActions`; doesn't replace anything. | M |
| 2.1.2 | **No demo content for fresh accounts.** Hackathon judges and new users have nothing to click. | Seed a 3-minute demo lecture (transcript + notes + cards + quiz) on first signup, idempotent via a new `users.demo_seeded` boolean flag (single optional field, no breakage to existing rows). Pin it in the sidebar with a "Demo" tag. The seed data already exists in `backend/seed/`. | M |
| 2.1.3 | **Login page underplays signup.** First-time visitors miss the toggle at the bottom. | Default to "Create an account" tab on `/login` if no PB session has ever been written (`localStorage` flag). Headline becomes "Create your free account" with sign-in as the secondary action. | S |

### 2.2 Accessibility polish

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 2.2.1 | **Live captions read identically to screen readers regardless of confidence.** Visual cue (dotted underline) doesn't translate. | Add `aria-describedby` linking each low-confidence span to a hidden "uncertain word" hint. Optional brief audio chime at the end of a low-confidence run, gated on `prefers-reduced-motion: no-preference`. | S |
| 2.2.2 | **Calendar amber assignment text** (`KIND_STYLE.assignment` text on `bg-amber-500/15`) is borderline WCAG AA in dark mode. | Boost text token to `amber-100` or use `--color-text` with the amber bar only. Pure CSS. | S |
| 2.2.3 | **Sign-language captions tagged "(VLM)"** in the live caption stream is jargon for deaf/HoH users. | Replace the suffix with a small hand glyph + `aria-label="Detected via sign language."` Visual change only. | S |

### 2.3 Polish and motion

| # | Issue | Proposal | Effort |
|---|---|---|---|
| 2.3.1 | **`framer-motion` is in deps but underused.** Tabs and modals open abruptly. | Wrap route transitions and modal open/close in a single `AnimatePresence`. Constrain to opacity + 4 px translate. Respect `prefers-reduced-motion`. Doesn't change layout, just transition. | S |
| 2.3.2 | **Focus-visible rings are inconsistent across buttons.** Some have `ring-2 ring-offset-2`, others have none. | Define one `.btn-focus` utility class in `app.css` and add it to existing buttons via search-and-add. No new components, no API changes. | S |
| 2.3.3 | **No toast system.** Errors are inline `<div role="alert">` blocks; success ("Saved", "Card rated") is silent. | Add a tiny `useToast` hook with a single bottom-right region. Existing inline error blocks stay; toasts are *additional* feedback for new use sites (autosave, "Card rated → next review in 4 days", "Sign-in successful"). | M |

---

## 3 · Cross-cutting (additive)

### 3.1 Performance — code splitting

- **MediaPipe + Whisper bundles ship in the main chunk.** Convert their imports to dynamic `import()` triggered at first use:
  - Whisper: load when user navigates to `/capture` (already gated by route, just needs `lazy()`).
  - MediaPipe: load when user toggles sign-language on, not at page mount.
- Vite handles this with zero config changes. Bundle size drops by hundreds of KB on routes that don't use them. (S)

### 3.2 Tests (purely additive)

- **Vitest for pure logic hooks** — `useSM2`, `usePomodoro`, `useStudyStreak`. Easy wins, no app changes. (S)
- **One Playwright smoke test:** signup → mock-mic record → wait for pipeline (with a stubbed LLM response) → open lecture → rate one flashcard. Catches the most common end-to-end regression class. (M)

---

## 4 · Suggested order (one sprint, ~1 week)

**Day 1–2 (visibility & trust):**
1.1.4 (mic VU meter) → 1.4.1 (AI chip) → 1.4.2 (test connection banner) → 2.3.3 (toast system).

**Day 3 (capture polish):**
1.1.1 (better no-speech messages) → 1.1.2 (pause state in caption status) → 1.1.3 (stale-caption indicator) → 1.1.5 (pre-record course/title form).

**Day 4 (study polish):**
1.2.1 (quiz resume) → 1.2.2 (rating labels + predicted intervals) → 1.2.3 (active-line auto-scroll) → 1.2.4 (quiz timer) → 1.2.5 (`from` routing).

**Day 5 (first-run + a11y):**
2.1.1 (onboarding checklist) → 2.1.2 (demo seed) → 2.1.3 (signup-first login) → 2.2.1 (a11y caption hints) → 2.2.2 (amber contrast) → 2.2.3 (sign-language icon).

**Day 6–7 (cross-cutting):**
1.3.1 (recent in palette) → 1.4.3 (custom AI instructions) → 2.3.1 (route motion) → 2.3.2 (focus-ring utility) → 3.1 (code splitting) → 3.2 (Vitest for SRS hooks).

---

## 5 · Why these are safe

- **No schema migrations.** Every feature uses fields that already exist in the PocketBase collections, or stores new state in `localStorage`.
- **No changes to existing flows.** Every item either adds a new UI element, adds new optional state, or replaces a string/CSS value. The "do nothing" path through every page remains identical to today.
- **No refactors of hot paths.** The pipeline, calendar grid, transcript engine, and ASL recognizer are untouched.
- **No new dependencies.** `framer-motion`, `lucide-react`, `react-query`, and Vitest-compatible tooling are already in `package.json`.
- **Reversible.** Each item can be reverted with a single-commit rollback without leaving orphan data or broken queries.

Items deferred from the original spec — server-side pipeline, soft-delete, `quiz_attempts` / `flashcard_reviews` collections, parameterized PB filters, recurring calendar events, lecture-scoped flashcard filter, calendar split, react-query rollout — all carry data-migration or behavior-change risk and need their own design + backfill plan before shipping.
