import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Plus, BookOpen, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
import { pb } from "../lib/pocketbase";
import type { Course } from "../lib/types";

// Palette of 7 swatches that read well against the cream/dark surfaces.
const COLORS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "#5fbf78", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#14b8a6", label: "Teal" },
] as const;

const DEFAULT_COLOR = COLORS[0].value;

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
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchCourses() {
    try {
      const courses = await pb.collection("courses").getFullList<Course>({
        filter: `user = "${userId}"`,
        sort: "-id",
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
    try {
      await pb.collection("courses").create({
        user: userId,
        name: name.trim(),
        code: code.trim(),
        semester: semester.trim(),
        color,
      });
      setName("");
      setCode("");
      setSemester("");
      setColor(DEFAULT_COLOR);
      setShowForm(false);
      setError(null);
      fetchCourses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    }
  }

  async function handleSaveEdit(id: string, patch: Partial<Course>) {
    try {
      const updated = await pb.collection("courses").update<Course>(id, patch);
      setRows((prev) =>
        prev.map((r) => (r.course.id === id ? { ...r, course: updated } : r)),
      );
      setEditingId(null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    }
  }

  async function handleDelete(id: string) {
    const previous = rows;
    // Optimistic removal.
    setRows((prev) => prev.filter((r) => r.course.id !== id));
    setConfirmingDeleteId(null);
    try {
      await pb.collection("courses").delete(id);
      setError(null);
    } catch (err: unknown) {
      // Restore on failure.
      setRows(previous);
      setError(err instanceof Error ? err.message : "Failed to delete course");
    }
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
        {error && (
          <div
            role="alert"
            className="mb-4 px-3 py-2 text-xs text-[var(--color-record)] border border-[var(--color-record)]/40 bg-[var(--color-record)]/10 rounded-sm"
          >
            {error}
          </div>
        )}

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
              <div className="block sm:col-span-2 text-xs font-medium text-[var(--color-text-muted)]">
                Color
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setColor(DEFAULT_COLOR);
                }}
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
            {rows.map((row) => (
              <li key={row.course.id}>
                <CourseRow
                  row={row}
                  isEditing={editingId === row.course.id}
                  isConfirmingDelete={confirmingDeleteId === row.course.id}
                  onEdit={() => {
                    setEditingId(row.course.id);
                    setConfirmingDeleteId(null);
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={(patch) => handleSaveEdit(row.course.id, patch)}
                  onRequestDelete={() => {
                    setConfirmingDeleteId(row.course.id);
                    setEditingId(null);
                  }}
                  onCancelDelete={() => setConfirmingDeleteId(null)}
                  onConfirmDelete={() => handleDelete(row.course.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

interface CourseRowProps {
  row: CourseRow;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: Partial<Course>) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function CourseRow({
  row,
  isEditing,
  isConfirmingDelete,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: CourseRowProps) {
  const { course, assignmentCount, lectureCount, lastActivity } = row;

  if (isEditing) {
    return (
      <EditCourseForm course={course} onCancel={onCancelEdit} onSave={onSaveEdit} />
    );
  }

  const stripeColor = course.color || DEFAULT_COLOR;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 px-2 hover:bg-[var(--color-surface-raised)] transition-colors">
      <Link
        to="/courses/$courseId"
        params={{ courseId: course.id }}
        title={course.name}
        className="group min-w-0 flex items-center gap-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] rounded-sm"
      >
        <span
          aria-hidden="true"
          className="w-1 self-stretch rounded-sm shrink-0"
          style={{ backgroundColor: stripeColor }}
        />
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
            {lastActivity && <span>Active {formatActivity(lastActivity)}</span>}
          </div>
        </div>
      </Link>

      {isConfirmingDelete ? (
        <div className="flex items-center gap-3 text-xs" role="alertdialog" aria-label={`Confirm delete ${course.name}`}>
          <span className="text-[var(--color-text-muted)]">
            Delete <span className="font-semibold text-[var(--color-text)]">{course.name}</span>
            {(lectureCount > 0 || assignmentCount > 0) && (
              <>
                {" "}and its {lectureCount > 0 && `${lectureCount} ${lectureCount === 1 ? "lecture" : "lectures"}`}
                {lectureCount > 0 && assignmentCount > 0 && " + "}
                {assignmentCount > 0 && `${assignmentCount} ${assignmentCount === 1 ? "assignment" : "assignments"}`}
              </>
            )}
            ?
          </span>
          <button
            type="button"
            onClick={onConfirmDelete}
            autoFocus
            className="text-[var(--color-record)] font-semibold px-2 py-1 rounded-md hover:bg-[var(--color-record)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-record)]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${course.name}`}
            className="p-2 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${course.name}`}
            className="p-2 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-record)] hover:bg-[var(--color-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-record)]"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <ChevronRight
            className="w-4 h-4 ml-1 text-[var(--color-text-subtle)]"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

interface EditCourseFormProps {
  course: Course;
  onCancel: () => void;
  onSave: (patch: Partial<Course>) => void;
}

function EditCourseForm({ course, onCancel, onSave }: EditCourseFormProps) {
  const [name, setName] = useState(course.name);
  const [code, setCode] = useState(course.code);
  const [semester, setSemester] = useState(course.semester);
  const [color, setColor] = useState<string>(course.color || DEFAULT_COLOR);

  function commit() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      code: code.trim(),
      semester: semester.trim(),
      color,
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    commit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="py-4 px-2 bg-[var(--color-surface-raised)]"
      aria-label={`Edit ${course.name}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2 text-xs font-medium text-[var(--color-text-muted)]">
          Course name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-base focus:outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--color-text-muted)]">
          Code
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--color-text-muted)]">
          Semester
          <input
            type="text"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mt-2 w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <div className="block sm:col-span-2 text-xs font-medium text-[var(--color-text-muted)]">
          Color
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-4 py-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
        >
          Save
        </button>
      </div>
    </form>
  );
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function formatActivity(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const day = Math.floor(diffMs / 86_400_000);
  if (day < 1) return "today";
  if (day < 2) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Course color"
      className="mt-2 flex items-center gap-2 flex-wrap"
    >
      {COLORS.map((c) => {
        const selected = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] ${
              selected
                ? "ring-2 ring-offset-2 ring-[var(--color-text)] ring-offset-[var(--color-surface-raised)] scale-110"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: c.value }}
          />
        );
      })}
    </div>
  );
}
