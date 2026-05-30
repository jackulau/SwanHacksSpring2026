# Converge — Zelios-Style Product Ad · Build Spec & Handoff

> **For:** the Claude Code instance working inside `jackulau/SwanHacksSpring2026`
> **Goal:** Produce a 30-second, beat-synced, "Zelios-style" SaaS explainer ad for **Converge**, rendered to MP4 with original music + SFX, in 16:9 and 9:16.

---

## 0. Kickoff prompt

```
Read tasks/converge-ad-video-spec.md in full. We're building a 30s Zelios-style
SaaS explainer ad for Converge as a programmatic video (Remotion). Work on a new
branch `feat/ad-video`. Do NOT touch the existing frontend/ app code.

Plan first: confirm the tech approach (Remotion), the scene list, and the asset
list against the spec, then post a short build plan before writing code. Build
scene-by-scene; render a low-res preview after each scene and self-check against
the storyboard timings and the acceptance criteria in §9. Use ONLY the real
product features listed in §7 — do not invent capabilities. When done, render both
the 1920x1080 and 1080x1920 compositions and report the output paths.
```

---

## 1. Mission & context

We're making a high-converting product ad in the visual language of **Zelios**
(the Ukraine studio whose SaaS/AI explainer style is the current reference standard —
clients backed by YC, Google, Microsoft). The two references the founder supplied:

- A "Create a SaaS Explainer Ad in After Effects" tutorial built in the Zelios house style.
- A SaaS-ad Instagram reel in the same lineage.

**We are NOT using After Effects.** Build this **programmatically in code** so it lives
in the repo, re-renders deterministically, and exports both aspect ratios.

**Updated direction (2026-05-29):**
- Use **real app screenshots** captured via Playwright, not hand-built vector recreations. The point is to show the *actual* product.
- Style target: SaaS ad in the Google/Apple keynote lineage (clean, dimensional, confident) — closest contemporary reference is the Instagram reel at https://www.youtube.com/shorts/WA9TNC6r3hU.
- Music: upbeat, **less copyright-prone** (synthesize original, do not lift a track).
- Pull animation patterns from https://github.com/heygen-com/hyperframes/tree/main for kinetic typography and card transitions.

---

## 2. The target aesthetic — 8 defining traits

1. **Soft animated gradient background.** Cream → soft green mesh gradient with subtle film grain.
2. **Floating UI cards in pseudo-3D.** Real Converge screens hover with soft drop-shadows + slight tilt.
3. **Parallax camera moves.** Smooth dolly/push-ins.
4. **UI carousel.** Centered card scales up / gains shadow.
5. **Animated shape-layer accents.** Dots, rings, arcs, short lines in `#7bd88f`.
6. **Kinetic typography.** Big bold headlines on springs/masks, tight tracking.
7. **Morph transitions** between scenes — no hard cuts.
8. **Bright, rounded, optimistic.** Friendlier than a dark keynote.

**Pacing:** 120 BPM, 2-second bars.

---

## 3. Tech approach

### Primary: Remotion

```bash
cd ad
npm i
npm run dev   # preview at localhost:3000 (different port from frontend)
npx remotion render ConvergeAd-H out/converge-ad-16x9.mp4 --codec=h264 --crf=18
npx remotion render ConvergeAd-V out/converge-ad-9x16.mp4 --codec=h264 --crf=18
```

Two compositions in `ad/src/Root.tsx`:
- `ConvergeAd-H` — 1920×1080, 30 fps, 900 frames
- `ConvergeAd-V` — 1080×1920, 30 fps, 900 frames (re-flowed, not cropped)

---

## 4. Brand system

### Colors
| Token | Hex | Use |
|---|---|---|
| green | `#2f5d4f` | brand base |
| green-mid | `#2f8d6a` | logo blade |
| green-bright | `#7bd88f` | hero accent, CTA |
| green-deep-soft | `#cfe9d6` | logo blade, soft fills |
| green-soft | `#e8f0eb` | tints |
| cream | `#fbfbf9` | bg base |
| surface | `#ffffff` | cards |
| ink | `#0a0d0c` | text |

