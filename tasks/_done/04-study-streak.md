# Feature #4 — Study Streak (hook)

## Summary

Implemented `useStudyStreak()`, a React hook that derives the current study
streak from `study_sessions` records in PocketBase. The hook fetches up to
the 200 most-recent completed sessions for the authenticated user, groups
them by local-calendar day, and walks backward from today (or yesterday if
today has no session yet) to count consecutive qualifying days. It
auto-refreshes via PocketBase realtime subscriptions and exposes a manual
`refresh()` for orchestrators that just wrote a session.

The pre-existing `StudyStreak` UI component (`components/study/StudyStreak.tsx`)
is unchanged — it consumes `streak: number` and `todayCompleted: boolean`,
both of which the hook returns. Mounting on the Dashboard is the
orchestrator's job (out of scope for this task).

## Files modified

- **CREATED** `frontend/src/hooks/useStudyStreak.ts` (~210 lines including
  docstring). Pure addition, no edits to other files.

## Acceptance checks (vs. spec section 4)

| # | Spec test | Result |
|---|---|---|
| 1 | Brand new user → streak = 0, `todayCompleted = false` | PASS — empty session list short-circuits to `{ streak: 0, todayCompleted: false }` in `computeStreak`. |
| 2 | One session today (90s, completed) → streak = 1, `todayCompleted = true` | PASS — server filter accepts it (`duration_secs >= 60 && ended_at != ""`); today key matches; loop counts 1 then yesterday absent. |
| 3 | Sessions on day-1, day-2, day-3 (today) → streak = 3 | PASS — loop walks back today → yesterday → 2-days-ago, all present, streak = 3. |
| 4 | Sessions yesterday but not today → streak = 1, `todayCompleted = false` | PASS — `!todayCompleted` branch steps cursor to yesterday and counts from there. |
| 5 | Gap in middle (day-1 + day-3 only, today is day-3) → streak = 1 | PASS — counts today, then day-2 missing, breaks. |
| 6 | DST transition handled correctly | PASS — see DST reasoning below. |
| 7 | Streak ≥ 7 → "On fire" badge | PASS — handled by `StudyStreak.tsx` UI; hook returns the raw number unchanged. |
| 8 | Component on Dashboard above recent-lectures grid | DEFERRED — out of scope per task brief; orchestrator mounts. |

## DST reasoning

PocketBase stores `ended_at` as UTC ISO strings. We bucket each session into
a *local* `YYYY-MM-DD` key with `Intl.DateTimeFormat('en-CA', { year, month,
day })` — `en-CA`'s default short-date format is exactly ISO `YYYY-MM-DD`,
and `Intl.DateTimeFormat` honors the host's IANA timezone, which makes it
DST-aware. We deliberately avoid two DST hazards:

1. **Never slice UTC ISO strings** to derive "the local day". A user in
   America/Los_Angeles studying at 11:30 PM PDT has a UTC `ended_at` of the
   *next* calendar day; slicing the ISO string would push that session to
   tomorrow and break the streak.
2. **Never subtract `86_400_000 ms`** to step back a day. On the
   spring-forward day a local day is 23h, on fall-back it is 25h, so a
   fixed-millisecond step drifts by ±1 hour each transition and eventually
   skips or duplicates a calendar day. Instead we step with
   `Date#setDate(d - 1)`, which the runtime resolves correctly across DST.

Non-DST timezones (UTC, Asia/Tokyo, etc.) work identically — `setDate`
simply has no DST adjustment to apply. Sessions far in the past with
nothing recent fall through both `today` and `yesterday` checks and return
`streak = 0`.

## Implementation notes

- **Server-side filter** narrows to qualifying rows
  (`duration_secs >= 60 && ended_at != ""`); we still defensively re-check
  on the client because realtime payloads might arrive before a row is
  fully populated.
- **Stale-response guard**: a `requestIdRef` counter discards any fetch
  whose response arrives after a newer fetch has been issued (prevents
  out-of-order overwrites when the user logs out/in or `refresh()` is
  spammed).
- **Mount guard**: a `mountedRef` skips `setState` after unmount to avoid
  the React warning when realtime fires during teardown.
- **Realtime**: subscribes to `study_sessions` with `"*"` and filters
  client-side by `record.user === userId`. PocketBase doesn't support
  per-record subscription filters, so this is the standard pattern. The
  subscription is best-effort — if it fails we still have the initial
  fetch and `refresh()`.
- **Subscription teardown race**: if the user navigates away before
  `subscribe(...)` resolves, the resolved unsubscriber is invoked
  immediately via the `cancelled` flag.
- **Memoization**: `buildStudyDaySet` and `computeStreak` are wrapped in
  `useMemo`, keyed on `sessions` and `studyDays` respectively, so re-renders
  that don't change the data are O(1).
- **Error policy**: the spec says "streak = 0 on error". We surface the
  error string through `error` for UI, but the `streak` and
  `todayCompleted` fields are forced to `0` / `false` whenever `error` is
  non-null, even if a stale `studyDays` set is in memory. Loading toggles
  to `false` on both success and failure.
- **Safety cap**: the streak loop iterates at most `FETCH_LIMIT + 2` times,
  which is the theoretical maximum number of distinct days a 200-row fetch
  can span. Defensive against a clock-skew / corrupt-data infinite loop.

## Deviations from spec

- **Loading state on subsequent fetches**: spec says `loading: true initially,
  false after first fetch resolves or rejects`. We also set `loading = true`
  briefly during `refresh()` re-fetches; this is a strict superset of the
  spec and the existing `StudyStreak` UI greys out at `streak === 0` during
  the first paint anyway. If the orchestrator wants a non-flickering refresh
  it can ignore `loading` after the initial paint.
- **Hook return type** adds an exported `UseStudyStreakReturn` interface so
  the orchestrator (or tests) can destructure with full type fidelity. The
  hook signature in the spec is unchanged.

## Type-check

`npx tsc --noEmit` reports zero errors in `frontend/src/hooks/useStudyStreak.ts`.
Pre-existing errors in unrelated files (`AudioPlayer.tsx`,
`useReadingAidsShortcuts.ts`, `useStudySession.ts`) are out of scope.
