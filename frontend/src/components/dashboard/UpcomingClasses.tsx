/**
 * Dashboard assignments panel.
 *
 * The data comes from the Canvas-backed `assignments` collection and joins
 * courses only for display labels. Empty states stay real: no sample rows are
 * invented when integrations have not synced anything yet.
 */

import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Skeleton } from "../layout/Skeleton";
import { EmptyState } from "../layout/EmptyState";
import { pb } from "../../lib/pocketbase";
import type { Assignment, Course } from "../../lib/types";

interface UpcomingClassesProps {
  userId: string;
}

export function UpcomingClasses({ userId }: UpcomingClassesProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    Promise.all([
      pb
        .collection("assignments")
        .getList<Assignment>(1, 8, {
          filter: `user = "${userId}" && due_at >= "${startOfToday.toISOString()}"`,
          sort: "due_at",
          requestKey: "dash-upcoming-assignments",
        })
        .then((res) => res.items)
        .catch(() => [] as Assignment[]),
      pb
        .collection("courses")
        .getFullList<Course>({
          filter: `user = "${userId}"`,
          requestKey: "dash-assignment-courses",
        })
        .catch(() => [] as Course[]),
    ]).then(([assignmentItems, courseItems]) => {
      if (cancelled) return;
      setAssignments(assignmentItems);
      setCourses(courseItems);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  return (
    <section
      aria-label="Upcoming assignments"
      className="flex min-h-[360px] flex-col overflow-hidden rounded-lg border border-[#e8e8e8] bg-white p-5"
    >
      <h2 className="text-4xl font-normal tracking-tight text-black">
        Upcoming assignments
      </h2>

      {loading ? (
        <div className="mt-6 flex-1 space-y-4" aria-label="Loading upcoming assignments">
          <AssignmentSkeleton featured />
          <AssignmentSkeleton />
          <AssignmentSkeleton />
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            size="sm"
            icon={ClipboardList}
            title="No upcoming assignments"
            description="Connect or sync Canvas to fill this panel from your real coursework."
          />
        </div>
      ) : (
        <ul className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
          {assignments.map((assignment, index) => {
            const course = assignment.course
              ? courseById.get(assignment.course)
              : undefined;
            return (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                courseLabel={course?.code || course?.name || ""}
                featured={index === 0}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AssignmentCard({
  assignment,
  courseLabel,
  featured,
}: {
  assignment: Assignment;
  courseLabel: string;
  featured: boolean;
}) {
  const title = assignment.title || courseLabel || "Untitled assignment";
  const heading = featured ? title : courseLabel || title;
  const subline = featured && courseLabel ? courseLabel : "";

  return (
    <li className="motion-hover-lift rounded-lg border-2 border-[#dddddd] bg-[#fbfbfb] p-5 hover:border-[#cfe8d5] hover:bg-white">
      <h3
        className={`truncate text-2xl font-normal ${
          featured ? "text-[#438937]" : "text-black"
        }`}
        title={heading}
      >
        {heading}
      </h3>
      {subline && (
        <p className="mt-1 truncate text-sm font-semibold text-black/70">
          {subline}
        </p>
      )}
      <p className="mt-5 text-lg font-bold text-black">
        {formatDueDate(assignment.due_at)}
      </p>
      {featured && assignment.canvas_url && (
        <a
          href={assignment.canvas_url}
          target="_blank"
          rel="noopener noreferrer"
          className="motion-hover-lift mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-[#9e9e9e] bg-white px-4 text-lg font-bold text-black hover:border-[#438937] hover:text-[#438937] focus:outline-none focus:ring-2 focus:ring-[#438937]"
        >
          View assignment
        </a>
      )}
    </li>
  );
}

function AssignmentSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className="rounded-lg border-2 border-[#dddddd] bg-[#fbfbfb] p-5"
      aria-hidden="true"
    >
      <Skeleton className="h-8 w-3/5 rounded-md" />
      {featured && <Skeleton className="mt-2 h-4 w-1/3 rounded-md" />}
      <Skeleton className="mt-5 h-6 w-4/5 rounded-md" />
      {featured && <Skeleton className="mt-5 h-14 w-full rounded-lg" />}
    </div>
  );
}

function formatDueDate(iso?: string): string {
  if (!iso) return "No due date";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "No due date";
  const date = due.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = due.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} @ ${time}`;
}
