import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  FileText,
  Hand,
  Mic,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

interface Step {
  id: string;
  title: string;
  body: string;
  hint?: string;
  to: string;
  icon: typeof FileText;
}

const STEPS: Step[] = [
  {
    id: "capture",
    title: "Record your first lecture",
    body:
      "The capture surface streams audio through Whisper, cleans the transcript, and generates notes, flashcards, and a quiz automatically.",
    hint: "Hardware mic recommended; the in-browser STT also works in a pinch.",
    to: "/capture",
    icon: Mic,
  },
  {
    id: "notes",
    title: "Pick a template",
    body:
      "Notes pages support slash commands, headings, todos, code blocks, callouts, math, embeds, and inline AI assistance.",
    hint: "Cmd/Ctrl+J anywhere opens Quick Capture for a fast inbox jot.",
    to: "/templates",
    icon: FileText,
  },
  {
    id: "study",
    title: "Review what's due today",
    body:
      "Spaced-repetition decks aggregate across every source. /study/due is your single queue.",
    to: "/study/due",
    icon: BookOpen,
  },
  {
    id: "knowledge",
    title: "Ask your library",
    body:
      "/knowledge/ask retrieves your own notes, lectures, and decks before answering — sources are cited inline.",
    to: "/knowledge/ask",
    icon: Brain,
  },
  {
    id: "asl",
    title: "Sign on camera",
    body:
      "The /asl chat surface segments motion automatically and routes frames through a vision model. Falls back to a deterministic stub when no key is configured.",
    to: "/asl",
    icon: Hand,
  },
  {
    id: "multiplayer",
    title: "Play with friends",
    body:
      "Host a multiplayer round on any quiz; share the 6-character code at /play to compete.",
    to: "/study",
    icon: Users,
  },
  {
    id: "today",
    title: "See your day",
    body:
      "/today surfaces what's pulling on your attention — cards due, assignments, lectures still processing.",
    to: "/today",
    icon: Sparkles,
  },
];

const STORAGE_KEY = "converge:onboarding:completed";

function loadCompleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveCompleted(s: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // ignore
  }
}

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  const toggleDone = (id: string) =>
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = STEPS.length;
  const done = useMemo(
    () => STEPS.filter((s) => completed.has(s.id)).length,
    [completed],
  );

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Welcome to Converge"
        subtitle="Take the seven-step tour. Each card opens the surface you'll need."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex items-center gap-3">
          <Trophy className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <span className="text-[var(--color-text)]">{done}</span>
            <span className="text-[var(--color-text-muted)]"> / {total} stops complete</span>
          </div>
          <div className="h-1.5 w-32 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>

        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = completed.has(s.id);
            return (
              <li key={s.id}>
                <div
                  className={`rounded-md border bg-[var(--color-surface)] p-4 flex items-start gap-3 transition-colors ${
                    isDone
                      ? "border-[var(--color-success)]/40"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDone(s.id)}
                    aria-pressed={isDone}
                    aria-label={isDone ? "Mark not done" : "Mark done"}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      isDone
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/10"
                        : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    {isDone && (
                      <Check
                        className="w-3 h-3 text-[var(--color-success)]"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  <Icon
                    className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-sm font-semibold text-[var(--color-text)]">
                        {s.title}
                      </h2>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {s.body}
                    </p>
                    {s.hint && (
                      <p className="text-[11px] text-[var(--color-text-subtle)] mt-1 italic">
                        {s.hint}
                      </p>
                    )}
                  </div>
                  <Link
                    to={s.to}
                    className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                  >
                    Open <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>

        {done === total ? (
          <div className="rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-3 text-sm text-[var(--color-success)] inline-flex items-center gap-2">
            <Trophy className="w-4 h-4" aria-hidden="true" />
            All done. Press Cmd/Ctrl + K to roam.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCompleted(new Set(STEPS.map((s) => s.id)));
            }}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
          >
            Skip tour — I know my way around
          </button>
        )}
      </div>
    </AppShell>
  );
}
