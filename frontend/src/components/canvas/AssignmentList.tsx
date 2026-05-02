import { useEffect, useState } from "react";
import { Calendar, ExternalLink, Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { pb } from "../../lib/pocketbase";
import type { Assignment, Course } from "../../lib/types";

interface Props {
  userId: string;
  limit?: number;
  showAll?: boolean;
}

export function AssignmentList({ userId, limit, showAll }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const filter = showAll
          ? `user = "${userId}"`
          : `user = "${userId}" && status = "upcoming"`;
        const items = await pb.collection("assignments").getFullList<Assignment>({
          filter,
          sort: "due_at",
        });
        setAssignments(limit ? items.slice(0, limit) : items);

        const courseRecords = await pb
          .collection("courses")
          .getFullList<Course>({ filter: `user = "${userId}"` });
        setCourses(new Map(courseRecords.map((c) => [c.id, c])));
      } catch {
        /* assignments collection may not exist yet */
      }
      setLoading(false);
    }
    fetch();
  }, [userId, limit, showAll]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-zinc-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No assignments</p>
        <p className="text-xs text-zinc-600 mt-1">
          Connect Canvas to import your assignments
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assignments.map((a) => {
        const course = courses.get(a.course);
        const dueDate = a.due_at ? new Date(a.due_at) : null;
        const isOverdue = dueDate && dueDate < new Date() && a.status === "upcoming";
        const daysUntil = dueDate
          ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
          : null;

        return (
          <div
            key={a.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
          >
            <StatusIcon status={isOverdue ? "missing" : a.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{a.title}</p>
                {a.canvas_url && (
                  <a
                    href={a.canvas_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-indigo-400 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {course && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: course.color }}
                    />
                    {course.code || course.name}
                  </span>
                )}
                {a.points_possible > 0 && (
                  <span className="text-xs text-zinc-600">
                    {a.points_possible} pts
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {dueDate ? (
                <div>
                  <p className={`text-xs font-medium ${
                    isOverdue ? "text-red-400" :
                    daysUntil !== null && daysUntil <= 1 ? "text-amber-400" :
                    daysUntil !== null && daysUntil <= 3 ? "text-amber-500" :
                    "text-zinc-400"
                  }`}>
                    {isOverdue
                      ? "Overdue"
                      : daysUntil === 0
                        ? "Due today"
                        : daysUntil === 1
                          ? "Due tomorrow"
                          : `${daysUntil}d left`}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {dueDate.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No due date</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusIcon({ status }: { status: Assignment["status"] }) {
  switch (status) {
    case "submitted":
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center shrink-0">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </div>
      );
    case "graded":
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center shrink-0">
          <CheckCircle className="w-4 h-4 text-indigo-400" />
        </div>
      );
    case "missing":
      return (
        <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center shrink-0">
          <XCircle className="w-4 h-4 text-red-400" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-600/10 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
      );
  }
}
