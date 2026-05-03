/**
 * Per-frame landmark featurizer + sequence resampler.
 *
 * Mirrors the Python pipeline at `src/aether/sign/sequence/features.py` so a
 * browser-side query produces the same features the Python templates were
 * built from. Translation- and scale-normalized; drops MediaPipe's noisy z;
 * length-normalizes every sequence to TEMPLATE_LENGTH frames.
 */

import type { NormalizedLandmarkList } from "@mediapipe/hands";

export const HANDS_PER_FRAME = 2;
export const LANDMARKS_PER_HAND = 21;
export const USE_COORDS_IN_FEATURE = 2; // x, y only — drop z
export const FEATURE_DIM =
  HANDS_PER_FRAME * LANDMARKS_PER_HAND * USE_COORDS_IN_FEATURE; // 84
export const TEMPLATE_LENGTH = 30;
const PER_HAND_FEATURE = LANDMARKS_PER_HAND * USE_COORDS_IN_FEATURE;

export interface Frame {
  /** (HANDS_PER_FRAME, LANDMARKS_PER_HAND, 3) flat row-major */
  landmarks: Float32Array;
  /** [right_present, left_present] */
  mask: [boolean, boolean];
}

const LANDMARKS_FLAT_SIZE = LANDMARKS_PER_HAND * 3;

export function frameFromLandmarks(
  hands: NormalizedLandmarkList[],
  handednessLabels: string[],
): Frame {
  const landmarks = new Float32Array(HANDS_PER_FRAME * LANDMARKS_FLAT_SIZE);
  const mask: [boolean, boolean] = [false, false];

  // Index right hand into slot 0, left into slot 1; if MediaPipe hasn't
  // labeled handedness, fill in order. This mirrors the Python featurizer.
  let rightIdx = -1;
  let leftIdx = -1;
  for (let i = 0; i < hands.length; i++) {
    const label = (handednessLabels[i] || "").toLowerCase();
    if (label.startsWith("r") && rightIdx < 0) rightIdx = i;
    else if (label.startsWith("l") && leftIdx < 0) leftIdx = i;
  }

  const fillSlot = (slot: 0 | 1, src: NormalizedLandmarkList) => {
    const base = slot * LANDMARKS_FLAT_SIZE;
    for (let j = 0; j < LANDMARKS_PER_HAND; j++) {
      landmarks[base + j * 3 + 0] = src[j].x;
      landmarks[base + j * 3 + 1] = src[j].y;
      landmarks[base + j * 3 + 2] = src[j].z;
    }
    mask[slot] = true;
  };

  if (rightIdx < 0 && leftIdx < 0) {
    if (hands[0]) fillSlot(0, hands[0]);
    if (hands[1]) fillSlot(1, hands[1]);
  } else {
    if (rightIdx >= 0) fillSlot(0, hands[rightIdx]);
    if (leftIdx >= 0) fillSlot(1, hands[leftIdx]);
  }
  return { landmarks, mask };
}

export function featurizeFrame(frame: Frame): Float32Array {
  const out = new Float32Array(FEATURE_DIM);
  for (let i = 0 as 0 | 1; i < HANDS_PER_FRAME; i++) {
    if (!frame.mask[i]) continue;
    const baseRaw = i * LANDMARKS_FLAT_SIZE;
    const baseOut = i * PER_HAND_FEATURE;
    const wristX = frame.landmarks[baseRaw + 0];
    const wristY = frame.landmarks[baseRaw + 1];
    const mcpX = frame.landmarks[baseRaw + 9 * 3 + 0];
    const mcpY = frame.landmarks[baseRaw + 9 * 3 + 1];
    const dx = mcpX - wristX;
    const dy = mcpY - wristY;
    const scale = Math.hypot(dx, dy) + 1e-6;
    for (let j = 0; j < LANDMARKS_PER_HAND; j++) {
      const rx = frame.landmarks[baseRaw + j * 3 + 0];
      const ry = frame.landmarks[baseRaw + j * 3 + 1];
      out[baseOut + j * USE_COORDS_IN_FEATURE + 0] = (rx - wristX) / scale;
      out[baseOut + j * USE_COORDS_IN_FEATURE + 1] = (ry - wristY) / scale;
    }
  }
  return out;
}

/** Linear-interpolate a (T, D) sequence (rows of length D) to targetT rows. */
export function resampleSequence(
  rows: Float32Array[],
  targetT: number,
): Float32Array[] {
  if (rows.length === 0) return [];
  if (rows.length === 1) {
    const out: Float32Array[] = new Array(targetT);
    for (let i = 0; i < targetT; i++) out[i] = rows[0].slice();
    return out;
  }
  const out: Float32Array[] = new Array(targetT);
  const last = rows.length - 1;
  for (let i = 0; i < targetT; i++) {
    const srcIdx = (i * last) / (targetT - 1);
    const floor = Math.floor(srcIdx);
    const ceil = Math.min(floor + 1, last);
    const w = srcIdx - floor;
    const a = rows[floor];
    const b = rows[ceil];
    const merged = new Float32Array(a.length);
    for (let k = 0; k < a.length; k++) merged[k] = (1 - w) * a[k] + w * b[k];
    out[i] = merged;
  }
  return out;
}

/** Convenience: take frames → per-frame featurized rows → resample to TEMPLATE_LENGTH. */
export function featurizeSequence(
  frames: Frame[],
  lengthNormalize = true,
): Float32Array[] {
  if (frames.length === 0) return [];
  const stacked = frames.map(featurizeFrame);
  if (!lengthNormalize || stacked.length === TEMPLATE_LENGTH) return stacked;
  return resampleSequence(stacked, TEMPLATE_LENGTH);
}

/** Total per-landmark displacement between two frames. Used by the segmenter. */
export function frameMotion(prev: Frame | null, curr: Frame): number {
  if (prev === null) return 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0 as 0 | 1; i < HANDS_PER_FRAME; i++) {
    if (!prev.mask[i] || !curr.mask[i]) continue;
    const base = i * LANDMARKS_FLAT_SIZE;
    for (let k = 0; k < LANDMARKS_FLAT_SIZE; k++) {
      const d = curr.landmarks[base + k] - prev.landmarks[base + k];
      sumSq += d * d;
    }
    n += LANDMARKS_PER_HAND;
  }
  if (n === 0) return 0;
  return Math.sqrt(sumSq) / n;
}
