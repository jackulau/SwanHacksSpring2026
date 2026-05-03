# TypeScript Quality Audit

**Date:** 2026-05-02  
**Scope:** `frontend/src/` — all `.ts` / `.tsx` files excluding `routeTree.gen.ts`  
**tsc config:** `tsconfig.json` — `strict: true`, `noEmit: true`

---

## tsc Result

One error:

```
src/hooks/useStudySession.ts(109,49): error TS2774:
  This condition will always return true since this function is always defined.
  Did you mean to call it instead?
```

**Root cause:** `navigator.sendBeacon` is a method on `Navigator`, so TypeScript knows its type is always `() => boolean`. The truthiness check `navigator.sendBeacon` always passes; the intent was to call it (but the code actually doesn't — it falls back to `fetch` anyway, so the check is moot). The fix is to remove the dead inner check or add a comment that clarifies the guard is intentional for the outer `typeof navigator` check only.

---

## Findings Table

| File:Line | Severity | Issue | Fix Sketch |
|---|---|---|---|
| `hooks/useStudySession.ts:109` | 🔴 | **tsc error** — `navigator.sendBeacon` truthiness check always true (TS2774) | Remove `navigator.sendBeacon` sub-check; `typeof navigator !== "undefined"` already suffices for SSR safety |
| `routes/capture.tsx:106` | 🔴 | **Non-null assertion** — `audio.audioBlob!` called inside `useEffect` guarded by `if (!audio.audioBlob)`. The guard at line 97 (`if (!audio.audioBlob || processing) return`) makes the assertion safe at first glance, but the effect dep array is `[audio.audioBlob]` only; `processing` is not included. If `processing` changes while `audioBlob` is set, the effect re-fires and the guard can be bypassed. Additionally the assertion suppresses a real type: `audioBlob` is `Blob | null` and the FormData call silently accepts `null` if the assertion is removed. | Add `processing` to the dependency array; use a runtime check before the assertion or restructure to avoid the `!` |
| `routes/capture.tsx:141` | 🔴 | **Missing dep in useEffect** — `processing` state is read inside the effect but absent from `[audio.audioBlob]` dep array. Stale closure: if `processing` becomes `true` between render and effect re-fire, the guard is stale | Add `processing` to dependency array |
| `routes/lectures.$lectureId.tsx:153,174` | 🟠 | **Unsafe `as` casts** — `notes.content as NoteBlock[]` and `quiz.questions as QuizQuestion[]` cast PocketBase `RecordModel` fields (typed as `unknown` by PocketBase) to complex discriminated unions with no runtime validation. If PocketBase returns malformed AI output, these casts cause silent runtime crashes in `NoteBlock` switch and `QuizRunner` narrowing. | Parse/validate with Zod at the call site, or at minimum add `Array.isArray()` + a type guard before the cast |
| `routes/lectures.$lectureId.tsx:162` | 🟠 | **Unnecessary `as QualityRating` cast** — `rateCard` already expects `QualityRating`; the prop's `onRate` signature inside `FlashcardDeck` types `rating` as `QualityRating`. The cast hides that the `onRate` callback prop in `FlashcardDeck` is typed `(card, rating: QualityRating) => void` but the `rateCard` returns a `Promise` that is silently dropped. | Remove the redundant cast; add `void rateCard(...)` or make `onRate` return `Promise<void>` |
| `components/capture/SignLanguageDetector.tsx:43,47` | 🟠 | **`as any` casts** — `landmarks as any` passed to `drawConnectors` and `drawLandmarks`. The `@mediapipe/drawing_utils` types expect `NormalizedLandmarkList` but the MediaPipe hands result returns the same type — the cast is purely a workaround for a type mismatch between `@mediapipe/hands` and `@mediapipe/drawing_utils` package versions. | Pin the two packages to matching minor versions; alternatively import `NormalizedLandmark[]` from `@mediapipe/hands` and assert that specific type instead of `any` |
| `hooks/useStudySession.ts:36` | 🟠 | **`console.warn` in production path** — `logError` calls `console.warn` which will appear in production. The inline eslint-disable comment acknowledges it but does not gate on environment. | Wrap with `if (import.meta.env.DEV)` or send to a structured logger |
| `routes/study.flashcards.tsx:22-25` | 🟠 | **Unhandled promise rejection** — `getDueCards(user.id).then(...)` has no `.catch()`. If the PocketBase call fails, the rejection is silently swallowed and the page hangs on `loading: true` forever. | Add `.catch(() => setLoading(false))` or convert to `async/await` with try/catch |
| `hooks/useSM2.ts:7-21` | 🟠 | **PocketBase call without try/catch** — `rateCard` awaits `pb.collection('flashcards').update(...)` with no error handling. A network error surfaces as an unhandled rejection to the caller. Every call site (`FlashcardDeck`, `study.flashcards.tsx`) wraps it in `void` or does not catch. | Wrap the PB update in try/catch inside `rateCard`; re-throw or surface the error to the UI |
| `routes/courses.tsx:75,103` | 🟠 | **PocketBase calls without try/catch** — `handleCreate` calls `pb.collection('courses').create(...)` and `fetchCourses()` is called after it, both without awaiting in a try/catch. A creation failure leaves the form in an indeterminate state. | Wrap `handleCreate` body in try/catch; show an error message on failure |
| `hooks/usePomodoro.ts:65` | 🟡 | **Stale closure on `cfg`** — `tick` callback captures `cfg` via `useCallback([cfg])`. `cfg` is reconstructed from `{ ...DEFAULT_CONFIG, ...config }` on every render since it is an inline object spread. This causes `tick` to be recreated every render when `config` is passed as an inline object from a parent, which in turn triggers the `setInterval` effect to re-fire every render. | Memoize `cfg` with `useMemo`; or accept individual primitive props instead of an object |
| `components/capture/LiveCaptions.tsx:41` | 🟡 | **`key={i}` (array index)** — caption segments use index as key. When interim results are replaced in-place the array item at index N changes identity but the key is the same, so React may not correctly re-render the updated caption text. The `isFinal` mutation pattern makes this meaningful. | Use a stable id: combine `segment.timestamp + segment.source` as key |
| `components/workspace/NoteBlock.tsx:24` | 🟡 | **`key={i}` in `bullet_list`** — list items are plain strings with no stable identity; index is acceptable here only if the list never reorders. Low risk but inconsistent with rest of the codebase. | Use `key={item}` (items are short unique strings) or `key={i}` is acceptable if this list is never reordered |
| `components/workspace/TranscriptViewer.tsx:33` | 🟡 | **`key={i}` for paragraph splits** — paragraphs split from `text.split('\n\n')` use index. If the transcript text changes the index assignment changes too, causing full re-mounts. Low visual impact. | Use `key={paragraph.slice(0, 40)}` or a hash |
| `components/study/QuizRunner.tsx:185` | 🟡 | **`key={idx}` on MC options** — quiz options are strings; using index is fragile if options are shuffled. Currently not shuffled so risk is low. | Use `key={opt}` |
| `components/accessibility/FocusMode.tsx:261` | 🟢 | **`key={i}` for sentence overlay rects** — rects are ephemeral viewport geometry, not persisted data. Index keys are acceptable and the array is rebuilt completely on each mousemove. No practical issue. | Acceptable as-is |
| `hooks/useDeepgramSTT.ts:78` | 🟡 | **`JSON.parse` without try/catch** — `JSON.parse(event.data)` in the WebSocket `onmessage` handler. Malformed data from Deepgram or a network proxy would throw an uncaught exception inside the event handler, crashing silently. | Wrap in try/catch; log and return on parse error |
| `routes/index.tsx:345-370` | 🟡 | **Floating promise in `useEffect`** — `Promise.all([...]).then(([c, l, d]) => { ... })` has no `.catch()`. A PocketBase 401 or network error leaves the dashboard stuck on `loading: true`. | Add `.catch(() => setLoading(false))` at the end of the Promise.all chain |
| `routes/index.tsx:446` | 🟡 | **Hardcoded streak "0 days"** — the `StatCard` for "Streak" passes `value="0 days"` unconditionally. The `useStudyStreak` hook exists and would power this correctly. | Wire `useStudyStreak` to the dashboard stat |
| `routes/study.tsx:149` | 🟡 | **Same issue** — "Day Streak" and "Cards Mastered" stats are hardcoded `0`. These are demo-visible stubs that will mislead judges. | Wire `useStudyStreak` and a mastered-card count query |
| `routes/study.planner.tsx:23` | 🟡 | **`StudyStreak` hardcoded** — `<StudyStreak streak={0} todayCompleted={false} />` always shows zero. `useStudyStreak` is imported elsewhere and ready to use. | Replace with `useStudyStreak()` result |
| `components/canvas/CanvasConnect.tsx:38-40` | 🟡 | **`console.log` / `console.error` in production** — the `copyScript` function preview panel contains real `console.*` calls rendered as visible code (intentional, for the user to paste), and additionally lines 56-96 in the JSX `<pre>` block have inline `console.*` that ship in the bundle string. The inline script string is intentional, but lines that call `console.log` at the component level during `copyScript` are unnecessary and should be removed. | The embedded script string is fine; remove any component-level `console.*` calls |
| `lib/ai-pipeline.ts:43` | 🟡 | **Unvalidated JSON parse** — `parseJSON<T>` calls `JSON.parse` and casts directly to `T` with no runtime validation. The AI response may omit required fields or have wrong types. If OpenAI returns malformed JSON, the error propagates as a generic exception with no context. | Add a Zod schema parse step after `JSON.parse` for `NoteBlock[]` and `QuizQuestion[]` |
| `lib/preferences.tsx:74` | 🟢 | **`JSON.parse` silently ignored** — `loadFromStorage` catches JSON parse errors but just returns defaults. Acceptable pattern here; no data loss risk. | No action needed |
| `main.tsx:16` | 🟢 | **`document.getElementById("root")!`** — standard Vite pattern; root element always exists if `index.html` is correct. Low risk in practice. | Acceptable |
| `hooks/useReadingAidsShortcuts.ts:27-28` | 🟡 | **DOM augmentation via interface merging** — the `_timer` property is attached to the toast HTMLElement with a cast. This avoids global type pollution but the cast `as HTMLElement & { _timer?: number }` is repeated twice; any rename/refactor will miss one. | Extract to a `WeakMap<HTMLElement, number>` to store the timer without DOM augmentation |
| `routes/courses.tsx:59-66` | 🟡 | **`fetchCourses` not in `useEffect` dep array** — `useEffect(() => { fetchCourses(); }, [userId])` is missing `fetchCourses` from deps. `fetchCourses` is defined inside the component and therefore recreated each render, but since `useEffect` only tracks `userId`, this is safe. However if `fetchCourses` were ever moved to a stable callback, this would silently break. | Wrap `fetchCourses` in `useCallback([userId])` and add to the dep array for correctness |
| All route files | 🟢 | **Default exports** — All route files use named function components declared inside the module, but the `Route` export itself (TanStack convention) is the primary export. No loose default exports found. No concern. | No action needed |

---

## Top 10 Things to Fix Before Demo

1. **Fix the tsc error** (`useStudySession.ts:109`) — this is the only type error and will prevent clean `tsc` in CI or build checks.

2. **Fix the stale dep in `capture.tsx`** — `useEffect([audio.audioBlob])` missing `processing` means the pipeline can be triggered a second time after it finishes, creating duplicate `lectures`, `transcripts`, `notes`, and `flashcards` records in PocketBase. This is a demo-killer.

3. **Wire `useStudyStreak` to the dashboard and planner** — the streak widget shows "0 days" unconditionally on the dashboard, the study page, and the planner. The hook already works correctly. Three places need wiring.

4. **Add `.catch()` to `getDueCards` in `study.flashcards.tsx`** — an unhandled rejection on the flashcard page causes the spinner to never resolve. Demo scenario where PocketBase is cold or slow will reproduce this visibly.

5. **Add try/catch to `useSM2.rateCard`** — every time a card is rated, a silent unhandled rejection can occur. During a demo flashcard session this is a high-probability failure path.

6. **Add `.catch()` to the dashboard `Promise.all`** — the home page data load has no error handling, leaving the page frozen if any of the three PocketBase calls fail.

7. **Add try/catch to `handleCreate` in `courses.tsx`** — creating a course without error handling means a failed network call leaves the form in a submitting-but-not-loading state.

8. **Wrap `JSON.parse(event.data)` in `useDeepgramSTT.ts`** — malformed WebSocket messages crash the STT handler silently. During a demo recording session, any Deepgram protocol change or proxy message will break live captions.

9. **Validate `notes.content` and `quiz.questions` before casting** — the `as NoteBlock[]` and `as QuizQuestion[]` casts on PocketBase data in `lectures.$lectureId.tsx` will cause cryptic React crashes if AI output is malformed. At minimum add `Array.isArray()` guards before rendering.

10. **Remove the `console.warn` from the production `logError` path** — or gate it on `import.meta.env.DEV`. Study session errors spamming the console in production is a credibility issue during a live demo.

---

## Patterns to Avoid Going Forward

**1. `useEffect` dependency arrays that omit state values read inside the callback.**  
Always include every reactive value. Use the `exhaustive-deps` ESLint rule (`eslint-plugin-react-hooks`) — currently there is no ESLint config at all in this project. Add at minimum `eslint-plugin-react-hooks` to catch this class of bug automatically.

**2. Casting PocketBase data directly to typed interfaces without runtime validation.**  
PocketBase returns `RecordModel` with fields typed as `unknown`. Casting `record.content as NoteBlock[]` compiles but is a lie. Establish a pattern: parse AI-generated content through Zod schemas at the boundary (the `parseJSON<T>` helper in `ai-pipeline.ts` is the right place — add `.parse()` calls there).

**3. Fire-and-forget PocketBase calls in hook return values.**  
`rateCard`, `getDueCards`, `handleCreate`, and several route-level effects call PocketBase without surfacing errors to the calling component. Standardise on: the hook catches internally and returns an `error` value, or re-throws so the caller can catch once.

**4. Inline object props recreated on every render inside hooks.**  
`usePomodoro` receives `config: Partial<PomodoroConfig>` and merges it inline on every call. Consumers pass inline objects (`{ workMinutes: prefs.pomodoroLength }`), defeating `useCallback` memoization of `tick`. Prefer flat primitive props for hooks that use those values in memoized callbacks.

**5. No ESLint config.**  
The project has no `.eslintrc` / `eslint.config.js`. TypeScript strict mode catches type errors, but React-specific bugs (missing deps, `forEach(async)`, `key` issues) require `eslint-plugin-react-hooks` and `eslint-plugin-react`. Add a minimal config before the project grows.

**6. `console.*` in component or hook code.**  
`console.warn` in `useStudySession.logError` and `console.log` lines in `CanvasConnect.tsx` will appear in the browser console during a demo. Use `import.meta.env.DEV` guards or remove entirely. The project currently has no logger abstraction — a thin wrapper that no-ops in production would solve this globally.

**7. Hardcoded placeholder values in production UI.**  
Streak "0 days" and "Cards Mastered: 0" on the dashboard are connected to live hooks elsewhere in the codebase but not wired. Stub values are acceptable during development but should be caught before demo with a search for `value="0"` or similar literal strings in stats-rendering components.
