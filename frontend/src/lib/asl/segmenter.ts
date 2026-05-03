/**
 * Motion segmenter: emits a complete frame sequence each time a sign ends.
 *
 *   IDLE     waiting for motion
 *   ACTIVE   inside a sign, collecting frames
 *   COOLDOWN sign just emitted, settle period before next
 *
 * Defaults are tuned to match the Python segmenter so DTW behaves the same.
 */

import { type Frame, frameMotion } from "./features";

export interface SegmenterConfig {
  motionStartThreshold: number;
  motionStopThreshold: number;
  minActiveFrames: number;
  maxActiveFrames: number;
  stopHoldFrames: number;
  cooldownFrames: number;
}

export const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  motionStartThreshold: 0.010,
  motionStopThreshold: 0.006,
  minActiveFrames: 5,
  maxActiveFrames: 90,
  stopHoldFrames: 5,
  cooldownFrames: 5,
};

export type SegmenterState = "idle" | "active" | "cooldown";

export interface Segment {
  frames: Frame[];
}

export class MotionSegmenter {
  private cfg: SegmenterConfig;
  private _state: SegmenterState = "idle";
  private prev: Frame | null = null;
  private active: Frame[] = [];
  private belowStop = 0;
  private cooldownLeft = 0;

  constructor(cfg: Partial<SegmenterConfig> = {}) {
    this.cfg = { ...DEFAULT_SEGMENTER_CONFIG, ...cfg };
  }

  get state(): SegmenterState { return this._state; }
  get activeFrameCount(): number { return this.active.length; }

  reset(): void {
    this._state = "idle";
    this.prev = null;
    this.active = [];
    this.belowStop = 0;
    this.cooldownLeft = 0;
  }

  update(frame: Frame): Segment | null {
    const motion = frameMotion(this.prev, frame);
    this.prev = frame;

    if (this._state === "cooldown") {
      this.cooldownLeft -= 1;
      if (this.cooldownLeft <= 0) this._state = "idle";
      return null;
    }

    if (this._state === "idle") {
      if (motion >= this.cfg.motionStartThreshold) {
        this._state = "active";
        this.active = [frame];
        this.belowStop = 0;
      }
      return null;
    }

    // ACTIVE
    this.active.push(frame);
    if (motion < this.cfg.motionStopThreshold) this.belowStop += 1;
    else this.belowStop = 0;

    const finished =
      this.belowStop >= this.cfg.stopHoldFrames ||
      this.active.length >= this.cfg.maxActiveFrames;
    if (!finished) return null;

    let emitted: Segment | null = null;
    if (this.active.length >= this.cfg.minActiveFrames) {
      emitted = { frames: this.active.slice() };
    }
    this.active = [];
    this.belowStop = 0;
    this._state = "cooldown";
    this.cooldownLeft = this.cfg.cooldownFrames;
    return emitted;
  }
}
