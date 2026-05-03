import { useCallback, useEffect, useRef, useState } from "react";
import {
  MotionSegmenter,
  WordRecognizer,
  loadDefaultBundle,
  type ScoredCandidate,
  frameFromLandmarks,
  VlmFrameSampler,
  recognizeWithVlm,
} from "../lib/asl";
import type { HandLandmarks } from "./useMediaPipeHands";

/**
 * Hybrid ASL word recognizer.
 *
 * MediaPipe Hands → motion segmenter detects sign start/stop. While a sign is
 * in progress, two parallel paths capture data:
 *
 *  - Landmark sequence (in-memory) → fed to local DTW against the bundled
 *    WLASL + personalized templates. Fast, offline, gives a near-miss
 *    diagnostic when no template matches confidently.
 *  - JPEG frames at ~8fps from the bound <video> element → on segment end,
 *    POSTed to the backend `/api/asl/recognize` Gemini Vision proxy. Returns
 *    a single predicted label (or null when the model says "unclear").
 *
 * `onWord` fires once per source. By convention DTW is the instant-feedback
 * channel and VLM is the authoritative answer (~1.5s after the sign ends).
 *
 * Knobs:
 *   `maxDistance`  reject DTW matches with distance above this (default 2.0).
 *                  Live captures from a different user/angle than the templates
 *                  routinely score 1.3–1.8 because the featurizer doesn't do
 *                  rotation normalization, so anything tighter rejects everything.
 *   `margin`       require runner-up to be `margin`× worse than best. 1.0 is a
 *                  no-op (top-K is sorted, second/best is always >= 1); set >1
 *                  to require real separation between top two candidates.
 *   `videoElement` <video> element for VLM frame capture. Required for VLM.
 *   `vlmEnabled`   gate VLM calls; defaults to true when videoElement is given.
 */

export type WordSource = "vlm" | "dtw";

export interface WordSignOptions {
  bundleUrl?: string;
  maxDistance?: number;
  margin?: number;
  videoElement?: HTMLVideoElement | null;
  vlmEnabled?: boolean;
}

export interface VlmStatus {
  pending: boolean;
  lastWord: string | null;
  lastRaw: string;
  lastLatencyMs: number | null;
  lastError: string | null;
}

export interface WordSignState {
  isReady: boolean;
  loadError: string | null;
  templateCount: number;
  labels: string[];
  segmenterState: "idle" | "active" | "cooldown";
  activeFrames: number;
  lastWord: string | null;
  lastDistance: number | null;
  lastCandidates: ScoredCandidate[];
  /** Set when a segment was scored but failed the maxDistance/margin gate.
   *  Lets the UI tell the user "I saw something close to X" instead of going
   *  silent — the #1 reason the feature feels broken. */
  lastReject: { topLabel: string; distance: number; reason: string } | null;
  vlm: VlmStatus;
}

const INITIAL_VLM: VlmStatus = {
  pending: false,
  lastWord: null,
  lastRaw: "",
  lastLatencyMs: null,
  lastError: null,
};

