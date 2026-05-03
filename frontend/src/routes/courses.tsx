import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
import { pb } from "../lib/pocketbase";
import type { Course } from "../lib/types";

export const Route = createFileRoute("/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const childMatch = useMatch({ from: "/courses/$courseId", shouldThrow: false });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {childMatch ? <Outlet /> : <CourseList userId={user.id} />}
    </AppShell>
  );
}

interface CourseRow {
  course: Course;
  assignmentCount: number;
  lectureCount: number;
  lastActivity: string | null;
}

function CourseList({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [semester, setSemester] = useState("");

  async function fetchCourses() {
    try {
      const courses = await pb.collection("courses").getFullList<Course>({
        filter: `user = "${userId}"`,
        sort: "-created",
      });

      const enriched = await Promise.all(
        courses.map(async (course) => {
          const [assignments, lectures] = await Promise.all([
            pb
              .collection("assignments")
              .getList(1, 1, { filter: `course = "${course.id}"`, requestKey: `asgn-${course.id}` })
              .catch(() => ({ totalItems: 0, items: [] as Array<{ created?: string }> })),
            pb
              .collection("lectures")
              .getList(1, 1, { filter: `course = "${course.id}"`, requestKey: `lec-${course.id}` })
              .catch(() => ({ totalItems: 0, items: [] as Array<{ recorded_at?: string }> })),
          ]);

          const last =
            (lectures.items[0] as { recorded_at?: string } | undefined)?.recorded_at ??
            (assignments.items[0] as { created?: string } | undefined)?.created ??
            course.updated ??
            course.created ??
            null;

          return {
            course,
            assignmentCount: assignments.totalItems,
            lectureCount: lectures.totalItems,
            lastActivity: last,
          };
        }),
      );
      setRows(enriched);
    } catch {
      /* empty */
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await pb.collection("courses").create({
      user: userId,
      name: name.trim(),
      code: code.trim(),
      semester: semester.trim(),
      color: "#5fbf78",
    });
    setName("");
    setCode("");
    setSemester("");
    setShowForm(false);
    fetchCourses();
  }

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Lectures, assignments, and notes by class."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add course
          </button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 border border-[var(--color-border)] bg-[var(--color-surface-raised)] rounded-sm p-6"
            aria-label="Create course"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2 text-xs font-medium text-[var(--color-text-muted)]">
                Course name
                <input
                  type="text"
                  placeholder="Biology 201"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-base focus:outline-none focus:border-[var(--color-primary)]"
                  autoFocus
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                Code
                <input
                  type="text"
                  placeholder="BIO 201"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                Semester
                <input
                  type="text"
                  placeholder="Fall 2026"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-4 py-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-px" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-sm" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Add a course or sync from Canvas to get started."
            size="lg"
          />
        ) : (
          <ul
            className="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]"
            role="list"
          >
            {rows.map(({ course, assignmentCount, lectureCount, lastActivity }) => (
              <li key={course.id}>
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 px-2 hover:bg-[var(--color-surface-raised)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-raised)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <h2 className="text-base font-medium text-[var(--color-text)] truncate">
                        {course.name}
                      </h2>
                      {course.code && (
                        <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
                          {course.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-subtle)]">
                      <span>
                        {lectureCount} {lectureCount === 1 ? "lecture" : "lectures"}
                      </span>
                      <span>
                        {assignmentCount} {assignmentCount === 1 ? "assignment" : "assignments"}
                      </span>
                      {course.semester && <span>{course.semester}</span>}
                      {lastActivity && (
                        <span>
                          Active {new Date(lastActivity).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 text-[var(--color-text-subtle)] group-hover:text-[var(--color-text)] transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
