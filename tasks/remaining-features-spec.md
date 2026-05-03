# HackStack — Remaining Features Spec

Status of `tasks/todo.md` after the Reading Ruler + Focus Mode merge:

| Phase | Feature | Status | Owner |
|---|---|---|---|
| 4 | Course CRUD | 🟡 Partial — needs **Update** + lecture-empty-state UX | Open |
| 4 | Audio player bar | 🟡 Component exists, never mounted | Open |
| 5 | Study session tracking | 🔴 Not started — schema exists, no writes | Open |
| 6 | Study streak | 🟡 Stub component, no data | Open |
| 6 | Responsive design pass | 🔴 Not started — sidebar breaks <768px | Open |
| 6 | Demo data seeding | 🔴 Not started | Open |

Each spec below is self-contained: pick up any one without touching the others.

---

## 1. Course CRUD — Edit / Update Flow

### What exists today
- `frontend/src/routes/courses.tsx` already has Create + List + Delete.
- Schema: `Course` collection (`user`, `name`, `code`, `color`, `semester`) — see `lib/types.ts:208`.
- `routes/courses.$courseId.tsx` shows the lecture list for a course.

### What's missing
- **No way to edit a course after creation.** Once you typo "BIO 201" the only option is delete-and-recreate, which orphans lectures.
- Color is auto-rotated on create — there's no color picker.
- No optimistic UI for delete (page jumps).

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | Click pencil icon on a course card → inline edit form opens | ✓ |
| 2 | Edit name/code/semester/color → save → card updates without page reload | ✓ |
| 3 | Cancel edit reverts changes | ✓ |
| 4 | Delete shows a confirm modal (no more silent delete) | ✓ |
| 5 | Delete cascades: lectures with `course = thisId` show "Course deleted" or migrate to a generic course | ✓ |
| 6 | All form fields keyboard-accessible, Esc closes edit, Enter saves | ✓ |

### Implementation
1. Add `EditCourseForm` component (mirror of the create form) in `routes/courses.tsx`.
2. `Course` card grows an edit (pencil) icon next to delete; click swaps card → `EditCourseForm` in place.
3. Color picker = a horizontal strip of 7 swatches from the existing `COLORS` constant.
4. Save: `pb.collection('courses').update(id, { ...patch })`.
5. Delete confirm: simple inline `<dialog>` or a tiny inline confirm row (no new dependency).
6. PocketBase rule check: ensure the `courses` collection's `updateRule` allows `user = @request.auth.id`. If missing, add a migration in `backend/pb_migrations/` updating that rule.
7. Optimistic UI: locally remove the deleted course from `courses` state immediately, then call `pb.collection('courses').delete(id)`. Restore on error.

### Files touched
- `frontend/src/routes/courses.tsx` (~+80 lines)
- Possibly a new migration if the rule isn't present

### Estimated effort: 1.5–2h

---

## 2. Audio Player Bar — Mount & Integrate

### What exists today
- `frontend/src/components/layout/AudioPlayer.tsx` (114 lines, fully functional standalone): play/pause, ±10s skip, seek, speed cycling 0.5–2×, time display.
- `routes/lectures.$lectureId.tsx` loads a `Lecture` with an `audio_file` but does **not** render the player.
- `useTTS` hook is separate (text-to-speech for notes), not the player.