export function useWordSignRecognition(
  onWord: (word: string, distance: number, source: WordSource) => void,
  opts: WordSignOptions = {},
) {
  const {
    bundleUrl = "/asl-templates.json",
    maxDistance = 2.0,
    margin = 1.0,
    videoElement = null,
    vlmEnabled,
  } = opts;
  const vlmActuallyEnabled = (vlmEnabled ?? true) && !!videoElement;

  const recognizerRef = useRef<WordRecognizer | null>(null);
  const segmenterRef = useRef<MotionSegmenter>(new MotionSegmenter());
  const samplerRef = useRef<VlmFrameSampler | null>(null);
  const prevSegStateRef = useRef<"idle" | "active" | "cooldown">("idle");
  const onWordRef = useRef(onWord);
  onWordRef.current = onWord;

  const [state, setState] = useState<WordSignState>({
    isReady: false,
    loadError: null,
    templateCount: 0,
    labels: [],
    segmenterState: "idle",
    activeFrames: 0,
    lastWord: null,
    lastDistance: null,
    lastCandidates: [],
    lastReject: null,
    vlm: INITIAL_VLM,
  });

  // One-time bundle load.
  useEffect(() => {
    let cancelled = false;
    const rec = new WordRecognizer({ maxDistance, margin });
    recognizerRef.current = rec;
    console.log('[ASL] loading template bundle', { bundleUrl, maxDistance, margin });
    loadDefaultBundle(bundleUrl)
      .then((bundle) => {
        if (cancelled) return;
        rec.loadBundle(bundle);
        console.log('[ASL] template bundle loaded', {
          labels: rec.labels.length,
          templates: rec.templateCount,
          words: rec.labels,
        });
        setState((s) => ({
          ...s,
          isReady: true,
          templateCount: rec.templateCount,
          labels: rec.labels,
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[ASL] template bundle load failed', e);
        setState((s) => ({
          ...s,
          loadError: e instanceof Error ? e.message : String(e),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [bundleUrl, maxDistance, margin]);

  // (Re)create the frame sampler when the bound video element or enable flag changes.
  useEffect(() => {
    if (vlmActuallyEnabled && videoElement) {
      samplerRef.current = new VlmFrameSampler(videoElement);
      console.log('[ASL/VLM] frame sampler armed');
    } else {
      if (samplerRef.current) samplerRef.current.reset();
      samplerRef.current = null;
    }
    return () => {
      if (samplerRef.current) samplerRef.current.reset();
    };
  }, [videoElement, vlmActuallyEnabled]);

  const processLandmarks = useCallback((handData: HandLandmarks) => {
    const rec = recognizerRef.current;
    const seg = segmenterRef.current;
    if (!rec) return;
    // Pass MediaPipe's per-hand 'Left'/'Right' labels through so the
    // featurizer can place each hand in the correct template slot. Without
    // this, two-hand signs (school, help, language…) get hands swapped
    // ~50% of the time depending on detection order.
    const frame = frameFromLandmarks(handData.landmarks, handData.handedness ?? []);
    const completed = seg.update(frame);

    // Drive the VLM frame sampler off segmenter state transitions.
    const prevSeg = prevSegStateRef.current;
    const curSeg = seg.state;
    const sampler = samplerRef.current;
    if (sampler && prevSeg !== "active" && curSeg === "active") {
      sampler.start();
    }
    prevSegStateRef.current = curSeg;

    setState((s) =>
      s.segmenterState === seg.state && s.activeFrames === seg.activeFrameCount
        ? s
        : { ...s, segmenterState: seg.state, activeFrames: seg.activeFrameCount },
    );
    if (completed === null) return;

    // Sign ended — finalize sampler, run DTW now, fire VLM async.
    const frames = sampler ? sampler.stop() : [];

    const candidates = rec.topK(completed, 5);
    const match = rec.recognize(completed);
    const top = candidates[0];
    const second = candidates[1];
    let reject: WordSignState["lastReject"] = null;
    if (!match && top) {
      const reason =
        top.distance > maxDistance
          ? `distance ${top.distance.toFixed(2)} > max ${maxDistance}`
          : second && second.distance / top.distance < margin
            ? `runner-up too close (${(second.distance / top.distance).toFixed(2)} < margin ${margin})`
            : 'gated';
      reject = { topLabel: top.label, distance: top.distance, reason };
    }
    console.log('[ASL] segment scored', {
      frames: completed.frames.length,
      vlmFrames: frames.length,
      top3: candidates.slice(0, 3).map((c) => `${c.label}=${c.distance.toFixed(2)}`),
      match: match ? `${match.label}@${match.distance.toFixed(2)}` : `REJECT (${reject?.reason ?? 'no candidates'})`,
    });
    setState((s) => ({
      ...s,
      lastCandidates: candidates,
      lastWord: match ? match.label : s.lastWord,
      lastDistance: match ? match.distance : s.lastDistance,
      lastReject: reject,
    }));
    if (match) onWordRef.current(match.label, match.distance, "dtw");

    if (vlmActuallyEnabled && frames.length >= 3) {
      setState((s) => ({
        ...s,
        vlm: { ...s.vlm, pending: true, lastError: null },
      }));
      const t0 = performance.now();
      recognizeWithVlm(frames)
        .then((result) => {
          const rt = Math.round(performance.now() - t0);
          console.log(
            `[ASL/VLM] label=${result.label ?? "(unclear)"} raw="${result.raw}" server=${result.latencyMs}ms round-trip=${rt}ms`,
          );
          setState((s) => ({
            ...s,
            vlm: {
              pending: false,
              lastWord: result.label,
              lastRaw: result.raw,
              lastLatencyMs: result.latencyMs,
              lastError: null,
            },
          }));
          if (result.label) {
            onWordRef.current(result.label, result.latencyMs, "vlm");
          }
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[ASL/VLM] recognize failed:', msg);
          setState((s) => ({
            ...s,
            vlm: { ...s.vlm, pending: false, lastError: msg },
          }));
        });
    } else if (vlmActuallyEnabled) {
      console.warn('[ASL/VLM] segment had only', frames.length, 'frames; skipping VLM');
    }
  }, [maxDistance, margin, vlmActuallyEnabled]);

  const reset = useCallback(() => {
    segmenterRef.current.reset();
    if (samplerRef.current) samplerRef.current.reset();
    prevSegStateRef.current = "idle";
    setState((s) => ({
      ...s,
      segmenterState: "idle",
      activeFrames: 0,
      lastWord: null,
      lastDistance: null,
      lastCandidates: [],
      lastReject: null,
      vlm: INITIAL_VLM,
    }));
  }, []);

  return { ...state, processLandmarks, reset };
}
