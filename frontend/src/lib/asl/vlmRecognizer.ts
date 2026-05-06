import { pb } from "../pocketbase";

/**
 * Vision-language model recognizer for ASL signs.
 *
 * Pairs with `MotionSegmenter`: while a sign is in progress (segmenter state =
 * "active") `VlmFrameSampler` snapshots the webcam at ~8fps. When the sign
 * ends, the accumulated frames are subsampled to <=16 and POSTed to the
 * backend `/api/asl/recognize` route, which forwards to Gemini Vision and
 * returns a single predicted label (or null if the model says "unclear").
 *
 * Why frames over a video file:
 *   - No MediaRecorder container/codec quirks across browsers.
 *   - 8 well-spaced JPEGs cover a 1–3s sign and stay under ~600KB total.
 *   - Lower latency: no encode-finalize step on stop.
 */

export interface VlmResult {
  label: string | null;
  raw: string;
  latencyMs: number;
}

export interface VlmSamplerOptions {
  fps?: number;
  jpegQuality?: number;
  maxFrames?: number;
  maxWidth?: number;
}

export class VlmFrameSampler {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private timer: number | null = null;
  private frames: string[] = [];
  private fps: number;
  private jpegQuality: number;
  private maxFrames: number;
  private maxWidth: number;

  constructor(video: HTMLVideoElement, opts: VlmSamplerOptions = {}) {
    this.video = video;
    this.canvas = document.createElement("canvas");
    this.fps = opts.fps ?? 8;
    this.jpegQuality = opts.jpegQuality ?? 0.7;
    this.maxFrames = opts.maxFrames ?? 16;
    this.maxWidth = opts.maxWidth ?? 320;
  }

  /** Begin sampling frames at the configured fps. Idempotent. */
  start(): void {
    if (this.timer !== null) return;
    this.frames = [];
    this.captureFrame();
    this.timer = window.setInterval(() => this.captureFrame(), 1000 / this.fps);
  }

  /**
   * Stop sampling and return the buffered frames, evenly subsampled down to
   * at most `maxFrames`. Resets the internal buffer.
   */
  stop(): string[] {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const collected = this.frames;
    this.frames = [];
    if (collected.length <= this.maxFrames) return collected;
    const step = (collected.length - 1) / (this.maxFrames - 1);
    const sampled: string[] = [];
    for (let i = 0; i < this.maxFrames; i++) {
      sampled.push(collected[Math.round(i * step)]);
    }
    return sampled;
  }

  /** Discard any in-flight frames and stop. */
  reset(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.frames = [];
  }

  get isActive(): boolean {
    return this.timer !== null;
  }

  private captureFrame(): void {
    const v = this.video;
    if (!v.videoWidth || !v.videoHeight) return;
    const scale = Math.min(1, this.maxWidth / v.videoWidth);
    const w = Math.max(1, Math.round(v.videoWidth * scale));
    const h = Math.max(1, Math.round(v.videoHeight * scale));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = this.canvas.toDataURL("image/jpeg", this.jpegQuality);
    const comma = dataUrl.indexOf(",");
    this.frames.push(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
  }
}

/**
 * POST sampled frames to the backend Gemini proxy. Throws on network/HTTP
 * failure so callers can surface a clear error in the UI.
 */
export async function recognizeWithVlm(frames: string[]): Promise<VlmResult> {
  if (frames.length === 0) {
    return { label: null, raw: "", latencyMs: 0 };
  }
  const base = pb.baseURL.replace(/\/$/, "");
  const start = performance.now();
  const res = await fetch(`${base}/api/asl/recognize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames }),
  });
  const clientLatencyMs = Math.round(performance.now() - start);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      detail = errBody.error || errBody.detail || detail;
    } catch {
      // body wasn't json — fall through with statusText
    }
    throw new Error(`VLM ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as {
    label: string | null;
    raw: string;
    latencyMs?: number;
  };
  return {
    label: data.label,
    raw: data.raw,
    latencyMs: data.latencyMs ?? clientLatencyMs,
  };
}
