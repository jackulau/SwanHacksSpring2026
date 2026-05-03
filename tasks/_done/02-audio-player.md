# Feature #2 — Audio Player Bar (Context + Refactor)

## Summary

Lifted the audio player into a global React context so playback survives tab swaps and route transitions. The provider owns a single `<audio>` element, exposes a clean imperative API, and synchronises a `--audio-player-height` CSS custom property so pages can reserve bottom padding. The presentational `AudioPlayer` component now reads everything from the context, registers global keyboard shortcuts when active, and collapses gracefully on small viewports.

## Files modified

- **CREATED** `frontend/src/lib/audioPlayer.tsx`
  - `AudioPlayerProvider` mounts a hidden `<audio>` element via `useRef` (rendered with `display: none`).
  - State: `src`, `title`, `currentTime`, `duration`, `playing`, `rate` — driven by the audio element's `timeupdate`, `loadedmetadata`, `durationchange`, `ended`, `play`, `pause`, `ratechange` events.
  - API: `setSrc(src, title?)`, `seek(time)` (clamped to `[0, duration]`), `togglePlay()` (async), `setRate(rate)` (clamped to 0.5–2), `skip(deltaSeconds)` (delegates to `seek`).
  - `setSrc(null)` pauses, clears the element src, and zeroes state.
  - `togglePlay` no-ops when no source is loaded; `audio.play()` rejection is swallowed (state syncs via the `pause` event).
  - Maintains the `--audio-player-height` CSS variable: `56px` when active, `0px` when null.
  - `useAudioPlayer()` throws a descriptive error if used outside the provider.
  - Top-of-file comment: `// Mount <AudioPlayer/> from AppShell.`
- **REWROTE** `frontend/src/components/layout/AudioPlayer.tsx`
  - Pure presentational; no internal state, no props.
  - Returns `null` when `src === null`.
  - Fixed bottom bar at `z-40` (below A11y button at `z-50`, above ruler at `z-30`).
  - Uses `useKeyboardShortcuts` with `enabled = active`: Space and `K` toggle play/pause, `J`/`L` skip ±10s. The shortcut hook already ignores inputs/textareas/contenteditable.
  - Mobile responsive: title, skip buttons, time labels, speed selector, and volume icon are hidden on `<sm`; play/pause + scrubber remain.
  - Replaced cycle-button with an accessible `<select>` for playback speed (0.5×–2×).
  - All controls have `aria-label`s; play/pause uses `aria-pressed`.
- **MODIFIED** `frontend/src/main.tsx`
  - Wrapped the `<RouterProvider>` with `<AudioPlayerProvider>`, placed inside `<PreferencesProvider>` and outside `<RouterProvider>` per spec.

## Acceptance checks verified

| Requirement | Status |
|---|---|
| Single `<audio>` ref-mounted, hidden | OK (rendered with `display: none`) |
| State updated via audio events (timeupdate, loadedmetadata, ended, play, pause, ratechange) | OK; also `durationchange` for safety |
| `setSrc(null)` pauses and clears | OK |
| `togglePlay` is async (`audio.play()` Promise) | OK |
| `seek` clamps to `[0, duration]` | OK |
| `skip(delta)` calls `seek(currentTime + delta)` | OK |
| `useAudioPlayer()` throws outside provider | OK |
| Visual component returns null when `src === null` | OK |
| `--audio-player-height` CSS var: `56px` active, `0px` idle | OK (set in `useEffect` keyed on `src`) |
| `z-40` | OK |
| Keyboard shortcuts (Space, K, J, L) registered only when `src` non-null | OK (`enabled = active` flag) |
| Skip labels hidden on `<sm`; speed/volume hidden on `<sm` | OK (`hidden sm:inline-flex`, `hidden sm:inline`) |
| `npx tsc --noEmit` clean for files in scope | OK |

## Type-check

`cd frontend && npx tsc --noEmit` reports a single pre-existing error in `src/hooks/useStudySession.ts:109` (Feature #3, out of scope). All files in this feature's scope compile cleanly.

## Deviations / notes

- **CSS height inline style**: `<div style={{ height: "var(--audio-player-height, 56px)" }}>` — keeps the bar's height tied to the same CSS var that pages will use for bottom padding, with a `56px` fallback if the var hasn't been set yet.
- **Speed selector**: replaced the original cycle-button with a `<select>` — better keyboard accessibility and easier discoverability (spec only required visible speed selector + 0.75× / 1.25× to be reachable).
- **`AudioPlayer` is NOT mounted** in `AppShell` per the brief — orchestrator will wire `<AudioPlayer/>`, the lecture route's `setSrc` effect, and `TranscriptViewer` click-to-seek separately. The `audioPlayer.tsx` header comment notes this.
- **No volume control wired**: the existing scaffold rendered a static `Volume2` icon with no interaction; preserved that behaviour to keep this PR scoped to context + refactor. Adding volume would be a follow-up.
- The shortcut hook calls `e.preventDefault()`, so Space cannot scroll the page while audio is loaded — matches typical media-player UX.
