/**
 * Browser-side DTW word recognizer. Loads templates exported by the Python
 * pipeline, scores live segments against every template, and gates results
 * with a configurable max distance + runner-up margin (same logic as the
 * Python `WordRecognizer`).
 */

import { dtwDistance } from "./dtw";
import {
  FEATURE_DIM,
  TEMPLATE_LENGTH,
  type Frame,
  featurizeSequence,
} from "./features";
import type { Segment } from "./segmenter";

export interface TemplateBundle {
  templateLength: number;
  featureDim: number;
  labels: string[];
  templates: Record<string, number[][][]>; // label -> N templates of TEMPLATE_LENGTH × FEATURE_DIM
  createdAt?: string;
  source?: string;
}

export interface WordMatch {
  label: string;
  distance: number;
  secondBestDistance: number;
}

export interface RecognizerOptions {
  maxDistance?: number;
  margin?: number;
  dtwWindow?: number | null;
}

export interface ScoredCandidate {
  label: string;
  distance: number;
}

export class WordRecognizer {
  private library: Map<string, Float32Array[][]> = new Map();
  private maxDistance: number;
  private margin: number;
  private dtwWindow: number | null;
  private _labels: string[] = [];

  constructor(opts: RecognizerOptions = {}) {
    this.maxDistance = opts.maxDistance ?? 1.2;
    this.margin = opts.margin ?? 1.0;
    this.dtwWindow = opts.dtwWindow ?? 16;
  }

  loadBundle(bundle: TemplateBundle): void {
    if (bundle.featureDim !== FEATURE_DIM) {
      throw new Error(
        `Template featureDim mismatch: bundle=${bundle.featureDim} runtime=${FEATURE_DIM}`,
      );
    }
    if (bundle.templateLength !== TEMPLATE_LENGTH) {
      throw new Error(
        `Template length mismatch: bundle=${bundle.templateLength} runtime=${TEMPLATE_LENGTH}`,
      );
    }
    this.library.clear();
    for (const label of bundle.labels) {
      const raws = bundle.templates[label] ?? [];
      const decoded: Float32Array[][] = raws.map((tpl) =>
        tpl.map((row) => Float32Array.from(row)),
      );
      this.library.set(label, decoded);
    }
    this._labels = [...this.library.keys()].sort();
  }

  get labels(): string[] { return this._labels; }
  get templateCount(): number {
    let n = 0;
    for (const v of this.library.values()) n += v.length;
    return n;
  }

  setMaxDistance(d: number): void { this.maxDistance = d; }
  setMargin(m: number): void { this.margin = m; }

  /** Score every label and return top-k (no thresholds applied). */
  topK(segment: Segment, k = 5): ScoredCandidate[] {
    if (this.library.size === 0) return [];
    const query = featurizeSequence(segment.frames);
    if (query.length === 0) return [];
    const scored: ScoredCandidate[] = [];
    for (const [label, templates] of this.library) {
      let best = Infinity;
      for (const t of templates) {
        const d = dtwDistance(query, t, this.dtwWindow);
        if (d < best) best = d;
      }
      scored.push({ label, distance: best });
    }
    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, k);
  }

  /** Apply max-distance + margin gates. */
  recognize(segment: Segment): WordMatch | null {
    const scored = this.topK(segment, 2);
    if (scored.length === 0) return null;
    const best = scored[0];
    const second = scored[1] ?? { distance: Infinity, label: "" };
    if (best.distance > this.maxDistance) return null;
    if (
      isFinite(second.distance) &&
      best.distance > 0 &&
      second.distance / best.distance < this.margin
    ) {
      return null;
    }
    return {
      label: best.label,
      distance: best.distance,
      secondBestDistance: second.distance,
    };
  }

  /** DTW distance against a specific label's templates (for lesson grading). */
  scoreAgainst(label: string, segment: Segment): number | null {
    const templates = this.library.get(label);
    if (!templates) return null;
    const query = featurizeSequence(segment.frames);
    if (query.length === 0) return null;
    let best = Infinity;
    for (const t of templates) {
      const d = dtwDistance(query, t, this.dtwWindow);
      if (d < best) best = d;
    }
    return best;
  }
}

/** Quick fetch+parse of the bundled JSON. Cached after first call. */
let _bundlePromise: Promise<TemplateBundle> | null = null;
export function loadDefaultBundle(url = "/asl-templates.json"): Promise<TemplateBundle> {
  if (_bundlePromise) return _bundlePromise;
  _bundlePromise = fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`asl templates fetch ${r.status}`);
    return (await r.json()) as TemplateBundle;
  });
  return _bundlePromise;
}

/** Reset the cached bundle (useful in dev / hot reload). */
export function clearBundleCache(): void { _bundlePromise = null; }

/** Frames already in the (T, FEATURE_DIM) shape — bypass MediaPipe. Used by tests. */
export function featurizeRawFrames(frames: Frame[]): Float32Array[] {
  return featurizeSequence(frames, true);
}
