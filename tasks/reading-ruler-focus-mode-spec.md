# Reading Ruler + Focus Mode — Spec

**Owner:** Moss · **Branch:** `moss` · **Status:** Implementing

## 1. Goal

Two complementary reading aids that students with dyslexia, ADHD, visual processing differences, or anyone reading long lecture transcripts can toggle on to keep their place. Both are global features that work across every page (Dashboard, Capture, Lecture detail, Study, Settings).

## 2. Why now

- Two of the three biggest "this app changed how I study" reviews in dyslexia/ADHD edtech mention reading rulers and focus mode by name.
- They're parallel-safe: zero conflict surface with the Canvas-integration branch.
- Existing scaffolds (`ReadingRuler.tsx`, `FocusMode.tsx`) are 27/30-line stubs that are never even imported — clean greenfield in a contained area.

## 3. Scope

### In scope
1. Reading Ruler with two visual modes (`bar`, `window`) + customization (height, tint, dim opacity).
2. Focus Mode with two scopes (`paragraph`, `sentence`) — dimming siblings inside a marked reading region only (does NOT dim sidebar / header / chrome).
3. Preferences integration — settings persist to localStorage and PocketBase.
4. A11yPanel UI section "Reading Aids" with all controls.
5. Keyboard shortcuts: `Alt+R` cycles ruler, `Alt+F` cycles focus mode.
6. Mounted once globally in `AppShell` — works on every page.
7. `prefers-reduced-motion` and `print` media respect.
8. ARIA-friendly — never traps screen readers, never blocks keyboard focus.

### Out of scope (v1)
- Touch/stylus tracking on mobile.
- Per-element rich color picker beyond preset tints.
- AI-detected reading-level sentence hints (could come later).
- Saving ruler state per-document (global only).

## 4. UX behaviour

### 4.1 Reading Ruler

| Mode | Visual |
|---|---|
| `off` | Nothing rendered. |
| `bar` | One horizontal translucent band (default 32px tall, default tint, no dimming) follows the cursor's vertical position. The band is a single visual artifact — a "highlighter following your eye." |
| `window` | Typoscope-style: a bright readable band (default 32px), the area above the band is dimmed, the area below is dimmed. Dimming opacity is configurable. The band again tracks the cursor's Y. |

Customization knobs (in A11yPanel):
- **Mode**: off · bar · window
- **Height**: 16–80px (default 32)
- **Tint**: none · yellow · peach · blue · lavender · mint
- **Dim opacity** (window only): 0–90 (default 60)

Tracking rules:
- Track `mousemove` Y on `window` while ruler is enabled.
- Hide while cursor is over scrollbar (best-effort: `e.target === document.documentElement` and Y near right edge).
- `pointer-events: none` so the ruler never intercepts clicks.
- `z-index: 30` (below the A11yPanel modal at z-50, above page content).
- On `prefers-reduced-motion: reduce`, no transitions.
- No tracking inside `<input>`, `<textarea>`, `[contenteditable]` — but ruler stays visible at last position to keep continuity.

### 4.2 Focus Mode

| Mode | Behaviour |
|---|---|
| `off` | No effect. |
| `paragraph` | On hover or keyboard focus inside a `[data-focus-zone]` container, the closest `<p>`, `<li>`, `<blockquote>`, or `<pre>` gets `.focus-highlight`; siblings inside the same zone fade to 35% opacity. |
| `sentence` | Same but the closest sentence within a paragraph is highlighted. Sentence detection: split paragraph text on `.!?` followed by whitespace, wrap each sentence in a span on hover, remove on leave. |

Scope rules:
- Dimming is **scoped to the container marked `[data-focus-zone]`** — sidebar, header, and chrome are unaffected.
- Click-to-pin: clicking inside a focus zone pins the current highlight; mouse movement no longer changes it until you click elsewhere.
- Keyboard support: `Tab`/`Shift-Tab` to focusable text elements highlights them.
- `Esc` clears any pinned highlight.

### 4.3 Keyboard shortcuts

- `Alt+R` cycles Reading Ruler: `off → bar → window → off`. Toast briefly announces the new mode (uses existing toast pattern, or a small ARIA live region).
- `Alt+F` cycles Focus Mode: `off → paragraph → sentence → off`.
- Shortcuts ignore typing inside inputs/textareas/contenteditables (already handled by `useKeyboardShortcuts`).

## 5. Architecture

### 5.1 Preferences additions (`lib/preferences.tsx`)

```ts
interface Preferences {
  // ...existing
  readingRuler: 'off' | 'bar' | 'window';
  readingRulerHeight: number;          // 16..80
  readingRulerTint: 'none' | 'yellow' | 'peach' | 'blue' | 'lavender' | 'mint';
  readingRulerOpacity: number;         // 0..90 (window dim %)
  focusMode: 'off' | 'paragraph' | 'sentence';
}
```

