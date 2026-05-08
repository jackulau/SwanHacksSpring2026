// ASL pipeline glue — webcam capture → motion segmenter → frame
// sampler → VLM provider → asl_segments persistence.
//
// Built on top of the existing motion segmenter (lib/asl/segmenter.ts)
// and frame sampler (lib/asl/vlmRecognizer.ts) but factored into a
// single hook-friendly orchestrator so the /asl chat surface only
// has to call start/stop and listen for completed segments.

import { pb } from "../pocketbase";
import type { AslSegmentRecord } from "../types";
import type { VlmProvider, VlmTranscription } from "./providers";

export interface PipelineEvent {
  type: "started" | "segment_start" | "segment_end" | "result" | "error";
  payload?: unknown;
}

export interface PipelineSettings {
  motionThreshold: number;
  minSegmentMs: number;
  maxSegmentMs: number;
  sampleFps: number;
  maxFramesPerSegment: number;
  jpegQuality: number;
  resampleWidth: number;
  reSignBelowConfidence: number;
}

export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  motionThreshold: 18,
  minSegmentMs: 1500,
  maxSegmentMs: 2500,
  sampleFps: 6,
  maxFramesPerSegment: 8,
  jpegQuality: 0.7,
  resampleWidth: 320,
  reSignBelowConfidence: 0.45,
};

export interface SegmentResult {
  id: string;
  frames: string[];
  durationMs: number;
  result: VlmTranscription;
}

interface CtorArgs {
  video: HTMLVideoElement;
  provider: VlmProvider;
  settings?: Partial<PipelineSettings>;
  sessionId?: string;
  userId?: string | null;
  onEvent?: (e: PipelineEvent) => void;
  onResult?: (r: SegmentResult) => void;
  persist?: boolean;
}

/**
 * Lightweight motion-pause segmenter built on canvas frame diffing.
 * We don't reuse the MediaPipe-Hands segmenter because we want a
 * provider-agnostic perception layer (no hand landmarks required;
 * the VLM is the perception layer per the new architecture). The
 * threshold is configurable and we debounce so single-frame blips
 * don't trigger a segment.
 */
export class AslPipeline {
  private video: HTMLVideoElement;
  private provider: VlmProvider;
  private settings: PipelineSettings;
  private sessionId: string;
  private userId: string | null;
  private persist: boolean;
  private onEvent: (e: PipelineEvent) => void;
  private onResult: (r: SegmentResult) => void;

  private canvas: HTMLCanvasElement;
  private prevPixels: Uint8ClampedArray | null = null;
  private active = false;
  private rafHandle: number | null = null;
  private lastSampleTs = 0;
  private segmentStartTs: number | null = null;
  private quietSince: number | null = null;
  private framesBuf: string[] = [];

  constructor(args: CtorArgs) {
    this.video = args.video;
    this.provider = args.provider;
    this.settings = { ...DEFAULT_PIPELINE_SETTINGS, ...args.settings };
    this.sessionId =
      args.sessionId ?? `asl_${Math.random().toString(36).slice(2, 10)}`;
    this.userId = args.userId ?? null;
    this.persist = args.persist ?? true;
    this.onEvent = args.onEvent ?? (() => undefined);
    this.onResult = args.onResult ?? (() => undefined);
    this.canvas = document.createElement("canvas");
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.prevPixels = null;
    this.segmentStartTs = null;
    this.quietSince = null;
    this.framesBuf = [];
    this.lastSampleTs = 0;
    this.onEvent({ type: "started" });
    this.tick();
  }

