# HackStack E2E Test Plan

**Date**: 2026-05-02  
**App**: HackStack — lecture capture, transcript, study tools, accessibility toolkit  
**Base URL**: `http://localhost:5173` (Vite dev) / `http://localhost:3000` (production build)  
**PocketBase**: `http://localhost:8090`

---

## Tooling Stack Recommendation

### Playwright Configuration

```ts
// playwright.config.ts (place at repo root: /SwanHacksSpring2026/playwright.config.ts)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Grant mic + camera automatically — required for Capture journey
    permissions: ['microphone', 'camera'],
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    // Safari / webkit needed for MediaRecorder API coverage
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Spin up Vite + PocketBase before the suite
  webServer: [
    {
      command: 'cd frontend && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend && ./pocketbase serve',
      url: 'http://localhost:8090',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

### Page Object Map

Place POM files in `e2e/pages/`:

| POM File | Wraps |
|---|---|
| `LoginPage.ts` | `/login` — form, submit, toggle signup |
| `DashboardPage.ts` | `/` — stat cards, quick actions, recent lectures list |
| `CapturePage.ts` | `/capture` — RecordButton, LiveCaptions, ProcessingStatus |
| `UploadPage.ts` | `/capture/upload` — FileUpload, ProcessingStatus |
| `LecturePage.ts` | `/lectures/:id` — tabs, transcript, notes, flashcard deck, quiz runner |
| `CoursesPage.ts` | `/courses` — create/edit/delete forms |
| `StudyPage.ts` | `/study` — hub cards; `/study/flashcards` — deck |
| `SettingsPage.ts` | `/settings` — Canvas connect |
| `A11yPanel.ts` | Floating button + sliding panel |

---

## Mock Layer

### What Cannot Run in Real CI and Why

| System | Blocker | Mock Strategy |
|---|---|---|
| Deepgram WebSocket (live STT) | Requires real mic audio stream hitting `wss://api.deepgram.com` with a live API key | Intercept `useDeepgramSTT`'s WebSocket with Playwright's `page.routeWebSocket()`. Return a scripted sequence of final-caption JSON frames, e.g. `{"channel":{"alternatives":[{"transcript":"Mitochondria are the powerhouse","is_final":true}]}}`. |
| OpenAI Whisper API (upload path) | Costs money; network-dependent | `page.route('https://api.openai.com/v1/audio/transcriptions', ...)` returning `{ text: "Test lecture transcript." }`. |
| Claude API / `runPipeline()` (notes, flashcards, quiz generation) | Unpredictable latency, costs tokens | `page.route('**/api/v1/messages', ...)` or intercept the PocketBase hook endpoint that triggers the pipeline. Return a deterministic JSON fixture with 3 notes, 6 flashcards, 4 quiz questions. |
| MediaPipe Hands (webcam, ASL detection) | Requires real camera + loaded WASM; fails headless | Stub `navigator.mediaDevices.getUserMedia` to return a blank `MediaStream`. Stub `useMediaPipeHands` to expose a no-op `initialize/start/stop`. Inject `page.addInitScript()` to mock the MediaPipe module before app boots. |
| Browser mic permission dialog | System dialog; not Playwright-controllable via UI | Use `permissions: ['microphone']` in `playwright.config.ts` — grants automatically. Then stub `getUserMedia` to return a synthetic `AudioContext`-based stream so `MediaRecorder` gets real data without a physical mic. |

### Fake Audio Stream Helper (`e2e/helpers/fakeAudio.ts`)

```ts
export async function injectFakeAudioStream(page: Page) {
  await page.addInitScript(() => {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    osc.connect(dest);
    osc.start();
    // Override getUserMedia to always resolve with the synthetic stream
    navigator.mediaDevices.getUserMedia = async () => dest.stream;
  });
}
```

### Deepgram WebSocket Mock (`e2e/helpers/mockDeepgram.ts`)

```ts
export async function mockDeepgramSTT(page: Page, phrases: string[]) {
  await page.routeWebSocket(/api\.deepgram\.com/, (ws) => {
    let i = 0;
    const send = () => {
      if (i >= phrases.length) return;
      ws.send(JSON.stringify({
        channel: { alternatives: [{ transcript: phrases[i++], is_final: true }] }
      }));
      if (i < phrases.length) setTimeout(send, 1200);
    };
    ws.onmessage = () => setTimeout(send, 500);
  });
}
```