Defaults: all `'off'` / `32` / `'none'` / `60`.

`applyToDOM`: also writes CSS vars `--reading-ruler-tint`, `--reading-ruler-height`, `--reading-ruler-dim`, plus toggles class `focus-mode-active` on `<body>` when focus mode is on.

### 5.2 Components

- `ReadingRuler.tsx` — listens to mousemove, renders ruler. Reads prefs via `usePreferences()`.
- `FocusMode.tsx` — attaches global hover/focus/click listeners, manages `.focus-highlight` class on the matched element, and toggles `[data-focus-pinned]` when click-to-pin is active.
- `useReadingAidsShortcuts.ts` — small hook that wires `Alt+R`/`Alt+F` to cycle prefs.

### 5.3 Mounting

In `AppShell`:
```tsx
<ReadingRuler />
<FocusMode />
{/* shortcuts hook */}
```

Both render `null` when their pref is `'off'`, so the cost when disabled is one prefs read.

### 5.4 Marking focus zones

Add `data-focus-zone` to the root of:
- `routes/index.tsx` main content
- `components/workspace/TranscriptViewer.tsx`
- `components/workspace/NoteBlock.tsx`
- `routes/lectures.$lectureId.tsx` content area

Default-on for all `<main>` content if the surrounding code doesn't add it explicitly — fallback in CSS: `main[role="main"]` is treated as a focus zone if no explicit zones exist.

### 5.5 CSS (`app.css`)

New rules:

```css
/* Reading Ruler — bar mode is just a tinted strip with shadow */
.reading-ruler-bar { /* fixed positioned, pointer-events: none */ }
.reading-ruler-window-above { /* full-width div above the band */ }
.reading-ruler-window-below { /* full-width div below the band */ }

/* Tints */
.ruler-tint-yellow   { background: rgba(253, 224, 71, 0.25); }
.ruler-tint-peach    { background: rgba(252, 165, 165, 0.25); }
.ruler-tint-blue     { background: rgba(147, 197, 253, 0.25); }
.ruler-tint-lavender { background: rgba(196, 181, 253, 0.25); }
.ruler-tint-mint     { background: rgba(167, 243, 208, 0.25); }

/* Focus mode — scoped, NOT global */
[data-focus-zone].focus-zone-active > *:not(.focus-highlight):not(.focus-highlight *) {
  opacity: 0.35;
  transition: opacity 0.2s;
}

/* Reduced-motion + print suppression */
@media (prefers-reduced-motion: reduce) {
  .reading-ruler-bar { transition: none; }
}
@media print {
  .reading-ruler-bar,
  .reading-ruler-window-above,
  .reading-ruler-window-below { display: none; }
  [data-focus-zone] *:not(.focus-highlight) { opacity: 1 !important; }
}
```

Remove the existing global `body:has(.focus-highlight) ...` rules — they break the chrome.

## 6. Acceptance criteria

| # | Test | Pass = |
|---|---|---|
| 1 | Toggle ruler `bar` in A11yPanel → move mouse | Translucent strip follows Y, no flicker, no click block |
| 2 | Toggle ruler `window` + set 70% opacity | Above/below dim layers visible at right opacity |
| 3 | Change tint to `peach` | Strip and middle band turn peach |
| 4 | Press `Alt+R` repeatedly | Cycles off → bar → window → off |
| 5 | Toggle Focus `paragraph` mode + hover transcript | Hovered paragraph stays bright, sibling paragraphs dim, **sidebar stays bright** |
| 6 | Press `Alt+F` cycles | off → paragraph → sentence → off |
| 7 | Click inside focus zone | Highlight pins. `Esc` un-pins |
| 8 | Type in an input | Shortcuts don't fire |
| 9 | Reload page | Settings persist |
| 10 | Tab through page | Focus visible, no traps |
| 11 | Print preview | Ruler/dimming disabled |
| 12 | High-contrast theme | Ruler visible, focus mode visible |

## 7. Out-of-the-box defaults

A user with no prefs set sees nothing different. They opt in via A11yPanel or `Alt+R`/`Alt+F`.

## 8. Implementation order

1. Extend `Preferences` interface, defaults, and `applyToDOM`.
2. Rewrite `ReadingRuler.tsx` — uses prefs, supports both modes, handles edge cases.
3. Rewrite `FocusMode.tsx` — scoped to `[data-focus-zone]`, click-to-pin, sentence detection.
4. Add `useReadingAidsShortcuts.ts` hook.
5. Mount in `AppShell` + add shortcuts.
6. Update `app.css` — new rules, remove global-dimming bug.
7. Add "Reading Aids" section to `A11yPanel` with all knobs.
8. Add `data-focus-zone` markers in the 4 content surfaces.
9. Test end-to-end.
10. Code-reviewer agent verification pass.
