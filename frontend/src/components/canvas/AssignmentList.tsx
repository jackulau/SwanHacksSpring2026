import { useEffect, useState } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import { pb } from "../../lib/pocketbase";
import type { Assignment, Course } from "../../lib/types";
import { EmptyState } from "../layout/EmptyState";
import { Skeleton } from "../layout/Skeleton";

interface Props {
  userId: string;
  /** Restrict to a single course. Optional. */
  courseId?: string;
  limit?: number;
  showAll?: boolean;
}

export function AssignmentList({ userId, courseId, limit, showAll }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const filters = [`user = "${userId}"`];
        if (courseId) filters.push(`course = "${courseId}"`);
        if (!showAll) filters.push(`status = "upcoming"`);
        const items = await pb
          .collection("assignments")
          .getFullList<Assignment>({ filter: filters.join(" && "), sort: "due_at" });
        if (cancelled) return;
        setAssignments(limit ? items.slice(0, limit) : items);

        const courseRecords = await pb
          .collection("courses")
          .getFullList<Course>({ filter: `user = "${userId}"` });
        if (cancelled) return;
        setCourses(new Map(courseRecords.map((c) => [c.id, c])));
      } catch {
        /* assignments collection may not exist yet */
      }
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [userId, courseId, limit, showAll]);

  if (loading) {
    return (
      <div className="space-y-px" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-sm" />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No assignments"
        description="Sync Canvas to import assignments."
        size="md"
      />
    );
  }

  return (
    <ul
      className="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]"
      role="list"
    >
      {assignments.map((a) => {
        const course = courses.get(a.course);
        const dueDate = a.due_at ? new Date(a.due_at) : null;
        const isOverdue = !!dueDate && dueDate < new Date() && a.status === "upcoming";
        const daysUntil = dueDate
          ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
          : null;
        const effectiveStatus: Assignment["status"] = isOverdue ? "missing" : a.status;

        const dueLabel = !dueDate
          ? "—"
          : isOverdue
            ? "Overdue"
            : daysUntil === 0
              ? "Today"
              : daysUntil === 1
                ? "Tomorrow"
                : daysUntil !== null && daysUntil > 0 && daysUntil <= 6
                  ? `${daysUntil}d`
                  : dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

        const dueTone = isOverdue
          ? "text-[var(--color-record)]"
          : daysUntil !== null && daysUntil <= 1
            ? "text-amber-400"
            : "text-[var(--color-text-muted)]";

        return (
          <li key={a.id}>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 px-2 hover:bg-[var(--color-surface-raised)] transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.title}</p>
                  {a.canvas_url && (
                    <a
                      href={a.canvas_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${a.title} in Canvas`}
                      className="text-[var(--color-text-subtle)] hover:text-[var(--color-primary-strong)] transition-colors shrink-0 rounded-md p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-subtle)]">
                  {course && <span className="truncate">{course.code || course.name}</span>}
                  {a.points_possible > 0 && <span>{a.points_possible} pts</span>}
                </div>
              </div>
              <span className={`text-xs font-medium tabular-nums ${dueTone}`}>{dueLabel}</span>
              <StatusLabel status={effectiveStatus} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusLabel({ status }: { status: Assignment["status"] }) {
  const map: Record<Assignment["status"], { label: string; cls: string }> = {
    upcoming: { label: "Open", cls: "text-[var(--color-text-muted)]" },
    submitted: { label: "Submitted", cls: "text-[var(--color-primary-strong)]" },
    graded: { label: "Graded", cls: "text-[var(--color-primary-strong)]" },
    missing: { label: "Missing", cls: "text-[var(--color-record)]" },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-medium w-20 text-right ${cls}`}>{label}</span>;
}
