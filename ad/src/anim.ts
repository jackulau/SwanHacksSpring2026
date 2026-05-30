/**
 * Punctual animation helpers — fast IN, slow HOLD, fast OUT.
 *
 * The user explicitly asked for animations that "come in fast, slow to show
 * the user, then leave fast." That's a sharp ease-out enter, a long plateau,
 * and a sharp ease-in exit — distinctly different from a settling spring.
 *
 * Every helper takes a local frame number relative to the element's start
 * frame, so callers can write:
 *
 *     const a = punctual(frame - 24, hold = 36);   // appears at f=24, holds 36f
 */

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const easeOutQuart = (x: number): number => 1 - Math.pow(1 - clamp01(x), 4);
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const easeOutBack = (x: number, overshoot = 1.2): number => {
  const t = clamp01(x);
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInQuart = (x: number): number => Math.pow(clamp01(x), 4);
export const easeInCubic = (x: number): number => Math.pow(clamp01(x), 3);

/**
 * Punctual alpha 0→1→0 across a snap-in / hold / snap-out window.
 *
 * @param localFrame   frame relative to the element's start (negative = not yet)
 * @param hold         frames to hold at full value (the "show the user" plateau)
 * @param inFrames     frames for the snap-in (default 6 ≈ 0.2s — sharp)
 * @param outFrames    frames for the snap-out (default 6)
 */
export function punctualAlpha(
  localFrame: number,
  hold: number,
  inFrames = 6,
  outFrames = 6,
): number {
  if (localFrame < 0) return 0;
  if (localFrame < inFrames) return easeOutQuart(localFrame / inFrames);
  const exitStart = inFrames + hold;
  if (localFrame < exitStart) return 1;
  const exitProgress = (localFrame - exitStart) / outFrames;
  if (exitProgress >= 1) return 0;
  return 1 - easeInQuart(exitProgress);
}

/**
 * Snap-in only (no exit). For elements that appear and stay until the scene ends.
 */
export function snapIn(localFrame: number, frames = 8): number {
  if (localFrame < 0) return 0;
  if (localFrame >= frames) return 1;
  return easeOutQuart(localFrame / frames);
}

/**
 * Snap-in with a touch of overshoot — good for labels/pills that should
 * feel "stamped on."
 */
export function snapInBack(localFrame: number, frames = 10, overshoot = 1.4): number {
  if (localFrame < 0) return 0;
  if (localFrame >= frames) return 1;
  return easeOutBack(localFrame / frames, overshoot);
}

/**
 * Snap-out only.
 */
export function snapOut(localFrame: number, frames = 8): number {
  if (localFrame <= 0) return 1;
  if (localFrame >= frames) return 0;
  return 1 - easeInQuart(localFrame / frames);
}

/**
 * Linear bar-grid helper — given the scene's local frame and a tempo, returns
 * the beat number (with fractional part).
 */
export function beatAt(localFrame: number, fps: number, beatSeconds: number): number {
  return (localFrame / fps) / beatSeconds;
}

/**
 * 110-BPM kick-style envelope — sharp attack on the downbeat, decays through
 * the rest of the beat. Layer onto scale, opacity, glow etc. to give the whole
 * frame a beat-driven "breathe" so nothing feels static between events.
 *
 * Returns a positive amplitude in [0, amp]. Add to 1 for scale: `1 + beatPulse(...)`.
 */
export interface BeatPulseOpts {
  bpm?: number;
  fps?: number;
  amp?: number;
  offsetFrames?: number;
  decay?: number;
}

export function beatPulse(frame: number, opts: BeatPulseOpts = {}): number {
  const { bpm = 110, fps = 30, amp = 0.03, offsetFrames = 0, decay = 3 } = opts;
  const framesPerBeat = (60 / bpm) * fps;
  const adj = frame + offsetFrames;
  const phase = ((adj % framesPerBeat) + framesPerBeat) % framesPerBeat;
  const t = phase / framesPerBeat;
  return amp * Math.exp(-decay * t);
}

/**
 * Continuous sine bob — smooth back-and-forth that's nice for keeping text
 * "alive" while it's on screen. `amp` is in whatever unit the caller uses
 * (typically pixels for translate or fractions for scale).
 */
export function sineBob(frame: number, periodFrames: number, amp: number, phase: number = 0): number {
  return amp * Math.sin(((frame + phase) / periodFrames) * 2 * Math.PI);
}
