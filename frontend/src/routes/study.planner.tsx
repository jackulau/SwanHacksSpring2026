import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, ListTodo } from "lucide-react";
import { PomodoroTimer } from "../components/study/PomodoroTimer";
import { StudyStreak } from "../components/study/StudyStreak";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { SkeletonList } from "../components/layout/Skeleton";
import { useAuth } from "../lib/auth";
import { usePreferences } from "../lib/preferences";
import { useStudyStreak } from "../hooks/useStudyStreak";
import { pb } from "../lib/pocketbase";
import type { Assignment } from "../lib/types";

interface PlannerSearch {
  start?: boolean;
}

export const Route = createFileRoute("/study/planner")({
  validateSearch: (search: Record<string, unknown>): PlannerSearch => ({
    start: search.start === true || search.start === "true" || search.start === 1,
  }),
  component: StudyPlannerPage,
});

function StudyPlannerPage() {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const { streak, todayCompleted } = useStudyStreak();
  const { start: startQuery } = Route.useSearch();

  const [tasks, setTasks] = useState<Assignment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const items = await pb.collection("assignments").getFullList<Assignment>({
        filter: `user = "${userId}"`,
        sort: "-created",
      });
      setTasks(items);
    } catch {
      setTasks([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, load]);

  const addTask = useCallback(async () => {
    const title = draft.trim();
    if (!title || !userId) return;
    setDraft("");
    try {
      const created = await pb.collection("assignments").create<Assignment>({
        user: userId,
        title,
        description: "",
        status: "upcoming",
        points_possible: 0,
        canvas_id: 0,
        due_at: "",
        canvas_url: "",
        course: "",
        submission_types: [],
      });
      setTasks((prev) => (prev ? [created, ...prev] : [created]));
    } catch {
      setDraft(title);
    }
  }, [draft, userId]);

  const toggleTask = useCallback(async (task: Assignment) => {
    const nextStatus: Assignment["status"] =
      task.status === "submitted" || task.status === "graded" ? "upcoming" : "submitted";
    setTasks((prev) =>
      prev ? prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)) : prev,
    );
    try {
      await pb.collection("assignments").update(task.id, { status: nextStatus });
    } catch {
      // Revert on failure.
      setTasks((prev) =>
        prev ? prev.map((t) => (t.id === task.id ? task : t)) : prev,
      );
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    const prev = tasks;
    setTasks((p) => (p ? p.filter((t) => t.id !== taskId) : p));
    try {
      await pb.collection("assignments").delete(taskId);
    } catch {
      setTasks(prev);
    }
  }, [tasks]);

  const startEdit = useCallback((task: Assignment) => {
    setEditingId(task.id);
    setEditingText(task.title);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingId) return;
    const id = editingId;
    const title = editingText.trim();
    setEditingId(null);
    if (!title) return;
    setTasks((prev) =>
      prev ? prev.map((t) => (t.id === id ? { ...t, title } : t)) : prev,
    );
    try {
      await pb.collection("assignments").update(id, { title });
    } catch {
      void load();
    }
  }, [editingId, editingText, load]);

  return (
    <>
      <PageHeader
        title="Planner"
        subtitle="Tasks and focus sessions for today."
        actions={<StudyStreak streak={streak} todayCompleted={todayCompleted} />}
      />
      <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto space-y-12">
        {/* Pomodoro — minimal */}
        <section aria-label="Pomodoro timer">
          <PomodoroTimer workMinutes={prefs.pomodoroLength} autoStart={startQuery === true} />
        </section>

        {/* Task list — single column, primary action: add */}
        <section aria-label="Tasks" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Tasks
            </h2>
            {tasks && tasks.length > 0 && (
              <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">
                {tasks.filter((t) => t.status !== "submitted" && t.status !== "graded").length}{" "}
                open
              </span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addTask();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task and press Enter"
              className="flex-1 h-10 px-3 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
              aria-label="New task"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-10 px-4 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {tasks === null ? (
            <SkeletonList count={4} rowClassName="h-12 rounded-md" />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Nothing planned yet"
              description="Add your first task above to get started."
              size="md"
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {tasks.map((task) => {
                const done = task.status === "submitted" || task.status === "graded";
                const isEditing = editingId === task.id;
                return (
                  <li
                    key={task.id}
                    className="group flex items-center gap-3 py-3"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      aria-label={done ? "Mark incomplete" : "Mark complete"}
                      aria-pressed={done}
                      className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        done
                          ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                          : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      {done && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                    </button>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingText}
                        autoFocus
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 bg-transparent text-white focus:outline-none border-b border-[var(--color-primary)]"
                        aria-label="Edit task"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(task)}
                        className={`flex-1 text-left text-base ${
                          done
                            ? "text-[var(--color-text-subtle)] line-through"
                            : "text-white"
                        }`}
                      >
                        {task.title}
                      </button>
                    )}

                    <button
                      onClick={() => deleteTask(task.id)}
                      aria-label="Delete task"
                      className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--color-text-subtle)] hover:text-[var(--color-record)] transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
