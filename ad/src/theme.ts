export const COLORS = {
  green: "#2f5d4f",
  greenMid: "#2f8d6a",
  greenBright: "#7bd88f",
  greenDeepSoft: "#cfe9d6",
  greenSoft: "#e8f0eb",
  cream: "#fbfbf9",
  creamWarm: "#f4f1ea",
  surface: "#ffffff",
  ink: "#0a0d0c",
  inkSoft: "#1a1a1a",
  muted: "#555555",
  red: "#ff5147",
} as const;

export const FPS = 30;

// Inserting the sign-to-text accessibility scene (38.0s, ~7s) pushes the
// convergence + lockup later. Shift them by EXACTLY 13 beats of the 110-BPM
// song bed so the qa6 katana wipe and the lockup impact stay locked to the
// beat grid (see scripts/synth-audio.py, which mirrors this same shift).
export const POST_SHIFT = (13 * 60) / 110; // ≈ 7.0909s

export const FONT_DISPLAY = "Schibsted Grotesk, system-ui, -apple-system, sans-serif";
export const FONT_BODY =
  "Atkinson Hyperlegible, system-ui, -apple-system, sans-serif";

// Fully-synthesized 112-BPM beatbox track (see scripts/synth-audio.py — zero
// copyright). 1 beat = 0.536s, 1 bar = 2.143s. The 50s arrangement is a long
// beatbox buildup under the cold open, a DROP at 6.0s when the first feature
// slams in, the full groove through the feature beats, and a riser → impact
// into the lockup at 44.0s. Scene boundaries are mirrored into the audio
// script's SFX placement so the two never drift.
export const BPM = 112;
export const BEAT_S = 60 / BPM;
export const BAR_S = BEAT_S * 4;

// ~57s master timeline. Each feature beat gets ~6s of breathing room (Canvas,
// the auto-generation hero moment, gets ~8s; the sign-to-text scene gets ~7s).
// Katana wipe fires ONLY on qa1 (the drop) and qa6 (the convergence); every
// other handoff uses a soft fade.
export const SCENE_TIMES = {
  coldOpen: { start: 0.0,  end: 6.0 },          // problem hook — sentence then punchline
  qa1:      { start: 6.0,  end: 12.0 },         // DROP · Capture
  qa2:      { start: 12.0, end: 18.0 },         // Notes
  qa3:      { start: 18.0, end: 24.0 },         // Flashcards
  qa4:      { start: 24.0, end: 30.0 },         // Quiz
  qa5:      { start: 30.0, end: 38.0 },         // Canvas — auto notes + quizzes (hero)
  signLang: { start: 38.0, end: 38.0 + POST_SHIFT },          // ≈45.09 — sign → text, accessibility built in
  qa6:      { start: 38.0 + POST_SHIFT, end: 44.0 + POST_SHIFT }, // ≈45.09–51.09 — all-in-one convergence
  lockup:   { start: 44.0 + POST_SHIFT, end: 50.0 + POST_SHIFT }, // ≈51.09–57.09 — logo + CTA
} as const;

export const DURATION_FRAMES = Math.round((50.0 + POST_SHIFT) * FPS); // 1713 frames ≈ 57.1s
