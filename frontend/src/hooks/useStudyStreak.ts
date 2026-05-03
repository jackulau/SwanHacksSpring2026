/**
 * useStudyStreak — computes the current study streak from `study_sessions`.
 *
 * ─── Streak rules (do not break these without updating the spec) ─────────────
 * 1. A "study day" is a calendar day in the user's *local* timezone on which
 *    at least one `study_session` exists with:
 *       - `ended_at` not empty (the session was actually finished), and
 *       - `duration_secs >= 60`         (filters out micro-sessions).
 * 2. A "streak" is the count of consecutive trailing study days ending on
 *    today, OR ending on yesterday if today has no qualifying session yet
 *    (so users still see their streak before completing today's study).
 *      • today qualifies                           → streak counts today
 *      • today empty, yesterday qualifies          → streak counts back from yesterday
 *      • neither today nor yesterday qualify       → streak = 0
 * 3. Multiple sessions on the same day still count as a single day.
 * 4. `todayCompleted` is true only if today itself has a qualifying session.
 *
 * ─── DST / timezone correctness ──────────────────────────────────────────────
 * We bucket each session's `ended_at` (a UTC ISO string from PocketBase) into a
 * "YYYY-MM-DD" key in the user's local timezone using `Intl.DateTimeFormat`.
 * To walk back through days we step using `Date#setDate(d - 1)` on a local
 * Date constructed from year/month/day, which is DST-safe — JS adjusts the
 * underlying instant across spring-forward / fall-back transitions, but the
 * *calendar day* arithmetic is what we care about. We never slice ISO UTC
 * strings to derive local days (that would be off-by-one near midnight) and we
 * never subtract 86_400_000 ms (that breaks on DST days that are 23h or 25h).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RecordSubscription } from "pocketbase";
import { pb } from "../lib/pocketbase";
import { useAuth } from "../lib/auth";
import type { StudySession } from "../lib/types";

const SESSIONS_COLLECTION = "study_sessions";
const FETCH_LIMIT = 200;
const MIN_DURATION_SECS = 60;

export interface UseStudyStreakReturn {
  streak: number;
  todayCompleted: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Format a Date as a local "YYYY-MM-DD" key.
 *
 * Uses `Intl.DateTimeFormat` with `en-CA` locale — that locale's default
 * formatting is exactly ISO `YYYY-MM-DD`, which avoids us having to
 * hand-pad month/day. The formatter respects the runtime's local timezone,
 * so it correctly handles DST (the wall-clock day boundary is what we want).
 */
const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toLocalDayKey(date: Date): string {
  // en-CA returns YYYY-MM-DD already; format() is safer than formatToParts here.
  return localDateFormatter.format(date);
}

/**
 * Build a Set of local day keys that have ≥1 qualifying session.
 *
 * Sessions arriving from PocketBase are already filtered server-side
 * (`duration_secs >= 60 && ended_at != ""`), but we re-check defensively in
 * case realtime payloads or stale caches sneak past.
 */
function buildStudyDaySet(sessions: StudySession[]): Set<string> {
  const days = new Set<string>();
  for (const session of sessions) {
    if (!session.ended_at) continue;
    if (typeof session.duration_secs !== "number") continue;
    if (session.duration_secs < MIN_DURATION_SECS) continue;

    const ended = new Date(session.ended_at);
    if (Number.isNaN(ended.getTime())) continue;

    days.add(toLocalDayKey(ended));
  }
  return days;
}

/**
 * Step a Date back one local calendar day. Mutates the input.
 *
 * Using `setDate(d - 1)` keeps wall-clock hours stable across DST days
 * (spring-forward 23h days and fall-back 25h days are handled by the
 * runtime). We then re-derive the day key from this Date.
 */
function stepBackOneDay(date: Date): void {
  date.setDate(date.getDate() - 1);
}

function computeStreak(studyDays: ReadonlySet<string>): {
  streak: number;
  todayCompleted: boolean;
} {
  if (studyDays.size === 0) {
    return { streak: 0, todayCompleted: false };
  }

  const cursor = new Date();
  const todayKey = toLocalDayKey(cursor);
  const todayCompleted = studyDays.has(todayKey);

  // If today isn't completed, allow the streak to anchor on yesterday so
  // users still see their progress before tonight's session.
  if (!todayCompleted) {
    stepBackOneDay(cursor);
    if (!studyDays.has(toLocalDayKey(cursor))) {
      return { streak: 0, todayCompleted: false };
    }
  }

  let streak = 0;
  // Cap iterations so a corrupt clock or absurd dataset can't infinite-loop.
  // FETCH_LIMIT sessions can at most cover FETCH_LIMIT distinct days.
  const maxIterations = FETCH_LIMIT + 2;
  for (let i = 0; i < maxIterations; i++) {
    if (!studyDays.has(toLocalDayKey(cursor))) break;
    streak += 1;
    stepBackOneDay(cursor);
  }

  return { streak, todayCompleted };
}

export function useStudyStreak(): UseStudyStreakReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest in-flight request so older responses can't overwrite newer state.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await pb
        .collection(SESSIONS_COLLECTION)
        .getList<StudySession>(1, FETCH_LIMIT, {
          filter: `user = "${userId}" && duration_secs >= ${MIN_DURATION_SECS} && ended_at != ""`,
          sort: "-ended_at",
        });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setSessions(result.items);
      setLoading(false);
    } catch (err: unknown) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load study sessions";
      setError(message);
      setSessions([]); // streak = 0 on error
      setLoading(false);
    }
  }, [userId]);

  // Initial + auth-change fetch.
  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Realtime: refresh on any create/update/delete to study_sessions for this user.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const handler = (e: RecordSubscription<StudySession>) => {
      // Only react to changes for the current user.
      if (e.record?.user && e.record.user !== userId) return;
      void fetchSessions();
    };

    pb.collection(SESSIONS_COLLECTION)
      .subscribe<StudySession>("*", handler)
      .then((unsub) => {
        if (cancelled) {
          // Subscription resolved after unmount — tear it down immediately.
          void unsub();
          return;
        }
        unsubscribe = unsub;
      })
      .catch(() => {
        // Realtime is best-effort; we still have the initial fetch + manual refresh.
      });

    return () => {
      cancelled = true;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {
          // ignore teardown errors
        }
      }
    };
  }, [userId, fetchSessions]);

  // Memoize day grouping so re-renders that don't change `sessions` are cheap.
  const studyDays = useMemo(() => buildStudyDaySet(sessions), [sessions]);

  const { streak, todayCompleted } = useMemo(
    () => computeStreak(studyDays),
    [studyDays],
  );

  const refresh = useCallback(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return {
    streak: error ? 0 : streak,
    todayCompleted: error ? false : todayCompleted,
    loading,
    error,
    refresh,
  };
}
