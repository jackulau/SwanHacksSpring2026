import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { ChecklistItem, Course, CourseModuleRecord } from "../lib/types";

export const Route = createFileRoute("/courses/$courseId/modules")({
  component: CourseModulesPage,
});

function CourseModulesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courseId } = Route.useParams();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftTitle, setDraftTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await pb.collection("courses").getOne<Course>(courseId);
        if (cancelled) return;
        setCourse(c);
        const mods = await pb
          .collection("course_modules")
          .getFullList<CourseModuleRecord>({
            filter: `user = "${user.id}" && course = "${courseId}"`,
            sort: "sort_index,created",
            requestKey: `cmlist-${courseId}`,
          });
        if (!cancelled) setModules(mods);
      } catch {
        // course may have been deleted
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, courseId]);

  const addModule = async () => {
    if (!user || !draftTitle.trim()) return;
    setCreating(true);
    try {
      const next = await pb.collection("course_modules").create<CourseModuleRecord>({
        user: user.id,
        course: courseId,
        title: draftTitle.trim().slice(0, 256),
        description: "",
        sort_index: modules.length,
        checklist: [],
        done: false,
      });
      setModules((prev) => [...prev, next]);
      setExpanded((prev) => new Set(prev).add(next.id));
      setDraftTitle("");
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const updateModule = async (id: string, patch: Partial<CourseModuleRecord>) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    try {
      await pb.collection("course_modules").update(id, patch as Record<string, unknown>);
    } catch {
      // best-effort
    }
  };

  const deleteModule = async (id: string) => {
    if (!window.confirm("Delete this module? Checklist items will be lost.")) return;
    setModules((prev) => prev.filter((m) => m.id !== id));
    try {
      await pb.collection("course_modules").delete(id);
    } catch {
      // ignore
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const ix = modules.findIndex((m) => m.id === id);
    const swapIx = ix + dir;
    if (ix < 0 || swapIx < 0 || swapIx >= modules.length) return;
    const reordered = [...modules];
    [reordered[ix], reordered[swapIx]] = [reordered[swapIx], reordered[ix]];
    const renumbered = reordered.map((m, i) => ({ ...m, sort_index: i }));
    setModules(renumbered);
    for (const m of renumbered) {
      try {
        await pb
          .collection("course_modules")
          .update(m.id, { sort_index: m.sort_index });
      } catch {
        // ignore
      }
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Modules"
        subtitle={course ? `${course.code ? `${course.code} · ` : ""}${course.name}` : ""}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center text-xs">
          <Link
            to="/courses/$courseId"
            params={{ courseId }}
            className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to course
          </Link>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addModule();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="New module title"
            className="flex-1 h-10 px-3 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={!draftTitle.trim() || creating}
            className="h-10 px-4 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" aria-hidden="true" />
            )}
            Add
          </button>
        </form>

        {loading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
        ) : modules.length === 0 ? (
          <p className="text-xs text-[var(--color-text-subtle)]">
            No modules yet. Add one above to start a study plan.
          </p>
        ) : (
          <ul className="space-y-2">
            {modules.map((m, ix) => (
              <ModuleCard
                key={m.id}
                module={m}
                expanded={expanded.has(m.id)}
                onToggle={() => toggleExpand(m.id)}
                onUpdate={(patch) => updateModule(m.id, patch)}
                onDelete={() => deleteModule(m.id)}
                onMoveUp={ix > 0 ? () => move(m.id, -1) : undefined}
                onMoveDown={ix < modules.length - 1 ? () => move(m.id, 1) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function ModuleCard({
  module,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  module: CourseModuleRecord;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<CourseModuleRecord>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [draftItem, setDraftItem] = useState("");
  const checklist = module.checklist ?? [];
  const completed = checklist.filter((c) => c.done).length;
  const total = checklist.length;

  const addItem = () => {
    if (!draftItem.trim()) return;
    const next: ChecklistItem[] = [
      ...checklist,
      {
        id: Math.random().toString(36).slice(2, 10),
        title: draftItem.trim(),
        done: false,
      },
    ];
    onUpdate({ checklist: next });
    setDraftItem("");
  };

  const toggleItem = (itemId: string) => {
    const next = checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c,
    );
    const allDone = next.length > 0 && next.every((c) => c.done);
    onUpdate({ checklist: next, done: allDone });
  };

  const removeItem = (itemId: string) => {
    onUpdate({ checklist: checklist.filter((c) => c.id !== itemId) });
  };

  return (
    <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse module" : "Expand module"}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
        <input
          value={module.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none"
        />
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] tabular-nums">
          {completed}/{total}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label="Move up"
            className="px-1 h-7 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label="Move down"
            className="px-1 h-7 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete module"
            className="px-1 h-7 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] p-3 space-y-3">
          <textarea
            value={module.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description, readings, links…"
            rows={2}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none"
          />

          <ul className="space-y-1">
            {checklist.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 group text-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(c.id)}
                  aria-pressed={c.done}
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    c.done
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                      : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {c.done ? (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Square className="w-3 h-3 opacity-0" aria-hidden="true" />
                  )}
                </button>
                <span
                  className={`flex-1 ${
                    c.done
                      ? "line-through text-[var(--color-text-subtle)]"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {c.title}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--color-text-subtle)] hover:text-[var(--color-error)]"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draftItem}
              onChange={(e) => setDraftItem(e.target.value)}
              placeholder="Add a step…"
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded h-8 px-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none"
            />
            <button
              type="submit"
              disabled={!draftItem.trim()}
              className="text-xs px-2 h-8 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
            >
              Add step
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
