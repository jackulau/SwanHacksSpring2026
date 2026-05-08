import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ArrowLeft,
  Plus,
  ClipboardList,
  NotebookPen,
  Loader2,
  Sparkles,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import { studyPlanFromCourse } from "../lib/generate";
import type { Course, Lecture, Note } from "../lib/types";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
import { AssignmentList } from "../components/canvas/AssignmentList";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseDetailPage,
});

type Tab = "lectures" | "assignments" | "notes";

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [notes, setNotes] = useState<Array<Note & { lectureTitle?: string }>>([]);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("lectures");
  // Study-plan generation state. On success we navigate to the new note
  // page directly so the user lands inside the generated checklist.
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const handleGeneratePlan = async () => {
    if (!course || planGenerating) return;
    setPlanGenerating(true);
    setPlanError(null);
    try {
      const page = await studyPlanFromCourse(course.id);
      navigate({ to: "/notes/$pageId", params: { pageId: page.id } });
    } catch (err) {
      setPlanError(
        err instanceof Error
          ? err.message
          : "Couldn't generate a study plan for this course.",
      );
    } finally {
      setPlanGenerating(false);
    }
  };

  useEffect(() => {
    if (!course?.name) return;
    const previous = document.title;
    document.title = `${course.name} · Converge`;
    return () => {
      document.title = previous;
    };
  }, [course?.name]);

  useEffect(() => {
    // Reset state when switching between course IDs so the previous course's
    // lectures/notes don't briefly flash on screen.
    setCourse(null);
    setLectures([]);
    setNotes([]);
    setAssignmentCount(0);
    setLoading(true);
    let cancelled = false;
    async function run() {
      try {
        const c = await pb.collection("courses").getOne<Course>(courseId);
        if (cancelled) return;
        setCourse(c);

        const lecs = await pb.collection("lectures").getFullList<Lecture>({
          filter: `course = "${courseId}"`,
          sort: "-recorded_at",
        });
        if (cancelled) return;
        setLectures(lecs);

        // Notes are linked to lectures, not directly to a course. Fetch by
        // joining on the course's lectures.
        if (lecs.length > 0) {
          const filter = lecs.map((l) => `lecture = "${l.id}"`).join(" || ");
          const ns = await pb
            .collection("notes")
            .getFullList<Note>({ filter, sort: "-id" })
            .catch(() => []);
          if (cancelled) return;
          const titleById = new Map(lecs.map((l) => [l.id, l.title]));
          setNotes(ns.map((n) => ({ ...n, lectureTitle: titleById.get(n.lecture) })));
        } else {
          setNotes([]);
        }

        const counts = await pb
          .collection("assignments")
          .getList(1, 1, { filter: `course = "${courseId}"` })
          .catch(() => ({ totalItems: 0 }));
        if (cancelled) return;
        setAssignmentCount(counts.totalItems);
      } catch {
        /* not found */
      }
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const tabs = useMemo(
    () =>
      [
        { id: "lectures" as const, label: "Lectures", count: lectures.length },
        { id: "assignments" as const, label: "Assignments", count: assignmentCount },
        { id: "notes" as const, label: "Notes", count: notes.length },
      ],
    [lectures.length, assignmentCount, notes.length],
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Course" />
        <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
          <Skeleton className="h-6 w-48 mb-8 rounded-sm" />
          <div className="space-y-px">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-sm" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <PageHeader title="Course not found" />
        <div className="px-4 sm:px-6 lg:px-8 py-20 max-w-4xl mx-auto text-center">
          <p className="text-[var(--color-text-muted)] text-sm">
            We couldn't find that course.
          </p>
          <Link
            to="/courses"
            className="text-sm text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] mt-3 inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-md"
          >
            Back to courses
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={course.name}
        eyebrow={
          course.code || course.semester ? (
            <span className="inline-flex items-center gap-2">
              {course.color && (
                <span
                  aria-hidden="true"
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: course.color }}
                />
              )}
              {course.code || course.semester}
            </span>
          ) : undefined
        }
        actions={
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={planGenerating}
              title="Build a checklist study plan from this course's lectures and assignments."
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] transition-colors"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {planGenerating ? "Generating…" : "Generate study plan"}
            </button>
            <Link
              to="/capture"
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add lecture
            </Link>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        {planError && (
          <div
            role="alert"
            className="mb-4 px-3 py-2 text-xs text-[var(--color-record)] border-l-2 border-[var(--color-record)] bg-[var(--color-record)]/10"
          >
            {planError}
          </div>
        )}
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          All courses
        </Link>

        {course.semester && (
          <p className="text-sm text-[var(--color-text-muted)] mb-6">{course.semester}</p>
        )}

        <div
          role="tablist"
          aria-label="Course sections"
          className="flex items-center gap-6 border-b border-[var(--color-border)] mb-6"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls="course-panel"
                id={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`relative -mb-px py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm ${
                  active
                    ? "text-[var(--color-text)] border-b-2 border-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-b-2 border-transparent"
                }`}
              >
                {t.label}
                <span
                  className={`ml-2 text-xs ${
                    active ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-subtle)]"
                  }`}
                >
                  {t.count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="course-panel"
          aria-labelledby={`tab-${tab}`}
          className="min-h-[12rem]"
        >
          {tab === "lectures" && <LecturesPanel lectures={lectures} />}
          {tab === "assignments" && (
            <AssignmentList userId={course.user} courseId={course.id} showAll />
          )}
          {tab === "notes" && <NotesPanel notes={notes} />}
        </div>
      </div>
    </>
  );
}

function LecturesPanel({ lectures }: { lectures: Lecture[] }) {
  if (lectures.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No lectures yet"
        description="Record or upload a lecture from the Capture page."
        size="lg"
        action={
          <Link
            to="/capture"
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          >
            Go to Capture
          </Link>
        }
      />
    );
  }

  return (
    <ul
      className="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]"
      role="list"
    >
      {lectures.map((lec) => (
        <li key={lec.id}>
          <Link
            to="/lectures/$lectureId"
            params={{ lectureId: lec.id }}
            title={lec.title}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 px-2 hover:bg-[var(--color-surface-raised)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-raised)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{lec.title}</p>
              <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                {new Date(lec.recorded_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {lec.duration_secs > 0 && (
                  <>
                    {" · "}
                    {Math.ceil(lec.duration_secs / 60)} min
                  </>
                )}
              </p>
            </div>
            <StatusPill status={lec.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ status }: { status: Lecture["status"] }) {
  const inFlight =
    status === "generating" ||
    status === "transcribing" ||
    status === "uploading" ||
    status === "processing";
  const tone =
    status === "ready"
      ? "text-[var(--color-primary-strong)]"
      : status === "error"
        ? "text-[var(--color-record)]"
        : "text-amber-400";
  const label =
    status === "ready"
      ? "Ready"
      : status === "error"
        ? "Failed"
        : status === "generating"
          ? "Generating…"
          : status === "transcribing"
            ? "Transcribing…"
            : status === "uploading"
              ? "Uploading…"
              : status === "processing"
                ? "Processing…"
                : status;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}
      title={status}
    >
      {inFlight && (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function NotesPanel({ notes }: { notes: Array<Note & { lectureTitle?: string }> }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        description="Notes are generated from your lectures."
        size="lg"
      />
    );
  }

  return (
    <ul
      className="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]"
      role="list"
    >
      {notes.map((n) => (
        <li key={n.id}>
          <Link
            to="/lectures/$lectureId"
            params={{ lectureId: n.lecture }}
            className="grid grid-cols-[auto_1fr] items-start gap-3 py-3 px-2 hover:bg-[var(--color-surface-raised)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-raised)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
          >
            <ClipboardList
              className="w-4 h-4 text-[var(--color-text-subtle)] mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{n.title}</p>
              {n.lectureTitle && (
                <p className="text-xs text-[var(--color-text-subtle)] mt-1 truncate">
                  {n.lectureTitle}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