### Fonts
- **Display:** Schibsted Grotesk (400–800), tight tracking
- **Body:** Atkinson Hyperlegible (400/700)

### Logo (SVG, viewBox `0 0 100 100`)
```svg
<svg viewBox="0 0 100 100" fill="none">
  <path d="M50 14 a36 36 0 0 1 31.2 18"  stroke="#7bd88f" stroke-width="7" stroke-linecap="round"/>
  <path d="M81.2 68 a36 36 0 0 1 -62.4 0" stroke="#cfe9d6" stroke-width="7" stroke-linecap="round"/>
  <path d="M18.8 32 a36 36 0 0 1 31.2 -18" stroke="#2f8d6a" stroke-width="7" stroke-linecap="round"/>
  <path d="M50 36 L62 57 H38 Z" fill="#7bd88f"/>
</svg>
```

### Voice
- Tagline: **"Turn lectures into study systems."**
- Positioning: **"An accessibility toolkit — without asking for one."**

---

## 5. Storyboard (30s · 120 BPM)

| t | Scene | Action | Copy |
|---|---|---|---|
| 0.0–3.0 | Cold open | Logo arcs draw in, triangle pop, ring ripple, wordmark springs up | `Converge` / `Turn lectures into study systems.` |
| 3.0–7.0 | Problem → converge | 5 app chips parallax, then morph into logo | `One lecture. Five apps.` |
| 7.0–20.0 | Product carousel | Real UI cards as floating tilted screens: (a) Capture w/ waveform (b) Notes (c) Flashcard flip (d) Quiz w/ confetti | per-card labels |
| 20.0–24.0 | Feature ticker | Kinetic words on beat | `Capture · Notes · Flashcards · Quizzes · Accessible · Canvas sync` |
| 24.0–26.5 | Accessibility beat | Drums drop, headline + micro-icons | `Built for every student.` |
| 26.5–30.0 | Lockup + CTA | Logo + wordmark + CTA pill | `Start studying →` |

---

## 6. Audio

- 120 BPM, E major, four-on-the-floor kick, offbeat hats, plucky bass, soft pad, sparkly arpeggio.
- Drop drums 24–26.5s.
- SFX: chime 2.5s, whoosh+impact 6.3s, typing 10.5–12s, flip 15.5s, success chime 17.7s, riser 25.6s, impact 26s.
- AAC 192k.

---

## 7. Product accuracy

Build the ad strictly from real features:

- **Name:** Converge.
- **Flow:** record/upload/online lecture → live captions → searchable transcript → auto-generated notes → flashcards → quizzes.
- **Accessibility:** ASL fingerspelling (MediaPipe + Gemini Vision), reading ruler, focus mode, TTS, contrast/theme.
- **Spaced repetition:** SM-2.
- **Canvas:** courses/assignments sync via Chrome extension.
- **Stack:** React 19 + TanStack Router, PocketBase 0.26, Whisper, OpenAI-compatible + Gemini LLM router.
- **Do NOT show:** fabricated metrics or partner logos.

---

## 8. Assets

- **Screenshots:** captured live via `ad/scripts/capture-screens.mjs` into `ad/public/screens/`. Use real running app — do not paste in low-res PNGs from `ss/`.
- **Real copy:** `frontend/src/routes/index.tsx` hero/workflow/feature sections.
- **Tokens:** `frontend/src/app.css` `--color-*`.
- **Logo:** `frontend/src/components/layout/ConvergeLogo.tsx`.

---

## 9. Acceptance criteria

- [ ] Two MP4s: **1920×1080** + **1080×1920** (9:16 re-flowed).
- [ ] Exactly **30.0s**, **30 fps**, H.264 + AAC, `yuv420p`, faststart.
- [ ] Original audio present, synced.
- [ ] All 8 aesthetic traits visible.
- [ ] Brand-exact colors + fonts + logo geometry.
- [ ] Only real features.
- [ ] Deterministic `remotion render` re-run.
- [ ] Branch `feat/ad-video`, `frontend/` untouched.
