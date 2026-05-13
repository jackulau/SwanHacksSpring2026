import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  Loader2,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { toast } from "../lib/toasts";
import type { GoalRecord } from "../lib/types";

export const Route = createFileRoute("/goals")({
  component: GoalsPage,
});

function daysUntil(dateIso: string): number {
  if (!dateIso) return 0;
  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - today) / (1000 * 60 * 60 * 24));
}

function daysUntilLabel(dateIso: string): string {
  const d = daysUntil(dateIso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d > 0) return `in ${d}d`;
  return `${Math.abs(d)}d ago`;
}

function GoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<GoalRecord[] | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("goals")
      .getFullList<GoalRecord>({
        filter: `user = "${user.id}"`,
        sort: "completed,target_date,created",
        requestKey: "goals-list",
      })
      .then((rows) => {
        if (!cancelled) setGoals(rows);
      })
      .catch(() => {
        if (!cancelled) setGoals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const create = async () => {
    if (!user || !draftTitle.trim() || creating) return;
    setCreating(true);
    try {
      const g = await pb.collection("goals").create<GoalRecord>({
        user: user.id,
        title: draftTitle.trim(),
        description: "",
        target_date: draftDate || "",
        completed: false,
        completed_at: "",
        meta: {},
      });
      setGoals((prev) => (prev ? [g, ...prev] : [g]));
      setDraftTitle("");
      setDraftDate("");
      toast.success("Goal added", g.title);
    } catch {
      toast.error("Couldn't add goal", "Try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (g: GoalRecord) => {
    const next = !g.completed;
    setGoals((prev) =>
      prev?.map((p) =>
        p.id === g.id
          ? {
              ...p,
              completed: next,
              completed_at: next ? new Date().toISOString() : "",
            }
          : p,
      ) ?? null,
    );
    try {
      await pb.collection("goals").update(g.id, {
        completed: next,
        completed_at: next ? new Date().toISOString() : "",
      });
      if (next) toast.success("Goal completed", g.title);
    } catch {
      // best-effort
    }
  };

  const remove = async (g: GoalRecord) => {
    if (!window.confirm(`Delete "${g.title}"?`)) return;
    setGoals((prev) => prev?.filter((p) => p.id !== g.id) ?? null);
    try {
      await pb.collection("goals").delete(g.id);
    } catch {
      // ignore
    }
  };

  const summary = useMemo(() => {
    if (!goals) return { open: 0, done: 0 };
    const done = goals.filter((g) => g.completed).length;
    return { open: goals.length - done, done };
  }, [goals]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Goals"
        subtitle={
          goals === null
            ? "Loading…"
            : goals.length === 0
              ? "What are you trying to learn this season?"
              : `${summary.open} open, ${summary.done} completed.`
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Target
              className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="A goal you're aiming at"
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon
              className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[var(--color-text)] outline-none"
            />
            <button
              type="submit"
              disabled={creating || !draftTitle.trim()}
              className="inline-flex items-center gap-1 bg-[var(--color-primary)] text-white text-xs font-semibold px-2.5 h-7 rounded disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="w-3 h-3" aria-hidden="true" />
              )}
              Add goal
            </button>
          </div>
        </form>

        {goals && goals.length > 0 && (
          <div className="text-xs text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text)]">{summary.open}</span> open,{" "}
            <span className="text-[var(--color-success)]">{summary.done}</span>{" "}
            completed.
          </div>
        )}

        {goals === null ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">
            No goals yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 group"
              >
                <button
                  type="button"
                  onClick={() => toggle(g)}
                  aria-pressed={g.completed}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    g.completed
                      ? "bg-[var(--color-success)]/20 border-[var(--color-success)]"
                      : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {g.completed && (
                    <Check
                      className="w-3 h-3 text-[var(--color-success)]"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <span
                  className={`flex-1 min-w-0 truncate text-sm ${
                    g.completed
                      ? "line-through text-[var(--color-text-subtle)]"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {g.title}
                </span>
                {g.target_date && (
                  <span
                    className={`text-xs tabular-nums ${
                      daysUntil(g.target_date) < 0 && !g.completed
                        ? "text-[var(--color-error)]"
                        : daysUntil(g.target_date) <= 7 && !g.completed
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-text-muted)]"
                    }`}
                    title={new Date(g.target_date).toLocaleString()}
                  >
                    {daysUntilLabel(g.target_date)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(g)}
                  aria-label={`Delete ${g.title}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
