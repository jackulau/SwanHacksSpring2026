// Score the LLM-extracted course against the user's existing courses so the
// UI can ask "is this {Foo} ?" before creating a duplicate. Cheap heuristics
// only — no fuzzy library, no string-distance matrix; this is a confirmation
// step, not an automated merge.

import type { Course } from "../types";
import type { ExtractedSyllabus } from "./extract";

export interface CourseMatch {
  course: Course;
  /** 0..1 — anything ≥ 0.55 is shown to the user as a strong candidate. */
  score: number;
  /** Human-readable reason ("code matches", "name overlap"). */
  reason: string;
}

export function findCourseMatches(
  extracted: ExtractedSyllabus["course"],
  candidates: Course[],
): CourseMatch[] {
  const wantCode = normalizeCode(extracted.code);
  const wantNameTokens = tokenize(extracted.name);

  const scored: CourseMatch[] = [];
  for (const c of candidates) {
    const haveCode = normalizeCode(c.code);
    const haveNameTokens = tokenize(c.name);

    // Exact code match dominates everything else — codes are unique enough
    // that "COGS 200" matching "COGS 200" should always win over a fuzzy
    // name overlap on a different course.
    if (wantCode && haveCode && wantCode === haveCode) {
      scored.push({ course: c, score: 1, reason: `code matches (${c.code})` });
      continue;
    }

    const overlap = jaccard(wantNameTokens, haveNameTokens);
    if (overlap >= 0.4) {
      scored.push({
        course: c,
        score: overlap,
        reason: "name overlap",
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

function normalizeCode(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, "");
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