  stop() {
    this.active = false;
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  setProvider(p: VlmProvider) {
    this.provider = p;
  }

  setSettings(patch: Partial<PipelineSettings>) {
    this.settings = { ...this.settings, ...patch };
  }

  /**
   * Manually retranscribe a single set of frames — used by the chat
   * surface "tap to re-sign" affordance. Bypasses the segmenter and
   * just calls the provider.
   */
  async transcribeFrames(frames: string[]): Promise<VlmTranscription> {
    return await this.provider.transcribe(frames);
  }

  private tick = () => {
    if (!this.active) return;
    this.rafHandle = requestAnimationFrame(this.tick);
    const now = performance.now();
    const intervalMs = 1000 / Math.max(1, this.settings.sampleFps);
    if (now - this.lastSampleTs < intervalMs) return;
    this.lastSampleTs = now;

    const motion = this.measureMotion();
    if (motion === null) return;

    const inSegment = this.segmentStartTs !== null;
    const above = motion >= this.settings.motionThreshold;

    if (above && !inSegment) {
      // Start a new segment.
      this.segmentStartTs = now;
      this.quietSince = null;
      this.framesBuf = [];
      this.captureFrame();
      this.onEvent({ type: "segment_start" });
    } else if (above && inSegment) {
      this.quietSince = null;
      this.captureFrame();
      const dur = now - (this.segmentStartTs ?? now);
      if (dur >= this.settings.maxSegmentMs) this.flushSegment(now);
    } else if (!above && inSegment) {
      // Debounce: wait for ~250ms of quiet before ending the segment.
      if (this.quietSince === null) this.quietSince = now;
      const quietMs = now - (this.quietSince ?? now);
      const dur = now - (this.segmentStartTs ?? now);
      if (quietMs > 250 && dur >= this.settings.minSegmentMs) {
        this.flushSegment(now);
      }
    }
  };

  private measureMotion(): number | null {
    if (!this.video.videoWidth) return null;
    const w = Math.min(160, this.video.videoWidth);
    const h = Math.round((this.video.videoHeight / this.video.videoWidth) * w);
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    if (!this.prevPixels || this.prevPixels.length !== data.length) {
      this.prevPixels = new Uint8ClampedArray(data);
      return 0;
    }
    let sumDiff = 0;
    let count = 0;
    // Stride to keep the loop cheap on RAF.
    for (let i = 0; i < data.length; i += 16) {
      const dr = Math.abs(data[i] - this.prevPixels[i]);
      const dg = Math.abs(data[i + 1] - this.prevPixels[i + 1]);
      const db = Math.abs(data[i + 2] - this.prevPixels[i + 2]);
      sumDiff += (dr + dg + db) / 3;
      count++;
    }
    this.prevPixels.set(data);
    return count > 0 ? sumDiff / count : 0;
  }

  private captureFrame() {
    if (this.framesBuf.length >= this.settings.maxFramesPerSegment) return;
    const w = this.settings.resampleWidth;
    const h = Math.round((this.video.videoHeight / this.video.videoWidth) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.video, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", this.settings.jpegQuality);
    // Strip the "data:image/jpeg;base64," prefix; providers want the
    // raw base64 payload.
    const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    this.framesBuf.push(base64);
  }

  private async flushSegment(endTs: number) {
    const startTs = this.segmentStartTs ?? endTs;
    const frames = this.framesBuf;
    this.segmentStartTs = null;
    this.quietSince = null;
    this.framesBuf = [];
    if (frames.length === 0) return;
    this.onEvent({ type: "segment_end", payload: { frameCount: frames.length } });
    const durationMs = endTs - startTs;
    let result: VlmTranscription;
    try {
      result = await this.provider.transcribe(frames);
    } catch (err) {
      this.onEvent({ type: "error", payload: err });
      return;
    }
    const id = `local-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const out: SegmentResult = { id, frames, durationMs, result };
    this.onEvent({ type: "result", payload: out });
    this.onResult(out);

    if (this.persist && this.userId) {
      void this.persistSegment(out, durationMs);
    }
  }

  private async persistSegment(out: SegmentResult, durationMs: number) {
    if (!this.userId) return;
    try {
      await pb.collection("asl_segments").create<AslSegmentRecord>({
        user: this.userId,
        session_id: this.sessionId,
        transcription: out.result.transcription,
        confidence: out.result.confidence,
        provider: this.provider.id,
        model: this.provider.model,
        duration_ms: Math.round(durationMs),
        frames: out.frames.map((f) => ({
          data_url: `data:image/jpeg;base64,${f}`,
        })),
        meta: { latencyMs: out.result.latencyMs },
        resigned: false,
      });
    } catch {
      // Persistence is best-effort; chat row is already on screen.
    }
  }
}
