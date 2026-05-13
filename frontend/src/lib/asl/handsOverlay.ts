/**
 * Visualisation-only hand-pose overlay for the ASL chat surface.
 *
 * Wraps a MediaPipe Tasks Vision `HandLandmarker` and draws landmark dots +
 * connection lines onto a canvas that sits on top of the live <video>. The
 * overlay is decoupled from the recognition pipeline — this only paints
 * pixels.
 *
 * Init failures resolve cleanly so users on browsers without MediaPipe (or
 * with the WASM CDN blocked) still get the chat experience without an
 * overlay.
 */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

interface HandsOverlayOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
}

const TASKS_VISION_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Parallel-array connection list pulled from the MediaPipe spec — the public
// `HandLandmarker.HAND_CONNECTIONS` static is sometimes empty when bundled
// via Vite, so we hardcode the topology to keep the overlay deterministic.
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export class HandsOverlay {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private lastTimestampMs = -1;
  private stopped = false;

  constructor({ video, canvas }: HandsOverlayOptions) {
    this.video = video;
    this.canvas = canvas;
  }

  async start(): Promise<void> {
    this.stopped = false;
    try {
      const fileset = await FilesetResolver.forVisionTasks(TASKS_VISION_CDN);
      if (this.stopped) return;
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_MODEL,
          delegate: "GPU",
        },
        numHands: 2,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (e) {
      // Browser doesn't support MP / CDN blocked / WebGL unavailable. Bail
      // silently so the chat still works without an overlay.
      console.warn("[asl] HandsOverlay init failed; overlay disabled", e);
      this.landmarker = null;
      return;
    }
    if (this.stopped) {
      this.landmarker?.close();
      this.landmarker = null;
      return;
    }
    this.loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // best-effort
      }
      this.landmarker = null;
    }
  }

  private loop = (): void => {
    if (this.stopped) return;
    this.rafId = requestAnimationFrame(this.loop);
    const lm = this.landmarker;
    if (!lm) return;
    const video = this.video;
    if (
      !video ||
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return;
    }

    this.syncCanvasToVideo();

    const ts = performance.now();
    if (ts <= this.lastTimestampMs) return;
    this.lastTimestampMs = ts;

    let result: HandLandmarkerResult | null = null;
    try {
      result = lm.detectForVideo(video, ts);
    } catch {
      return;
    }
    if (!result) return;
    this.draw(result);
  };

  private syncCanvasToVideo(): void {
    // The video element's CSS box drives the overlay size — reading
    // bounding box each frame keeps the overlay aligned regardless of
    // aspect-ratio CSS, devicePixelRatio, or window resize.
    const rect = this.video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== targetW) this.canvas.width = targetW;
    if (this.canvas.height !== targetH) this.canvas.height = targetH;
  }

  private draw(result: HandLandmarkerResult): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!result.landmarks || result.landmarks.length === 0) return;

    // The chat preview mirrors the user (-scale-x via object-cover doesn't,
    // but the camera feed is naturally a selfie view). MediaPipe returns
    // normalized coordinates in source-image space, so they line up with
    // the video element directly. No mirroring needed here — the route's
    // <video> renders un-mirrored.
    ctx.lineWidth = Math.max(1.5, w / 320);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    const dotR = Math.max(2, w / 220);

    for (const hand of result.landmarks) {
      // Connection lines.
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = hand[a];
        const pb = hand[b];
        if (!pa || !pb) continue;
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
      }
      ctx.stroke();

      // Landmark dots in the primary brand colour. We resolve the CSS
      // variable lazily so theme switches paint with the right hue.
      ctx.fillStyle = resolvePrimary();
      for (const lm of hand) {
        ctx.beginPath();
        ctx.arc(
          (lm as NormalizedLandmark).x * w,
          (lm as NormalizedLandmark).y * h,
          dotR,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}

let cachedPrimary: string | null = null;
function resolvePrimary(): string {
  if (cachedPrimary) return cachedPrimary;
  if (typeof window === "undefined") return "#5fbf78";
  try {
    const root = document.documentElement;
    const v = getComputedStyle(root).getPropertyValue("--color-primary").trim();
    cachedPrimary = v || "#5fbf78";
  } catch {
    cachedPrimary = "#5fbf78";
  }
  return cachedPrimary;
}
