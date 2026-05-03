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
 *   `maxDistance`  reject matches with DTW distance above this (default 1.2)
 *   `margin`       require the runner-up to be `margin`× worse than the
 *                  best (default 1.0 = no margin)
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
}

export function useWordSignRecognition(
  onWord: (word: string, distance: number) => void,
  opts: WordSignOptions = {},
) {
  const { bundleUrl = "/asl-templates.json", maxDistance = 1.2, margin = 1.0 } = opts;

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
  });

  // One-time bundle load.
  useEffect(() => {
    let cancelled = false;
    const rec = new WordRecognizer({ maxDistance, margin });
    recognizerRef.current = rec;
    loadDefaultBundle(bundleUrl)
      .then((bundle) => {
        if (cancelled) return;
        rec.loadBundle(bundle);
        setState((s) => ({
          ...s,
          isReady: true,
          templateCount: rec.templateCount,
          labels: rec.labels,
        }));
      })
      .catch((e) => {
        if (cancelled) return;
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
    // We don't have explicit handedness from useMediaPipeHands — fall back
    // to slot order. Real handedness can be plumbed in later as a non-
    // breaking improvement.
    const frame = frameFromLandmarks(handData.landmarks, []);
    const completed = seg.update(frame);
    setState((s) =>
      s.segmenterState === seg.state && s.activeFrames === seg.activeFrameCount
        ? s
        : { ...s, segmenterState: seg.state, activeFrames: seg.activeFrameCount },
    );
    if (completed === null) return;
    const candidates = rec.topK(completed, 5);
    const match = rec.recognize(completed);
    setState((s) => ({
      ...s,
      lastCandidates: candidates,
      lastWord: match ? match.label : s.lastWord,
      lastDistance: match ? match.distance : s.lastDistance,
    }));
    if (match) onWordRef.current(match.label, match.distance);
  }, []);

  const reset = useCallback(() => {
    segmenterRef.current.reset();
    setState((s) => ({
      ...s,
      segmenterState: "idle",
      activeFrames: 0,
      lastWord: null,
      lastDistance: null,
      lastCandidates: [],
    }));
  }, []);

  return { ...state, processLandmarks, reset };
}
