# Converge Ad Video

A 30-second, beat-synced product ad for Converge, rendered programmatically with [Remotion](https://www.remotion.dev).

See [`tasks/converge-ad-video-spec.md`](../tasks/converge-ad-video-spec.md) for the full design spec.

## Output

- `out/converge-ad.mp4` — 1920×1080 @ 30 fps, H.264 + AAC, `yuv420p`, faststart, ~30.06 s, ~11 MB.

A `ConvergeAd-V` (1080×1920) composition is still defined in `src/Root.tsx` if a vertical re-flow is ever needed — render with `npx remotion render ConvergeAd-V out/converge-ad-9x16.mp4 --codec=h264 --crf=18`.

## Storyboard

| t (s)       | Scene             | What you see                                                                       |
|-------------|-------------------|------------------------------------------------------------------------------------|
| 0 – 3       | Cold open         | Logo build-in (arcs draw → arrows pop → ring ripple), wordmark + tagline spring up |
| 3 – 7       | Problem → converge| Otter.ai / Notion / Quizlet / Anki / Calendar chips collapse into the Converge logo|
| 7 – 19      | Product carousel  | Real UI screens — Capture, Transcript, Flashcards, Quiz                            |
| 19 – 23     | Canvas integration| Canvas LMS → extension popup → assignments fly into Converge dashboard             |
| 23 – 26.5   | Accessibility     | "Built for every student." with orbiting accessibility icons                       |
| 26.5 – 30   | Lockup            | Logo + wordmark + tagline + `Start studying →` CTA                                 |

## Rebuild from scratch

```bash
cd ad
npm install
npx playwright install chromium

# 1. (Re)capture real UI screenshots — needs the dev server + PocketBase running
#    See top-level dev.sh
npm run capture:screens
node scripts/capture-extension.mjs

# 2. Synthesize the upbeat 120 BPM E-major music + SFX bed
npm run synth:audio        # writes public/audio/track.wav

# 3. Render
npm run render             # 1920x1080, ~3 minutes on M-series
```

The screens and `track.wav` live under `public/` and are inputs to the
deterministic Remotion render. Re-running with the same inputs produces a
byte-identical video.

## Project layout

```
ad/
├── public/
│   ├── screens/          # real Converge UI screenshots + Canvas frames
│   └── audio/track.wav   # 30s music bed + SFX (synthesized, no copyright)
├── scripts/
│   ├── capture-screens.mjs   # Playwright → screenshots
│   ├── capture-extension.mjs # Playwright → extension popup
│   └── synth-audio.py        # NumPy synth → music+SFX
├── src/
│   ├── Root.tsx              # H + V compositions
│   ├── ConvergeAd.tsx        # top-level scene sequencer
│   ├── theme.ts              # brand colors, fonts, scene timing
│   ├── components/           # Background, FloatingCard, KineticText, etc.
│   └── scenes/               # ColdOpen, ProblemScene, CarouselScene, ...
└── remotion.config.ts
```

## Music & SFX timing

- **120 BPM, E major.** Four-on-the-floor kick, offbeat hats, plucky bass, soft pad, sparkly arp.
- Drums **drop 24 → 26.5 s** for the accessibility line, then **riser → impact** into the lockup.
- SFX land at: 2.5 s (logo chime), 6.5 s (whoosh + impact), 10.5–12 s (typing), 15.4 s (flip), 17.6 s (quiz success), 19 / 20.7 s (Canvas sync), 25.6 s (riser), 26.7 s (impact).

## Tech notes

- Schibsted Grotesk display, Atkinson Hyperlegible body — same family as the product.
- Gradient bg + grain + floating accents in `src/components/Background.tsx` and `ShapeAccents.tsx`.
- Every scene wrapped in `<SceneFader>` for morph dissolves (no hard cuts).
- Canvas integration uses real frames extracted from `~/Movies/wohfjw.mp4` plus a re-rendered extension popup at 3x DPR.
