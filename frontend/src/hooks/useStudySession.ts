import { useCallback, useEffect, useRef } from "react";
import { pb } from "../lib/pocketbase";
import { useAuth } from "../lib/auth";
import type { SessionType } from "../lib/types";

export interface SessionStartParams {
  session_type: SessionType;
  lecture?: string;
}

export interface SessionUpdate {
  cards_reviewed?: number;
  cards_correct?: number;
}

export interface UseStudySessionReturn {
  start: (params: SessionStartParams) => Promise<string>;
  update: (id: string, patch: SessionUpdate) => void;
  finish: (id: string, finalPatch?: SessionUpdate) => Promise<void>;
}

interface PendingEntry {
  patch: SessionUpdate;
  timer: ReturnType<typeof setTimeout> | null;
}

interface SessionMeta {
  startedAt: number;
}

const DEBOUNCE_MS = 300;

function logError(scope: string, error: unknown): void {
  // Best-effort instrumentation: never block the user. Surface to console only.
  // eslint-disable-next-line no-console
  console.warn(`[useStudySession] ${scope}:`, error);
}

function mergePatch(
  existing: SessionUpdate | undefined,
  next: SessionUpdate,
): SessionUpdate {
  return { ...(existing ?? {}), ...next };
}

export function useStudySession(): UseStudySessionReturn {
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(user?.id ?? null);

  // Keep ref in sync with auth state without retriggering callbacks.
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());
  const metaRef = useRef<Map<string, SessionMeta>>(new Map());

  const flushSession = useCallback(async (id: string): Promise<void> => {
    const entry = pendingRef.current.get(id);
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    const patch = entry.patch;
    pendingRef.current.delete(id);
    if (Object.keys(patch).length === 0) return;
    try {
      await pb.collection("study_sessions").update(id, patch);
    } catch (error: unknown) {
      logError("flush update failed", error);
    }
  }, []);

  const flushSessionSync = useCallback((id: string): void => {
    const entry = pendingRef.current.get(id);
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    const patch = entry.patch;
    pendingRef.current.delete(id);
    if (Object.keys(patch).length === 0) return;
    // Best-effort fire-and-forget. Errors swallowed.
    pb.collection("study_sessions")
      .update(id, patch)
      .catch((error: unknown) => logError("sync flush failed", error));
  }, []);

  const flushAllSync = useCallback((): void => {
    const ids = Array.from(pendingRef.current.keys());
    for (const id of ids) {
      flushSessionSync(id);
    }
  }, [flushSessionSync]);

  const sendUnloadBeacons = useCallback((): void => {
    const baseUrl = pb.baseURL.replace(/\/$/, "");
    const token = pb.authStore.token;
    if (!token) return;

    for (const [id, entry] of pendingRef.current.entries()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      const patch = entry.patch;
      if (Object.keys(patch).length === 0) continue;

      try {
        // PocketBase doesn't expose a beacon endpoint directly; sendBeacon
        // sends a POST so we can't PATCH a record with it. Fall back to
        // fetch with keepalive which works for unload events.
        const url = `${baseUrl}/api/collections/study_sessions/records/${id}`;
        const body = JSON.stringify(patch);
        void fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body,
          keepalive: true,
        }).catch((error: unknown) => logError("beacon flush failed", error));
      } catch (error: unknown) {
        logError("beacon dispatch failed", error);
      }
    }
    pendingRef.current.clear();
  }, []);

  // Flush pending updates on tab close / refresh.
  useEffect(() => {
    const handler = (): void => {
      sendUnloadBeacons();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [sendUnloadBeacons]);

  // Cleanup on unmount: flush any remaining timers (best-effort, async).
  useEffect(() => {
    return () => {
      flushAllSync();
      metaRef.current.clear();
    };
  }, [flushAllSync]);

  const start = useCallback(
    async (params: SessionStartParams): Promise<string> => {
      const userId = userIdRef.current;
      if (!userId) {
        throw new Error("Cannot start a study session without an authenticated user");
      }

      const startedAtIso = new Date().toISOString();
      const payload: Record<string, unknown> = {
        user: userId,
        session_type: params.session_type,
        cards_reviewed: 0,
        cards_correct: 0,
        started_at: startedAtIso,
      };
      if (params.lecture) {
        payload.lecture = params.lecture;
      }

      const record = await pb
        .collection("study_sessions")
        .create(payload);

      metaRef.current.set(record.id, { startedAt: Date.parse(startedAtIso) });
      return record.id;
    },
    [],
  );

  const update = useCallback(
    (id: string, patch: SessionUpdate): void => {
      if (!id) return;
      if (Object.keys(patch).length === 0) return;

      const existing = pendingRef.current.get(id);
      const merged = mergePatch(existing?.patch, patch);

      if (existing?.timer) {
        clearTimeout(existing.timer);
      }

      const timer = setTimeout(() => {
        // Detach before awaiting so subsequent updates start a fresh entry.
        const current = pendingRef.current.get(id);
        if (!current) return;
        const finalPatch = current.patch;
        pendingRef.current.delete(id);
        if (Object.keys(finalPatch).length === 0) return;
        pb.collection("study_sessions")
          .update(id, finalPatch)
          .catch((error: unknown) => logError("debounced update failed", error));
      }, DEBOUNCE_MS);

      pendingRef.current.set(id, { patch: merged, timer });
    },
    [],
  );

  const finish = useCallback(
    async (id: string, finalPatch?: SessionUpdate): Promise<void> => {
      if (!id) return;

      // Flush any pending debounced updates first so we don't race them.
      await flushSession(id);

      const meta = metaRef.current.get(id);
      const endedAtIso = new Date().toISOString();
      const startedAtMs = meta?.startedAt ?? Date.parse(endedAtIso);
      const durationSecs = Math.max(
        0,
        Math.round((Date.parse(endedAtIso) - startedAtMs) / 1000),
      );

      const payload: Record<string, unknown> = {
        ...(finalPatch ?? {}),
        ended_at: endedAtIso,
        duration_secs: durationSecs,
      };

      try {
        await pb.collection("study_sessions").update(id, payload);
      } catch (error: unknown) {
        logError("finish failed", error);
      } finally {
        metaRef.current.delete(id);
      }
    },
    [flushSession],
  );

  return { start, update, finish };
}