---

## Demo Data Dependency

All journeys that assert on real data (Lecture Review, Study Session, Quiz, Streak) depend on the demo seed being applied first. Run before the suite:

```bash
cd frontend && npm run seed
# or: cd backend && ./pocketbase migrate up
```

This creates demo user `demo@hackstack.dev` / `demohackstack` with 3 courses, 5 lectures (full transcripts, notes, 12 flashcards each, 8-question quizzes), and 5 days of `study_sessions`.

For journeys that create new data (Onboarding, Capture), use a **separate fresh user** created per-test via PocketBase Admin API to avoid state bleed.

---

## Per-Journey Test Cases

---

### Journey 1: Onboarding

**Preconditions**: No existing user; PocketBase running; no auth cookies.

**Steps and Assertions**:

1. Navigate to `/`.  
   Assert: Landing page renders — `getByRole('heading', { name: /Record lectures/i })` is visible. "Sign up free" link is present.

2. Click `getByRole('link', { name: /sign up free/i })`.  
   Assert: URL is `/login`. Form heading reads "Create account" is **not** yet shown; default is "Welcome back" (isSignup = false by default).

3. Click `getByRole('button', { name: /sign up/i })` (the toggle below the form).  
   Assert: Heading changes to "Create account". Submit button text becomes "Create account".

4. Fill `getByLabel(/email/i)` with `newuser+{timestamp}@test.com`.  
   Fill `getByLabel(/password/i)` with `testpass99`.  
   Click `getByRole('button', { name: /create account/i })`.  
   Assert: No error banner. URL redirects to `/`. Dashboard greeting `getByRole('heading', { level: 1 })` contains the email prefix.

5. Assert: "No lectures yet" empty state is visible inside the Recent Lectures card (`getByText(/no lectures yet/i)`). "No courses yet" is visible in the Courses card.

6. Click `getByRole('link', { name: /manage/i })` (Courses card).  
   Assert: URL is `/courses`. Empty state `getByText(/no courses yet/i)` visible.

7. Click `getByRole('button', { name: /add course/i })`.  
   Assert: Create form appears with "Course name" input.

8. Fill course name input with "Biology 201". Fill code with "BIO 201". Fill semester with "Spring 2026".  
   Click `getByRole('button', { name: /create course/i })`.  
   Assert: Form closes. Course card with text "Biology 201" appears in the grid.

9. Click the course card link for "Biology 201".  
   Assert: URL is `/courses/{id}`. Empty lecture list shown.

10. Click sidebar nav item "Capture" (or `getByRole('link', { name: /capture/i })`).  
    Assert: URL is `/capture`. `getByRole('heading', { name: /record lecture/i })` visible. RecordButton is rendered.

**Acceptance**: PASS if all 10 assertions green.  
**Tooling note**: No mic/audio needed for this journey. Steps 1–10 are pure UI.

---

### Journey 2: Capture — Live Recording

**Preconditions**: Logged-in user (fresh). Fake audio stream injected via `injectFakeAudioStream()`. Deepgram WebSocket mocked via `mockDeepgramSTT()` with phrases `["Mitochondria are the powerhouse of the cell.", "ATP is synthesized in the inner membrane."]`. Claude/pipeline response mocked to return 3 notes + 6 flashcards + 4 quiz questions.

**Steps and Assertions**:

1. Call `injectFakeAudioStream(page)` before navigation.  
   Call `mockDeepgramSTT(page, phrases)`.  
   Navigate to `/capture`.

2. Assert: RecordButton present. No processing banner visible.

3. Click `getByRole('button', { name: /start recording|record/i })`.  
   Assert: Recording timer appears (`getByText(/\d\d:\d\d/)`). Red pulsing indicator visible. STT status shows "STT Connected" (green mic icon).

4. Wait 3 seconds (mock captions should appear).  
   Assert: LiveCaptions area contains "Mitochondria are the powerhouse" text.

5. Click `getByRole('button', { name: /stop/i })`.  
   Assert: Recording controls disappear. `ProcessingStatus` component appears — first stage "transcribing" is active.

