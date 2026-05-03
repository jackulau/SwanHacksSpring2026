import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Plus, BookOpen, Trash2, ChevronRight, Pencil, Check, X } from "lucide-react";
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

const COLORS: readonly string[] = [
  '#5fbf78',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];

interface CoursePatch {
  name: string;
  code: string;
  semester: string;
  color: string;
}

function CourseList({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [semester, setSemester] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function fetchCourses() {
    try {
      const records = await pb.collection('courses').getFullList<Course>({
        filter: `user = "${userId}"`,
        sort: '-created',
      });
      setCourses(records);
    } catch { /* empty */ }
    setLoading(false);
  }

  useEffect(() => { fetchCourses(); }, [userId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await pb.collection('courses').create({
      user: userId,
      name,
      code,
      semester,
      color: COLORS[courses.length % COLORS.length],
    });
    setName('');
    setCode('');
    setSemester('');
    setShowForm(false);
    fetchCourses();
  }

  async function handleSaveEdit(id: string, patch: CoursePatch) {
    const previous = courses;
    const optimistic = courses.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    );
    setCourses(optimistic);
    setEditingId(null);
    try {
      await pb.collection('courses').update(id, patch);
    } catch {
      setCourses(previous);
    }
  }

  async function handleConfirmDelete(id: string) {
    const previous = courses;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setConfirmDeleteId(null);
    try {
      await pb.collection('courses').delete(id);
    } catch {
      setCourses(previous);
    }
  }

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Organize your lectures and notes"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold px-5 py-2 rounded-full transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add course
          </button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        <p className="text-sm text-[var(--color-text-muted)]">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </p>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Course name</label>
              <input
                type="text"
                placeholder="e.g. Biology 201"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Course code</label>
                <input
                  type="text"
                  placeholder="e.g. BIO 201"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Semester</label>
                <input
                  type="text"
                  placeholder="e.g. Fall 2026"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-black border border-[var(--color-border)] text-white hover:border-[var(--color-border-strong)] rounded-full px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors"
              >
                Create course
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Add a course to organize your lectures"
            size="lg"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) =>
              editingId === course.id ? (
                <EditCourseForm
                  key={course.id}
                  course={course}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => handleSaveEdit(course.id, patch)}
                />
              ) : confirmDeleteId === course.id ? (
                <ConfirmDeleteRow
                  key={course.id}
                  course={course}
                  onCancel={() => setConfirmDeleteId(null)}
                  onConfirm={() => handleConfirmDelete(course.id)}
                />
              ) : (
                <div
                  key={course.id}
                  className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-5 hover:border-[var(--color-border-strong)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2"
                          style={{ backgroundColor: course.color, ['--tw-ring-offset-color' as string]: 'var(--color-surface)' }}
                        />
                        <h3 className="font-semibold text-white truncate">{course.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 ml-7">
                        {course.code && (
                          <span className="text-xs bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] px-2 py-0.5 rounded-md">
                            {course.code}
                          </span>
                        )}
                        {course.semester && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {course.semester}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setEditingId(course.id);
                        }}
                        className="text-[var(--color-text-subtle)] hover:text-[var(--color-primary-strong)] transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        aria-label="Edit course"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setConfirmDeleteId(course.id);
                        }}
                        className="text-[var(--color-text-subtle)] hover:text-[var(--color-record)] transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        aria-label="Delete course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: course.id }}
                        className="text-[var(--color-text-subtle)] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        aria-label="Open course"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface EditCourseFormProps {
  course: Course;
  onCancel: () => void;
  onSave: (patch: CoursePatch) => void;
}

function EditCourseForm({ course, onCancel, onSave }: EditCourseFormProps) {
  const [name, setName] = useState(course.name);
  const [code, setCode] = useState(course.code);
  const [semester, setSemester] = useState(course.semester);
  const [color, setColor] = useState(
    course.color && COLORS.includes(course.color) ? course.color : COLORS[0]
  );

  function submit() {
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
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-surface)] soft-shadow p-5 space-y-4"
      aria-label={`Edit ${course.name}`}
    >
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5" htmlFor={`edit-name-${course.id}`}>
          Course name
        </label>
        <input
          id={`edit-name-${course.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5" htmlFor={`edit-code-${course.id}`}>
            Course code
          </label>
          <input
            id={`edit-code-${course.id}`}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5" htmlFor={`edit-sem-${course.id}`}>
            Semester
          </label>
          <input
            id={`edit-sem-${course.id}`}
            type="text"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors"
          />
        </div>
      </div>
      <div>
        <span className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Color</span>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Course color">
          {COLORS.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Color: ${swatch}`}
                aria-pressed={selected}
                className={`w-7 h-7 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                  selected
                    ? 'ring-2 ring-white ring-offset-2 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: swatch, ['--tw-ring-offset-color' as string]: 'var(--color-surface)' }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 bg-black border border-[var(--color-border)] text-white hover:border-[var(--color-border-strong)] rounded-full px-4 py-2 text-sm transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold rounded-full px-5 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!name.trim()}
        >
          <Check className="w-4 h-4" />
          Save
        </button>
      </div>
    </form>
  );
}

interface ConfirmDeleteRowProps {
  course: Course;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDeleteRow({ course, onCancel, onConfirm }: ConfirmDeleteRowProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      role="alertdialog"
      aria-label={`Delete ${course.name}?`}
      onKeyDown={handleKeyDown}
      className="rounded-2xl border border-[var(--color-record)]/40 bg-[var(--color-surface)] soft-shadow p-5 flex items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <p className="font-medium text-white truncate">Delete this course?</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
          {course.name} will be removed. Lectures will be orphaned.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="bg-black border border-[var(--color-border)] text-white hover:border-[var(--color-border-strong)] rounded-full px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="bg-[var(--color-record)] hover:opacity-90 text-black font-semibold rounded-full px-4 py-1.5 text-sm transition-colors"
        >
          Yes, delete
        </button>
      </div>
    </div>
  );
}