### What's missing
1. **The player isn't mounted anywhere.** It sits as dead code.
2. No persistent player — switching tabs in the lecture detail page (Transcript ↔ Notes ↔ Quiz) loses playback state.
3. No transcript-click-to-seek (transcript already exists but doesn't talk to audio).
4. Keyboard shortcuts (Space=play/pause, J/L=±10s, K=play/pause) are not wired.

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | Open lecture detail with `audio_file` set → player bar appears fixed at bottom | ✓ |
| 2 | Switching tabs (transcript → notes → quiz) keeps playback running and position | ✓ |
| 3 | Click a transcript paragraph → audio jumps to that paragraph's `start` timestamp | ✓ |
| 4 | Space toggles play/pause when not in input | ✓ |
| 5 | J / L skip ±10s | ✓ |
| 6 | Speed selector visible; 0.75× and 1.25× are the most useful for accessibility users | ✓ |
| 7 | Player gracefully hides on lectures with no audio (live-mode lecture, error state) | ✓ |
| 8 | Player doesn't block bottom-right floating accessibility button (z-index check) | ✓ |
| 9 | When `Reading Ruler` is enabled the ruler stays above the player bar visually | ✓ |

### Implementation
1. **Lift player state into a context** (`frontend/src/lib/audioPlayer.tsx`) so it survives tab swaps:
   ```ts
   interface AudioPlayerContextValue {
     src: string | null;
     title: string | null;
     currentTime: number;
     setSrc: (src: string | null, title?: string) => void;
     seek: (time: number) => void;
     togglePlay: () => void;
     playing: boolean;
     setRate: (rate: number) => void;
   }
   ```
   The provider mounts a single `<audio>` element offscreen and exposes refs.
2. Move `AudioPlayer.tsx` into a presentational component that **reads from context**, not props.
3. Mount `<AudioPlayer />` in `AppShell` (bottom of `<main>` tree, fixed-positioned). Render `null` when `src` is `null`.
4. In `routes/lectures.$lectureId.tsx`, on lecture load:
   ```ts
   const { setSrc } = useAudioPlayer();
   useEffect(() => {
     if (lecture?.audio_file) {
       setSrc(pb.files.getURL(lecture, lecture.audio_file), lecture.title);
     }
     return () => setSrc(null);
   }, [lecture]);
   ```
5. In `TranscriptViewer.tsx`, accept an optional `segments` prop with timestamps; wrap each paragraph in a `<button>` that calls `seek(segment.start)`.
6. Keyboard shortcuts via `useKeyboardShortcuts` hook (already exists in `hooks/`).
7. Z-index: AudioPlayer at `z-40`, accessibility button at `z-50` (already), reading ruler at `z-30`. AudioPlayer needs to be `z-40` and the page content gets `padding-bottom: 64px` when the player is mounted (use a CSS variable).

### Files touched
- `frontend/src/lib/audioPlayer.tsx` (new, ~120 lines)
- `frontend/src/components/layout/AudioPlayer.tsx` (~50-line refactor — move state to context)
- `frontend/src/components/layout/AppShell.tsx` (mount + provider, ~10 lines)
- `frontend/src/routes/lectures.$lectureId.tsx` (~15 lines)
- `frontend/src/components/workspace/TranscriptViewer.tsx` (~25 lines for click-to-seek)
- `frontend/src/main.tsx` (add `<AudioPlayerProvider>` outside `<PreferencesProvider>`)

### Estimated effort: 2.5–3h

---

## 3. Study Session Tracking

### What exists today
- `StudySession` type in `lib/types.ts:306` with all fields: `session_type` (`flashcard_review` | `quiz` | `pomodoro` | `free_study`), `lecture`, `cards_reviewed`, `cards_correct`, `duration_secs`, `started_at`, `ended_at`.
- `pb_migrations/1777500000_hackstack_collections.js` already creates the `study_sessions` collection (verify).
- Components that **could** write sessions but don't: `FlashcardDeck.tsx`, `QuizRunner.tsx`, `PomodoroTimer.tsx`.

### What's missing
- Zero rows ever written to `study_sessions`.
- No way to view past sessions.
- Streak feature (#4 below) depends on this.

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | Start a flashcard review → review N cards → finish: a session row appears in PocketBase with `session_type='flashcard_review'`, `cards_reviewed=N`, `duration_secs` set | ✓ |
| 2 | Mid-session abandon (close tab, navigate away): session is still saved with `ended_at = now`, partial cards counted | ✓ |
| 3 | Complete a quiz: row written with `session_type='quiz'`, `cards_correct = correctAnswers`, `cards_reviewed = totalQuestions` | ✓ |
| 4 | A finished Pomodoro: row written with `session_type='pomodoro'`, `duration_secs` = real elapsed (no mid-pause counted as study) | ✓ |
| 5 | Sessions are user-scoped (`user = current.id`); list rule = `user = @request.auth.id` | ✓ |
| 6 | The `lecture` field is optional (free_study has no lecture) | ✓ |

### Implementation
1. Add a hook `frontend/src/hooks/useStudySession.ts`:
   ```ts
   interface SessionDraft {
     session_type: SessionType;
     lecture?: string;
     cards_reviewed: number;
     cards_correct: number;
   }
   export function useStudySession() {
     return {
       start: (draft: SessionDraft) => string;          // returns sessionId
       update: (id: string, patch: Partial<SessionDraft>) => void;
       finish: (id: string, finalDraft: Partial<SessionDraft>) => void;
     };
   }
   ```
   - `start` records `started_at = now`, returns the new record id.
   - `finish` sets `ended_at = now`, computes `duration_secs = ended_at - started_at`.
   - `update` is incremental — used to bump `cards_reviewed` per card.
   - All writes are debounced (300ms) so we don't hammer PocketBase on each card.
   - On `beforeunload` / route leave, force-flush + finish.
2. Wire into `FlashcardDeck.tsx`: call `start` on first card render, `update` on each rate, `finish` on done.
3. Wire into `QuizRunner.tsx`: call `start` on quiz mount, `finish` on submit.
4. Wire into `PomodoroTimer.tsx`: call `start` on first run, `finish` on completion (not on pause).
5. Verify the migration creates `study_sessions` with the right rules. If it doesn't, add a new migration.
6. Add a `useRecentSessions` query for the streak feature (#4).

### Files touched
- `frontend/src/hooks/useStudySession.ts` (new, ~80 lines)
- `frontend/src/components/study/FlashcardDeck.tsx` (~15 lines)
- `frontend/src/components/study/QuizRunner.tsx` (~10 lines)
- `frontend/src/components/study/PomodoroTimer.tsx` (~10 lines)
- Possibly `backend/pb_migrations/177750xxxx_study_session_rules.js`

### Estimated effort: 2–3h

---

## 4. Study Streak

### What exists today
- `frontend/src/components/study/StudyStreak.tsx` (27 lines): pure UI, takes `streak: number` and `todayCompleted: boolean` as props.
- Not mounted anywhere.

### What's missing
- The hook that computes the streak from `study_sessions`.
- Integration with the Dashboard.
- A definition of "what counts as a study day."

### Definition of "study day"
A calendar day (in the user's local timezone) on which **at least one** `study_session` exists with `duration_secs >= 60` AND completed (`ended_at` not null). This filters out micro-sessions that don't represent real study.

A "streak" is the count of consecutive trailing days ending today (or yesterday if today is incomplete) that contain at least one qualifying session.

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | Brand new user → streak = 0, `todayCompleted = false` | ✓ |
| 2 | One session today (90s, completed) → streak = 1, `todayCompleted = true` | ✓ |
| 3 | Sessions on day-1, day-2, day-3 (today) → streak = 3 | ✓ |
| 4 | Sessions yesterday but not today → streak = 1, `todayCompleted = false` (still counts; user has until midnight) | ✓ |
| 5 | Gap in middle (day-1 + day-3 only) → streak = 1 (just today) | ✓ |
| 6 | Sessions across DST transition compute correctly in user's local time | ✓ |
| 7 | Streak ≥ 7 → "On fire" badge appears (already in component) | ✓ |
| 8 | Component on Dashboard above the recent-lectures grid | ✓ |

### Implementation
1. Add hook `frontend/src/hooks/useStudyStreak.ts`:
   ```ts
   export function useStudyStreak(): { streak: number; todayCompleted: boolean; loading: boolean } {
     const { user } = useAuth();
     // 1. Fetch last 60 days of completed sessions for this user
     //    pb.collection('study_sessions').getList(1, 200, {
     //      filter: `user = "${user.id}" && duration_secs >= 60 && ended_at != ""`,
     //      sort: '-ended_at',
     //    })
     // 2. Group by local-date (Intl.DateTimeFormat with user's tz)
     // 3. Walk back from today; count consecutive days.
     // 4. Return { streak, todayCompleted, loading }
   }
   ```
2. Mount `<StudyStreak streak={streak} todayCompleted={todayCompleted} />` at the top of `routes/index.tsx` Dashboard.
3. Loading state: render the component with greyed values (the existing styling already handles `streak === 0`).
4. Realtime: optionally subscribe to `study_sessions` so finishing a session today bumps the streak without reload.

### Files touched
- `frontend/src/hooks/useStudyStreak.ts` (new, ~50 lines)
- `frontend/src/routes/index.tsx` (mount component, ~10 lines)

### Estimated effort: 1.5–2h (depends on #3 being done first)

---

## 5. Responsive Design Pass

### What exists today
- App is desktop-first. Sidebar at `w-56` collapsing to `w-16`. No mobile nav.
- A few `md:` Tailwind classes scattered (e.g., `routes/courses.tsx:155 md:grid-cols-2`).
- One stale `@media (max-width: 768px)` rule in `app.css` that hides `.sidebar-desktop` (no element actually has that class).

### What's missing
- **Sidebar takes too much width on phones (224px on a 375px screen = unusable).**
- Pages with grids assume 2 columns at md+ but never collapse padding/typography.
- Topbar is fine but the user-menu dropdown can clip off-screen.
- Modals (A11yPanel) are fine because of `max-w-md` (already responsive).
- Audio player bar at the bottom (once #2 is mounted) needs to wrap on narrow screens.

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | iPhone 12 (390×844) — Dashboard visible, no horizontal scroll | ✓ |
| 2 | <768px — sidebar collapses to a bottom nav (icons only) OR a top hamburger that opens an overlay | ✓ |
| 3 | Page padding shrinks: `p-6` → `p-4` on small screens | ✓ |
| 4 | Course/lecture grids: 1 col on mobile, 2 on tablet, 3 on desktop | ✓ |
| 5 | A11yPanel slide-in is fullscreen on phones (already `max-w-md` but ensure 100vw fallback) | ✓ |
| 6 | Audio player bar reflows: time labels hide on <640px, only essentials show | ✓ |
| 7 | All interactive elements ≥ 44×44px tap target | ✓ |
| 8 | Reading ruler & focus mode still work; the dim overlay should not block taps on small screens | ✓ |

### Implementation
**Pick one of two patterns** for the mobile sidebar — the spec recommends **(B)** for HackStack:

(A) Hamburger + slide-out overlay: classic, more code.

(B) Bottom nav bar with the same icons: native-app feel, simpler, single new component.

Going with (B):

1. Hide desktop sidebar on `<lg` (`hidden lg:flex`).
2. Add a new `<MobileNav />` component, fixed bottom, full width, 5 icons (Dashboard / Capture / Courses / Study / Settings). Visible only on `<lg` (`lg:hidden`).
3. Page content gets `padding-bottom: 56px` on mobile so the nav doesn't cover content.
4. AudioPlayer (#2) on mobile: hide skip-back/forward labels, hide speed/volume; show only play/pause + scrubber. Use `sm:` breakpoints.
5. Adjust generic page padding in routes: `p-6 lg:p-8` → `p-4 sm:p-6 lg:p-8`.
6. Adjust grids globally: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for cards.
7. Make sure all `<button>`s have `min-h-[44px]` on mobile (Tailwind: `min-h-11 sm:min-h-0`).
8. Test under Chrome DevTools responsive: 375×667 (iPhone SE), 390×844 (iPhone 12), 768×1024 (iPad), 1440×900 (laptop).

### Files touched
- `frontend/src/components/layout/AppShell.tsx` (hide sidebar on mobile, ~10 lines)
- `frontend/src/components/layout/MobileNav.tsx` (new, ~80 lines)
- `frontend/src/app.css` (cleanup the stale `.sidebar-desktop` rule, possibly add base mobile-friendly defaults)
- Most route files: small padding/grid tweaks
- `frontend/src/components/layout/AudioPlayer.tsx` (responsive variant)

### Estimated effort: 3h

---

## 6. Demo Data Seeding

### Why it matters for the hackathon demo
Walking up to the judge with an empty Dashboard kills the pitch. We need a one-click "load demo content" so any fresh login shows: 3 courses, 5 lectures (with transcripts, notes, flashcards, quizzes), a study streak of 5 days, and a few completed quiz attempts.

### What exists today
- Nothing.

### Acceptance criteria
| # | Test | Pass |
|---|---|---|
| 1 | Run `cd backend && ./pocketbase migrate up` (or hit a dev-only seed endpoint) → demo data appears for the *demo* user | ✓ |
| 2 | Demo user: `demo@hackstack.dev` / `demohackstack` (auto-created if missing) | ✓ |
| 3 | 3 demo courses with realistic names: "Biology 201", "Intro to Cognitive Science", "Linear Algebra 1B" | ✓ |
| 4 | 5 demo lectures distributed across courses, each with `audio_file = null` (no real audio asset) but full `Transcript`, `Note`, 12 `Flashcard`s, and one `Quiz` with 8 questions | ✓ |
| 5 | 5 days of `study_sessions` so the streak component shows "5 days — On fire" path is testable (set sessions with `started_at` shifted by N days) | ✓ |
| 6 | Seed is idempotent — running it twice does not duplicate rows; uses deterministic IDs or upsert-by-name | ✓ |
| 7 | Seed runs both via PB migration **and** via a `frontend/scripts/seed.ts` Node script using the JS SDK (so a teammate can reseed without restarting backend) | ✓ |

### Implementation
**Two surfaces — both share the same dataset module:**

1. **Dataset module** `backend/seed/demo-data.js` — a plain JS object exporting:
   ```js
   export const demoData = {
     users: [{ email: 'demo@hackstack.dev', password: 'demohackstack', display_name: 'Demo Student' }],
     courses: [...],
     lectures: [...],
     transcripts: [...],
     notes: [...],
     flashcards: [...],
     quizzes: [...],
     study_sessions: [...],
   };
   ```
   Each row has a deterministic `id` (e.g., `demo_course_bio201`, `demo_lecture_bio201_w1`).

2. **PocketBase migration** `backend/pb_migrations/1777600000_demo_seed.js`:
   - Reads `demo-data.js`.
   - For each row: try `app.findRecordById(collection, id)` → if missing, create; if present, skip.
   - Wraps everything in `app.runInTransaction` so a partial failure rolls back.

3. **Node seed script** `frontend/scripts/seed.ts`:
   - Auths as superuser (env var: `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
   - Walks the same dataset and upserts.
   - Adds a `package.json` script: `"seed": "tsx scripts/seed.ts"`.

4. **Realistic content**: pick 5 ~10-minute lectures from public-domain transcripts (e.g., MIT OCW intro chapters trimmed to a few paragraphs). Generate notes/cards/quizzes by hand once, then they're constant.

5. **Study sessions for the streak**: insert 5 `study_sessions` with `started_at` = today minus 0,1,2,3,4 days. `duration_secs = 1200` (20 min) each. `cards_reviewed = 15`, `cards_correct = 12`.

### Files touched
- `backend/seed/demo-data.js` (new, ~250 lines of JSON-y data)
- `backend/pb_migrations/1777600000_demo_seed.js` (new, ~80 lines)
- `frontend/scripts/seed.ts` (new, ~120 lines)
- `frontend/package.json` (1 script entry)

### Estimated effort: 3–4h (most of it is content authoring)

---

## Suggested ordering for two parallel teammates

| Slot | Person A | Person B |
|---|---|---|
| Hour 0–2 | #1 Course Edit | #6 Demo Data (start content authoring) |
| Hour 2–5 | #2 Audio Player Bar | #6 Demo Data (finish + migration) |
| Hour 5–7 | #3 Session Tracking | #5 Responsive Pass |
| Hour 7–9 | #4 Study Streak (depends on #3) | #5 Responsive Pass (cont.) |

Total ≈ 9 hours of work split two ways. With the demo-day buffer, that's a single intense day.

---

## Cross-cutting concerns (apply to every feature)

- **Auth**: every fetch must filter by `user = @request.auth.id`. PocketBase rules already enforce this on the server side; frontend filter is for ergonomics.
- **Loading + empty + error states**: don't ship a feature with only the happy path. Each list should have a loading skeleton + empty CTA + error toast.
- **Accessibility**: every new button needs `aria-label` if icon-only; every new form input needs a `<label>`; keyboard navigation must work (`Tab` order + `Esc` to close modals).
- **Reading aids respected**: the new components should respect `data-focus-zone` markers — don't accidentally dim a fixed sidebar via global selectors.
- **TypeScript**: no `any`, no unsafe non-null assertions, public types exported from `lib/types.ts`.
- **Type-check before commit**: `cd frontend && npx tsc --noEmit` must pass.
- **Verify in browser**: type-check ≠ feature works. Open the route, click the buttons.

## Out-of-scope (explicit)

- Mobile-app builds (Capacitor / native).
- Offline-first / PWA.
- Course archive / soft-delete.
- Multi-user collaboration on a course or lecture.
- Subscription / billing.
- Email digests of streak status.