6. Wait for pipeline mock to resolve (intercept `runPipeline` or wait for PB write).  
   Assert: Stage cycles through "cleaning", "notes", "flashcards", "quiz", then reaches "done".

7. Assert (optional redirect if wired): URL changes to `/lectures/{newId}` OR a success message with a link to the lecture appears.

**Acceptance**: PASS if captions appear and pipeline stage sequence completes.  
**Tooling note**: Steps 1, 3, 5 require `injectFakeAudioStream` + Deepgram WS mock. Real mic is NOT needed. `MediaRecorder` will encode the synthetic oscillator stream into a valid `.webm` blob, satisfying `audio.audioBlob` check in `capture.tsx:97`.

---

### Journey 3: Capture — Upload

**Preconditions**: Logged-in user. Whisper API mocked (`page.route('https://api.openai.com/v1/audio/transcriptions', ...)`). `VITE_OPENAI_API_KEY` set to `"test-key"` via env override or `page.addInitScript`. Pipeline mocked.

**Steps and Assertions**:

1. Mock Whisper route to return `{ text: "Cell division occurs in prophase, metaphase, anaphase, and telophase." }`.  
   Navigate to `/capture/upload`.

2. Assert: `getByRole('heading', { name: /upload audio/i })` visible. FileUpload dropzone present.

3. Create a 5-second synthetic WAV file in the test fixture (`e2e/fixtures/short-lecture.mp3`). Set it via `page.setInputFiles('[type="file"]', 'e2e/fixtures/short-lecture.mp3')` or drag-drop simulation.  
   Assert: Progress bar fills to 100%.

4. Assert: Pipeline stage "transcribing" appears, then "cleaning", ..., "done".

5. Navigate to `/courses` and then to any lecture.  
   Assert: Lecture with title matching the filename (without extension) exists.

**Acceptance**: PASS if pipeline completes without error banner.  
**Tooling note**: No mic needed. Whisper route intercepted at the network level. `VITE_OPENAI_API_KEY` must be set in env or injected via `addInitScript(() => { import.meta.env.VITE_OPENAI_API_KEY = 'test-key'; })` — note Vite bakes env vars at build time, so the preferred approach is providing a `.env.test` with a non-null dummy value and mocking the fetch route in Playwright.

---

### Journey 4: Lecture Review — Tabs, Audio Player, TTS

**Preconditions**: Demo seed applied. Demo lecture `demo_lecture_bio201_w1` exists with full transcript, notes, flashcards, quiz. Logged in as `demo@hackstack.dev`.

**Steps and Assertions**:

1. Navigate to `/lectures/demo_lecture_bio201_w1`.  
   Assert: `getByRole('heading', { level: 1 })` shows lecture title. Four tab buttons visible: Transcript, Notes, Flashcards, Quiz.

2. Assert default tab is "Transcript" — tab button has `border-indigo-500` active class OR `aria-selected="true"` (if implemented). Transcript text is visible in the content area.

3. Click `getByRole('button', { name: /notes/i })`.  
   Assert: Tab switches. Notes content area is visible (NoteEditor rendered).

4. Click `getByRole('button', { name: /flashcards/i })`.  
   Assert: FlashcardDeck renders — front of a flashcard is visible. Not the "No flashcards generated" empty state.

5. Click `getByRole('button', { name: /quiz/i })`.  
   Assert: QuizRunner renders — first quiz question is visible.

6. Switch back to "Transcript" tab.  
   Assert: Transcript content still present (no reload needed).

