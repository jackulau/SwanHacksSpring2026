# Feature #5 — Mobile Nav (sub-task of Responsive Design Pass)

## Summary

Implemented the bottom-bar mobile navigation component (`MobileNav`) that the
`AppShell` orchestrator will mount with a `lg:hidden` wrapper. Removed the
stale, dead-code `.sidebar-desktop` `@media` rule from `app.css` and
introduced a `--mobile-nav-height` CSS variable contract so pages and the
audio player can reserve bottom-padding without coupling to this component.

This delivers the "(B) Bottom nav bar" pattern recommended in
`tasks/remaining-features-spec.md` § 5.

## Files modified

| File | Change |
|---|---|
| `frontend/src/components/layout/MobileNav.tsx` | **Created** — fixed bottom nav, 5 routes, active-route indicator, iOS safe-area padding, keyboard-accessible. ~95 lines. |
| `frontend/src/app.css` | Removed stale `@media (max-width: 768px) { .sidebar-desktop { display: none } }` rule. Added `:root { --mobile-nav-height: 0px }` default + `.has-mobile-nav-padding` utility. |

## Files NOT touched (per scope)

- `frontend/src/components/layout/AppShell.tsx` — orchestrator owns mounting.
- `frontend/src/components/layout/AudioPlayer.tsx` — Audio Player agent owns.
- Route files — orchestrator owns global page padding tweaks.

## Component contract

```tsx
import { MobileNav } from "../components/layout/MobileNav";

// In AppShell:
<div className="lg:hidden">
  <MobileNav />
</div>
```

`MobileNav` itself does **not** gate its visibility — the parent does, via a
`lg:hidden` wrapper. When mounted, it sets `--mobile-nav-height: 56px` on the
`:root` element; on unmount, it restores the previous value (or removes it).

## Acceptance checks

| # | Spec requirement | Status |
|---|---|---|
| 1 | Fixed bottom of viewport, full width, ~56px tall | ✅ `min-h-14` + `fixed inset-x-0 bottom-0` |
| 2 | Visible only on `<lg` | ✅ Parent applies `lg:hidden` |
| 3 | 5 icon buttons with same icons as desktop sidebar | ✅ Home, Mic, BookOpen, GraduationCap, Settings |
| 4 | TanStack Router `<Link>`, active = indigo + underline pill | ✅ Indigo-400 text + 2px top bar indicator on active |
| 5 | Tap targets ≥ 44×44px | ✅ `min-h-14` (56px) + flex-1 horizontally |
| 6 | Backdrop `bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800` | ✅ |
| 7 | z-index = 40 (below A11y button z-50) | ✅ `z-40` |
| 8 | Adds bottom padding via `--mobile-nav-height` only when rendered | ✅ Set on mount, cleared on unmount |
| 9 | `useLocation()` to detect active route | ✅ With "/" exact-match logic |
| 10 | `aria-label` + `aria-current="page"` when active | ✅ |
| 11 | Subtle animations, respects `prefers-reduced-motion` | ✅ 150ms transitions; `.reduce-motion` global rule already nukes durations |
| Bonus | iOS PWA safe-area | ✅ `pb-[env(safe-area-inset-bottom)]` on the nav |
| CSS | Stale `.sidebar-desktop` rule deleted | ✅ |
| CSS | `--mobile-nav-height` default | ✅ `:root { --mobile-nav-height: 0px }` |

## Type check

`cd frontend && npx tsc --noEmit` passes cleanly for `MobileNav.tsx` and
`app.css`. Remaining type errors in the workspace originate from files owned
by other parallel agents (`useStudySession.ts` for feature #3,
`AudioPlayer.tsx` for feature #2) — outside this task's scope.

## Deviations

- **Active indicator chosen: top underline pill** (2px tall, 32px wide,
  rounded bottom). Spec said "underline OR pill background"; the underline
  reads cleaner against the dark backdrop without competing with the
  indigo-colored icon+label.
- **Footer-bar element**: used a single `<nav aria-label="Primary">` rather
  than a wrapping `<div>`, so screen readers announce it as navigation
  landmark.
- **CSS var lifecycle**: store the previous value of `--mobile-nav-height`
  before overriding, so nested mounts (unlikely but defensible) don't lose
  outer state.
- **Did not add a `pb-[var(--mobile-nav-height)]` on `<main>`**: orchestrator
  owns AppShell padding. Exposed `.has-mobile-nav-padding` utility so the
  orchestrator can drop it on `<main>` cleanly.

## Notes for orchestrator

When mounting, ensure `MobileNav` renders inside the same `data-focus-zone`
boundary check. Recommended snippet inside `AppShell.tsx`:

```tsx
{/* Desktop sidebar */}
<aside className="hidden lg:flex ...">...</aside>

{/* Main column */}
<div className="flex-1 flex flex-col min-w-0">
  <header>...</header>
  <main className="flex-1 overflow-auto has-mobile-nav-padding" data-focus-zone>
    {children}
  </main>
</div>

{/* Mobile bottom nav */}
<div className="lg:hidden">
  <MobileNav />
</div>
```

The floating accessibility button (`fixed bottom-6 right-6 ... z-50`) sits
above the nav (z-50 > z-40) but visually overlaps it on `<lg` — the
orchestrator may want to bump its `bottom-` value to
`bottom-[calc(1.5rem+var(--mobile-nav-height))]` on small screens.
