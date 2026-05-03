import { useCallback, useEffect, useRef, useState } from "react";
import {
  MotionSegmenter,
  WordRecognizer,
  loadDefaultBundle,
  type ScoredCandidate,
  frameFromLandmarks,
} from "../lib/asl";
import type { HandLandmarks } from "./useMediaPipeHands";

/**
 * DTW-based ASL word recognizer for the browser. Loads the bundled
 * `/asl-templates.json` once, runs MediaPipe-fed landmarks through a motion
 * segmenter, scores completed segments via DTW, and fires `onWord(label)`
 * when a confident match passes the gate.
 *
 * Designed to be drop-in compatible with the existing `useSignLanguage`
 * hook's `processLandmarks` signature so you can route MediaPipe Hands to
 * letter recognition + word recognition in parallel.
 *
 * Knobs:
 *   `maxDistance`  reject matches with DTW distance above this (default 2.0).
 *                  The previous 1.2 default was too tight for the unrotated
 *                  wrist-relative features; live captures from a different
 *                  user/angle than the templates routinely score 1.3–1.8.
 *   `margin`       require the runner-up to be `margin`× worse than the
 *                  best. 1.0 is effectively a no-op (top-K is sorted, so
 *                  second/best is always >= 1); set >1 to require real
 *                  separation between top two candidates.
 */
export interface WordSignOptions {
  bundleUrl?: string;
  maxDistance?: number;
  margin?: number;
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
}

export function useWordSignRecognition(
  onWord: (word: string, distance: number) => void,
  opts: WordSignOptions = {},
) {
  const { bundleUrl = "/asl-templates.json", maxDistance = 2.0, margin = 1.0 } = opts;

  const recognizerRef = useRef<WordRecognizer | null>(null);
  const segmenterRef = useRef<MotionSegmenter>(new MotionSegmenter());
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
    setState((s) =>
      s.segmenterState === seg.state && s.activeFrames === seg.activeFrameCount
        ? s
        : { ...s, segmenterState: seg.state, activeFrames: seg.activeFrameCount },
    );
    if (completed === null) return;
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
    if (match) onWordRef.current(match.label, match.distance);
  }, [maxDistance, margin]);

  const reset = useCallback(() => {
    segmenterRef.current.reset();
    setState((s) => ({
      ...s,
      segmenterState: "idle",
      activeFrames: 0,
      lastWord: null,
      lastDistance: null,
      lastCandidates: [],
      lastReject: null,
    }));
  }, []);

  return { ...state, processLandmarks, reset };
}
