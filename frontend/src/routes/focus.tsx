import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { StudySession } from "../lib/types";

export const Route = createFileRoute("/focus")({
  component: FocusPage,
});

const SHORT_BREAK_SECONDS = 5 * 60;
const FOCUS_LENGTH_KEY = "converge:focus:length";

function loadLength(): number {
  if (typeof window === "undefined") return 25 * 60;
  try {
    const raw = window.localStorage.getItem(FOCUS_LENGTH_KEY);
    if (!raw) return 25 * 60;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 60 || v > 90 * 60) return 25 * 60;
    return v;
  } catch {
    return 25 * 60;
  }
}

function FocusPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [length, setLength] = useState<number>(() => loadLength());
  const [remaining, setRemaining] = useState(length);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (running) return;
    if (phase === "work") setRemaining(length);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(FOCUS_LENGTH_KEY, String(length));
      } catch {
        // ignore
      }
    }
  }, [length, phase, running]);
  const startTsRef = useRef<number | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Tick every second when running. Use timestamp-based math so the
  // timer is accurate even when the tab was backgrounded.
  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const initial = remaining;
    startTsRef.current = startedAt;
    const id = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(0, initial - elapsedSec);
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(id);
        setRunning(false);
        if (phase === "work") {
          setCompleted((n) => n + 1);
          // Persist a study_session row so /stats can attribute time.
          if (user && startTsRef.current) {
            const startIso = new Date(startTsRef.current).toISOString();
            void pb
              .collection("study_sessions")
              .create<StudySession>({
                user: user.id,
                session_type: "pomodoro",
                lecture: "",
                cards_reviewed: 0,
                cards_correct: 0,
                duration_secs: length,
                started_at: startIso,
                ended_at: new Date().toISOString(),
              })
              .then((rec) => (sessionRef.current = rec.id))
              .catch(() => undefined);
          }
          setPhase("break");
          setRemaining(SHORT_BREAK_SECONDS);
        } else {
          setPhase("work");
          setRemaining(length);
        }
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  // Block accidental tab close while running.
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return (e.returnValue = "A focus block is running — leave anyway?");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const reset = () => {
    setRunning(false);
    setPhase("work");
    setRemaining(length);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const progress = useMemo(() => {
    const total = phase === "work" ? length : SHORT_BREAK_SECONDS;
    return 1 - remaining / total;
  }, [remaining, phase]);

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center px-4">
      <Link
        to="/study"
        className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        aria-label="Exit focus mode"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </Link>

      <div className="text-center space-y-6">
        <div
          className={`text-xs uppercase tracking-[0.4em] ${
            phase === "work"
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {phase === "work" ? "Focus" : "Short break"}
        </div>

        <div
          className="text-[14rem] font-bold leading-none tracking-tighter tabular-nums"
          aria-live="polite"
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>

        <div className="w-64 h-1 mx-auto rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRunning((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-4 h-10 rounded-md"
          >
            {running ? (
              <Pause className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-10 rounded-md hover:bg-[var(--color-surface-raised)]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="text-xs text-[var(--color-text-muted)]">
          {completed > 0
            ? `${completed} pomodoro${completed === 1 ? "" : "s"} today`
            : "First pomodoro of the day"}
        </div>

        {!running && (
          <div className="flex items-center justify-center gap-1.5">
            {[15, 25, 50].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setLength(min * 60)}
                className={`text-[10px] uppercase tracking-wider px-2 h-6 rounded-full border ${
                  length === min * 60
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                {min}m
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