**Audio player (conditional — only when feature is shipped per remaining-features-spec.md #2)**:

7. Assert: Audio player bar is fixed at bottom of viewport (verify `position: fixed` via computed style or locate `[data-testid="audio-player"]`).  
8. Press `Space`.  
   Assert: Play state toggles (play/pause icon changes).  
9. Press `j`.  
   Assert: Current time decreases by ~10s.  
10. Click a transcript paragraph.  
    Assert: Audio `currentTime` jumps to that segment's start timestamp (read via `page.evaluate(() => document.querySelector('audio').currentTime)`).

**TTS (Notes tab)**:

11. Switch to Notes tab. Toggle TTS enable in A11yPanel (open panel → toggle "Enable TTS").  
    Assert: Clicking on a note block triggers `window.speechSynthesis.speak()`. Stub `speechSynthesis.speak` with `page.addInitScript` and verify it was called.

**Acceptance**: PASS if tabs 1–5 all render correct content. Audio player steps 6–10 marked as SKIP until feature ships.  
**Tooling note**: Audio player steps need `page.evaluate()` to read `HTMLAudioElement.currentTime`. No real audio file needed — `audio_file` is null in demo data; player should hide gracefully (acceptance criterion #7 in remaining-features-spec.md).

---

### Journey 5: Study Session — Flashcard Review

**Preconditions**: Demo seed applied with flashcards having `next_review <= now`. Logged in as `demo@hackstack.dev`.

**Steps and Assertions**:

1. Navigate to `/study/flashcards`.  
   Assert: `getByRole('heading', { name: /flashcard review/i })` visible. Front face of first card visible (not loading state, not "No cards due").

2. Assert: Card count indicator or progress indicator is visible.

3. Click `getByRole('button', { name: /show answer/i })` or flip trigger.  
   Assert: Back face of the card (answer text) is now visible.

4. Click rating button for "Good" (or equivalent — likely `getByRole('button', { name: /good/i })`).  
   Assert: Next card appears (different front text). PocketBase `flashcards` record updated (verify via PB Admin API call in `afterEach` or intercept the PATCH request: `page.waitForResponse(r => r.url().includes('/api/collections/flashcards/records/'))`).

5. Rate all remaining cards (loop through). On the last card, click "Again" or any rating.  
   Assert: Session complete state renders — `getByText(/session complete|all done|no cards due/i)` visible.

6. Navigate to Dashboard (`/`).  
   Assert: Streak value on Dashboard stat card is not "0 days" (once study streak feature ships). Until then, assert that "Due Today" stat reflects reduced count.

**Acceptance**: PASS if cards flip, ratings are accepted, and session-complete state is reached.  
**Tooling note**: Study session writes to PocketBase (`study_sessions`) — verify with a PB API call in test teardown once the `useStudySession` hook is wired (remaining-features-spec.md #3). Until then, assert only on UI state.

---

### Journey 6: Quiz — Take and Submit

**Preconditions**: Demo seed applied. Demo lecture has a quiz with 8 questions. Logged in as `demo@hackstack.dev`.

**Steps and Assertions**:

1. Navigate to `/lectures/demo_lecture_bio201_w1`. Click "Quiz" tab.  
   Assert: QuizRunner renders. First question text is visible.

2. Select an answer for question 1 (`getByRole('radio')` or `getByRole('button')` depending on question type).  
   Assert: Selection is visually confirmed (checked state or highlighted button).

3. Click "Next" or answer remaining questions (loop).  
   Assert: Progress indicator advances.

4. On the last question, click `getByRole('button', { name: /submit|finish/i })`.  
   Assert: Results screen appears. Score is displayed (e.g. "6 / 8 correct" or percentage).

5. Assert: No console errors during submission. PocketBase `quiz_attempts` record written (verify via `page.waitForResponse(r => r.url().includes('quiz_attempts'))`).

**Note on standalone quiz route**: `/study/quiz/$quizId` currently renders "Coming soon". This journey goes through the lecture detail page's QuizRunner tab, which is fully implemented. Mark the standalone route as SKIP.

**Acceptance**: PASS if quiz completes and result screen renders.  
**Tooling note**: Pure UI + PocketBase writes. No external API mocking needed.

---

### Journey 7: Accessibility — A11y Panel Full Flow

**Preconditions**: Logged in. Any page with `[data-focus-zone]` content visible (Dashboard or a lecture detail page with transcript). Demo data seeded so transcript text is present.

**Steps and Assertions**:

**Panel open/close**:

1. Assert: Floating accessibility button present at bottom-right (`getByRole('button', { name: /accessibility settings/i })`). `aria-expanded="false"`.

2. Click the floating button.  
   Assert: A11y panel slides in from right. `getByRole('heading', { name: /accessibility/i })` visible. `aria-expanded="true"` on the button.

3. Press `Escape`.  
   Assert: Panel closes. `aria-expanded="false"`.

**Theme**:

4. Click the floating button to reopen.  
   Find the Theme `<select>` (`getByRole('combobox', { name: /theme/i })` or locate by label text "Theme").  
   Select "High Contrast".  
   Assert: `document.documentElement` has class `theme-high-contrast` (or equivalent data attribute applied by `applyToDOM` in `lib/preferences.tsx`).

**Font**:

5. Find the Font `<select>`. Select "OpenDyslexic".  
   Assert: `document.body` has class `font-opendyslexic` (or CSS var `--font-family` is set to OpenDyslexic).

**Reading Ruler — bar mode**:

6. Find the "Reading Ruler (Alt+R)" `<select>`. Select "Bar".  
   Assert: `.reading-ruler-bar` element appears in DOM with `position: fixed` and `pointer-events: none`.

7. Trigger `mousemove` on the page at `{ x: 400, y: 300 }` via `page.mouse.move(400, 300)`.  
   Assert: Ruler element's `top` CSS value is approximately `300 - rulerHeight/2` pixels.

**Reading Ruler — window mode**:

8. Change "Reading Ruler" select to "Window".  
   Assert: `.reading-ruler-window-above` and `.reading-ruler-window-below` elements are in the DOM.

**Focus Mode — paragraph**:

9. Change "Focus Mode (Alt+F)" select to "Paragraph".  
   Close panel (click X or press Escape).  
   Navigate to lecture transcript.  
   Hover over a paragraph inside `[data-focus-zone]`.  
   Assert: Hovered `<p>` has class `focus-highlight`. Sibling `<p>` elements have `opacity: 0.35` (read via `getComputedStyle`).  
   Assert: Sidebar does NOT have `opacity: 0.35`.

**Focus Mode — sentence**:

10. Open A11yPanel. Change "Focus Mode" to "Sentence". Close panel.  
    Hover over a paragraph in the transcript.  
    Assert: Individual sentence `<span>` elements are generated inside the hovered `<p>`. Hovered sentence has `focus-highlight` class.

**Keyboard shortcuts**:

11. Ensure Focus Mode is currently "sentence". Press `Alt+R`.  
    Assert: Reading Ruler cycles to next mode (off → bar or bar → window depending on current state). A toast or ARIA live region briefly announces the new mode.

12. Press `Alt+F`.  
    Assert: Focus Mode cycles to next mode.

13. Focus a text `<input>` on any form. Press `Alt+R`.  
    Assert: Reading Ruler mode does NOT change (shortcuts blocked inside inputs).

**Esc closes panel**:

14. Click floating button. Panel opens. Press `Escape`.  
    Assert: Panel is closed (not in DOM or `isOpen = false`).

**Acceptance**: PASS on all 14 checks.  
**Tooling note**: CSS computed style assertions use `page.evaluate(() => getComputedStyle(document.querySelector('.reading-ruler-bar')).pointerEvents)`. Mouse move for ruler position uses `page.mouse.move()`. Keyboard shortcuts use `page.keyboard.press('Alt+KeyR')`.

---

### Journey 8: Canvas Integration

**Preconditions**: Logged in as `demo@hackstack.dev`. Canvas LMS accessible at a test institution URL (or Canvas API mocked). Note: this journey is partially gated on the Canvas branch being fully merged.

**Steps and Assertions**:

1. Navigate to `/settings`.  
   Assert: "Canvas LMS" card visible with "Import" button. Status shows "not connected".

2. Click `getByRole('button', { name: /import/i })`.  
   Assert: Three-step form expands. Step 1 shows a script block. "Copy" button visible.

3. Click `getByRole('button', { name: /copy/i })`.  
   Assert: Button text changes to "Copied!" briefly.

4. For CI: Paste a pre-baked JSON fixture (matching the Canvas export format) into the textarea (`getByRole('textbox')` or `getByPlaceholderText(/paste/i)`).  
   Click `getByRole('button', { name: /import/i })` (submit button).  
   Assert: `syncing` state shows "Importing...". On success: "Canvas Connected" state renders with `CheckCircle` icon.

5. Navigate to Dashboard (`/`).  
   Assert: "Upcoming Assignments" section (`getByRole('heading', { name: /upcoming assignments/i })`) renders with at least one assignment row from the fixture data.

6. Return to Settings. Click "Disconnect".  
   Assert: Panel reverts to "Import" button state. Dashboard assignments list shows empty state.

**Acceptance**: PASS if connect → assignments appear → disconnect cycle works.  
**Tooling note**: The actual clipboard-based Canvas import cannot run in CI headlessly. Mock `navigator.clipboard.writeText` with `page.addInitScript`. For the JSON paste step, inject the fixture text directly — no real Canvas server needed.

---

### Journey 9: Mobile — Responsive Layout

**Preconditions**: Playwright project `mobile-chrome` (Pixel 5, 393×851). Demo seed applied. Logged in.

**Steps and Assertions**:

1. Navigate to `/`. Viewport is 393×851.  
   Assert: No horizontal scrollbar — `page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)` returns `true`.

2. Assert: Desktop sidebar is NOT visible (width 224px sidebar is hidden at `<lg`). `getByRole('navigation', { name: /sidebar/i })` either absent or has `display: none`.

3. Assert (once MobileNav ships — remaining-features-spec.md #5): Bottom nav bar is visible — `getByRole('navigation')` with 5 icon links is at the bottom of the viewport. Specifically check `getByRole('link', { name: /dashboard/i })`, `/capture/`, `/courses/`, `/study/`, `/settings/`.

4. Navigate to `/courses` via bottom nav.  
   Assert: Course grid is 1-column (not 2-column). Course cards fill the full viewport width minus padding.

5. Navigate to `/study/flashcards`.  
   Assert: Flashcard deck renders. Buttons are at least 44×44px tap targets (check via `boundingBox().height >= 44`).

6. Open A11y panel (click floating accessibility button).  
   Assert: Panel covers the full viewport width (100vw) on mobile — `getByRole('dialog')` or the panel div has width >= 390px.

7. Navigate to `/lectures/demo_lecture_bio201_w1`.  
   Assert (once Audio Player ships): Player bar hides skip labels and speed selector on narrow screen — time labels are not visible. Only play/pause and scrubber are shown.

8. Verify Reading Ruler still works on mobile: Open A11yPanel, enable ruler "bar".  
   Move pointer (touch simulation): `page.touchscreen.tap(200, 400)`.  
   Assert: Ruler element is in DOM (visual overlay does not block taps).

**Acceptance**: PASS on steps 1–6. Steps 3, 7 are SKIP until MobileNav and Audio Player ship.  
**Tooling note**: Use `page.setViewportSize({ width: 393, height: 851 })` if not using the mobile-chrome device preset. All assertions are CSS/layout only — no audio hardware needed.

---

### Journey 10: Persistence — Preferences Survive Reload and Cross-Device

**Preconditions**: Logged in as `demo@hackstack.dev`. PocketBase user record exists.

**Part A — localStorage survival across reload**:

1. Open A11y panel. Change Theme to "Sepia". Change Font to "Atkinson Hyperlegible". Enable "Reduced Motion".  
   Assert: DOM reflects changes (`theme-sepia` class on root, font class applied).

2. Call `page.reload()`.  
   Assert: After reload, `document.documentElement` still has `theme-sepia` class. Font class is still applied. "Reduced Motion" toggle is still `aria-checked="true"` in the panel.

**Part B — PocketBase sync (prefs survive cross-device login)**:

3. Open a **second browser context** (`browser.newContext()`) — simulates a different device.  
   Log in as `demo@hackstack.dev` in the second context.  
   Navigate to `/`.  
   Assert (if PocketBase pref sync is implemented in `lib/preferences.tsx`): Theme is "Sepia" in the second context without manually setting it — prefs were loaded from PocketBase on login.

4. In the second context, change Theme to "Dark". Reload the first context.  
   Assert: First context picks up "Dark" theme (PocketBase is source of truth). If only localStorage is used, assert the second context stored the change and a manual re-login on the first context would pick it up.

**Reading Ruler persistence**:

5. Enable Reading Ruler "window" mode. Reload page.  
   Assert: Reading Ruler is still "window" — `.reading-ruler-window-above` is in the DOM.

**Acceptance**: PASS if Part A (localStorage reload) works. Part B grade is CONDITIONAL on PocketBase pref sync being implemented (not yet confirmed in current code — `lib/preferences.tsx` not fully read, but PB sync is specified in reading-ruler-focus-mode-spec.md #5.1).  
**Tooling note**: `browser.newContext()` is native Playwright — no extra setup.

---

## What Is NOT Testable in CI

| Feature | Why Untestable | Mitigation |
|---|---|---|
| Live Deepgram WebSocket streaming | Requires billing API key; WS traffic to external domain; flaky on network latency | Mock with `page.routeWebSocket()` returning scripted JSON frames (see Mock Layer above) |
| OpenAI Whisper API (upload path) | Real file transcription costs tokens; rate-limited | Mock `fetch` to `api.openai.com/v1/audio/transcriptions` returning a fixture string |
| Claude API via `runPipeline()` | Variable latency, costs tokens, non-deterministic output breaks assertions | Mock the PocketBase hook endpoint or `runPipeline()` module to return a static fixture |
| MediaPipe Hands / webcam ASL detection | WASM model not loaded headlessly; `getUserMedia` requires real camera permission dialog | Stub `useMediaPipeHands` hook via `page.addInitScript` to no-op; stub `getUserMedia` to return blank stream |
| Physical microphone audio quality | Automated runners have no mic; captured audio is silence | Use synthetic `AudioContext` oscillator stream (see `injectFakeAudioStream` helper) |
| Real Canvas LMS login and data fetch | External service; no test tenant; script runs inside Canvas browser context | Pre-bake JSON fixture matching Canvas export format; inject via textarea paste step |
| Browser permission dialogs | OS-level; cannot be Playwright-clicked | Pre-grant via `permissions: ['microphone', 'camera']` in Playwright config |
| `speechSynthesis` TTS audio output | No audio hardware in CI; `speak()` fires but produces no sound | Stub `window.speechSynthesis.speak` with `addInitScript` and assert it was called; skip audio output assertion |
| Reading Ruler visual rendering accuracy | Pixel-level CSS rendering varies by OS/GPU | Assert DOM element presence and `top` property within ±20px tolerance; skip pixel-perfect screenshot diffs |

---

## CI Matrix

| Journey | Runs in CI | Trigger | Notes |
|---|---|---|---|
| 1 — Onboarding | Yes | Every PR | No mocks needed beyond PB |
| 2 — Capture Live | Yes (mocked) | Every PR | Deepgram WS mock + fake audio |
| 3 — Capture Upload | Yes (mocked) | Every PR | Whisper + pipeline mock |
| 4 — Lecture Review (tabs) | Yes | Every PR | Demo seed required |
| 4 — Lecture Review (audio player) | Skip until shipped | Post-merge | Needs Audio Player feature (#2) |
| 5 — Study Session | Yes | Every PR | Demo seed; PB write verified |
| 6 — Quiz | Yes | Every PR | Demo seed required |
| 7 — A11y Panel | Yes | Every PR | CSS computed style assertions |
| 8 — Canvas Integration | Yes (mocked) | Every PR | JSON fixture paste; no real Canvas |
| 9 — Mobile Layout | Yes | Every PR | Pixel 5 viewport; layout only |
| 10 — Persistence (Part A) | Yes | Every PR | localStorage only |
| 10 — Persistence (Part B) | Manual only | Pre-release | Requires PB pref sync to ship |

**CI environment requirements**: Node 20, Playwright browsers installed (`npx playwright install --with-deps chromium`), PocketBase binary in `backend/`, demo seed script available as `npm run seed`.

---

## Critical-Path Smoke Test (5-Minute Pre-Demo Run)

Run only these 5 tests before a demo to verify the app is alive:

```bash
npx playwright test --grep "@smoke" --project=chromium
```

Tag these tests with `@smoke` in the test title:

| # | Test | Expected Duration | Covers |
|---|---|---|---|
| S1 | `@smoke: landing → signup → dashboard empty state` | 30s | Auth + routing |
| S2 | `@smoke: create course → card appears` | 20s | PocketBase write + optimistic UI |
| S3 | `@smoke: lecture detail tabs all render` | 30s | Workspace module (demo data) |
| S4 | `@smoke: flashcard flip → rate → next card` | 40s | Study module (demo data) |
| S5 | `@smoke: A11y panel open → theme change → Esc closes` | 30s | A11y panel + preferences |

Total: ~2.5 minutes with Playwright parallelism across 3 workers. All 5 run on `chromium` only to maximize speed. No audio mocks needed (S1–S2 avoid capture; S3–S5 use pre-seeded data with no audio files).

If any smoke test fails, the demo is blocked. Do not proceed to the hackathon floor without all 5 green.
