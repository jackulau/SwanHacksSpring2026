import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Clock, ArrowLeft, Plus } from "lucide-react";
import { pb } from "../lib/pocketbase";
import type { Course, Lecture } from "../lib/types";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const c = await pb.collection('courses').getOne<Course>(courseId);
        setCourse(c);
        const lecs = await pb.collection('lectures').getFullList<Lecture>({
          filter: `course = "${courseId}"`,
          sort: '-recorded_at',
        });
        setLectures(lecs);
      } catch { /* not found */ }
      setLoading(false);
    }
    fetch();
  }, [courseId]);

  if (loading) {
    return (
      <>
        <PageHeader title="Course" />
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
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
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto text-center py-20">
          <p className="text-[var(--color-text-muted)]">Course not found</p>
          <Link to="/courses" className="text-sm text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] mt-2 inline-block">
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
        eyebrow={course.code || undefined}
        subtitle={course.semester || undefined}
        actions={
          <Link
            to="/capture"
            className="flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add lecture
          </Link>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            All courses
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full ring-2 ring-offset-2"
              style={{ backgroundColor: course.color, ['--tw-ring-offset-color' as string]: 'var(--color-bg)' }}
            />
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <FileText className="w-4 h-4" />
              {lectures.length} {lectures.length === 1 ? 'lecture' : 'lectures'}
            </div>
          </div>
        </div>

        {lectures.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow">
            <EmptyState
              icon={FileText}
              title="No lectures yet"
              description="Record or upload one from the Capture page"
              size="lg"
              action={
                <Link
                  to="/capture"
                  className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors"
                >
                  Go to Capture
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lec) => (
              <Link
                key={lec.id}
                to="/lectures/$lectureId"
                params={{ lectureId: lec.id }}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] soft-shadow p-4 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center justify-center shrink-0 group-hover:border-[var(--color-border-strong)] transition-colors">
                    <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{lec.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {new Date(lec.recorded_at).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0">
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.ceil(lec.duration_secs / 60)}m
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    lec.status === 'ready' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]' :
                    lec.status === 'error' ? 'bg-[var(--color-record)]/15 text-[var(--color-record)]' :
                    'bg-amber-900/40 text-amber-300'
                  }`}>
                    {lec.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
