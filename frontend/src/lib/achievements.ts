/**
 * Achievements — read-only, computed from existing collections.
 *
 * No new PocketBase collection is needed: each badge is a pure function
 * over a `UserStats` snapshot we assemble with cheap `getList(1, 1)` and
 * `getFullList` queries scoped to the current user.
 *
 * Add a badge by appending to `BADGES` and (if needed) extending
 * `UserStats` + `loadUserStats`.
 */

import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Brain,
  Flame,
  GraduationCap,
  Hand,
  Layers,
  Library,
  Sparkles,
  Trophy,
} from "lucide-react";
import { pb } from "./pocketbase";
import type { StudySession } from "./types";

export interface UserStats {
  notesCount: number;
  lecturesCount: number;
  flashcardsCount: number;
  cardsReviewed: number;
  quizzesCompleted: number;
  pomodoroCount: number;
  aslSegmentCount: number;
  /** Distinct ASL providers observed across the user's segments. */
  aslProviders: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Returns `[current, target]` so the UI can render a progress bar. */
  progress: (stats: UserStats) => [number, number];
}

/**
 * The catalog. Order is the display order on /achievements.
 *
 * Each badge keeps a numeric progress so the UI can show e.g. "12 / 50"
 * even for badges that aren't earned yet.
 */
export const BADGES: Badge[] = [
  {
    id: "first-steps",
    title: "First steps",
    description: "Created your first note page.",
    icon: Sparkles,
    progress: (s) => [Math.min(s.notesCount, 1), 1],
  },
  {
    id: "note-collector",
    title: "Note collector",
    description: "Built up a library of 10 note pages.",
    icon: BookOpen,
    progress: (s) => [Math.min(s.notesCount, 10), 10],
  },
  {
    id: "library-builder",
    title: "Library builder",
    description: "Reached 50 note pages — that's a real library.",
    icon: Library,
    progress: (s) => [Math.min(s.notesCount, 50), 50],
  },
  {
    id: "lecture-listener",
    title: "Lecture listener",
    description: "Captured your first lecture.",
    icon: GraduationCap,
    progress: (s) => [Math.min(s.lecturesCount, 1), 1],
  },
  {
    id: "recall-apprentice",
    title: "Recall apprentice",
    description: "Reviewed 10 flashcards across all your sessions.",
    icon: Layers,
    progress: (s) => [Math.min(s.cardsReviewed, 10), 10],
  },
  {
    id: "spaced-master",
    title: "Spaced master",
    description: "Reviewed 100 flashcards — spaced repetition is paying off.",
    icon: Brain,
    progress: (s) => [Math.min(s.cardsReviewed, 100), 100],
  },
  {
    id: "quiz-solver",
    title: "Quiz solver",
    description: "Completed 5 quiz attempts.",
    icon: Trophy,
    progress: (s) => [Math.min(s.quizzesCompleted, 5), 5],
  },
  {
    id: "pomodoro",
    title: "Pomodoro",
    description: "Finished 4 pomodoro sessions.",
    icon: Flame,
    progress: (s) => [Math.min(s.pomodoroCount, 4), 4],
  },
  {
    id: "polyglot",
    title: "Polyglot",
    description:
      "Used 2+ ASL providers, or kept both pomodoros and flashcards going.",
    icon: Award,
    progress: (s) => {
      // Two paths to earn this:
      //  a) The "real" measure: more than one ASL provider in your segments.
      //  b) A softer fallback: at least one pomodoro AND one flashcard.
      const providerProgress = Math.min(s.aslProviders, 2);
      if (providerProgress >= 2) return [2, 2];
      const fallback = (s.pomodoroCount > 0 ? 1 : 0) + (s.flashcardsCount > 0 ? 1 : 0);
      return [Math.max(providerProgress, fallback), 2];
    },
  },
  {
    id: "asl-signer",
    title: "ASL signer",
    description: "Recorded 5 ASL segments.",
    icon: Hand,
    progress: (s) => [Math.min(s.aslSegmentCount, 5), 5],
  },
];

async function fetchCount(
  collection: string,
  filter: string,
  requestKey: string,
): Promise<number> {
  try {
    const res = await pb
      .collection(collection)
      .getList(1, 1, { filter, requestKey });
    return res.totalItems;
  } catch {
    return 0;
  }
}

/**
 * Pulls the lightweight numbers used by every badge. Anything heavier
 * (e.g. summing `cards_reviewed`) goes through `getFullList` so we get
 * the rows we actually need to add up.
 */
export async function loadUserStats(userId: string): Promise<UserStats> {
  const userFilter = `user = "${userId}"`;
  const [
    notesCount,
    lecturesCount,
    flashcardsCount,
    quizzesCompleted,
    sessions,
    aslSegments,
  ] = await Promise.all([
    fetchCount("note_pages", `${userFilter} && archived = false`, "ach-notes"),
    fetchCount("lectures", userFilter, "ach-lectures"),
    fetchCount("flashcards", userFilter, "ach-flashcards"),
    fetchCount("quiz_attempts", userFilter, "ach-quizzes"),
    pb
      .collection("study_sessions")
      .getFullList<StudySession>({
        filter: userFilter,
        fields: "id,session_type,cards_reviewed",
        requestKey: "ach-sessions",
      })
      .catch(() => [] as StudySession[]),
    pb
      .collection("asl_segments")
      .getFullList<{ provider: string }>({
        filter: userFilter,
        fields: "id,provider",
        requestKey: "ach-asl",
      })
      .catch(() => [] as Array<{ provider: string }>),
  ]);

  const cardsReviewed = sessions.reduce(
    (acc, s) => acc + (s.cards_reviewed || 0),
    0,
  );
  const pomodoroCount = sessions.filter(
    (s) => s.session_type === "pomodoro",
  ).length;
  const aslSegmentCount = aslSegments.length;
  const aslProviders = new Set(
    aslSegments.map((a) => (a.provider || "").trim()).filter(Boolean),
  ).size;

  return {
    notesCount,
    lecturesCount,
    flashcardsCount,
    cardsReviewed,
    quizzesCompleted,
    pomodoroCount,
    aslSegmentCount,
    aslProviders,
  };
}

export interface BadgeStatus {
  badge: Badge;
  earned: boolean;
  current: number;
  target: number;
}

export function evaluateBadges(stats: UserStats): BadgeStatus[] {
  return BADGES.map((badge) => {
    const [current, target] = badge.progress(stats);
    return {
      badge,
      current,
      target,
      earned: current >= target,
    };
  });
}
