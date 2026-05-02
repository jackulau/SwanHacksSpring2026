import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Plus, BookOpen, Trash2, ChevronRight, Pencil, Check, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {courses.length} {courses.length === 1 ? 'course' : 'courses'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Course name</label>
            <input
              type="text"
              placeholder="e.g. Biology 201"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Course code</label>
              <input
                type="text"
                placeholder="e.g. BIO 201"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Semester</label>
              <input
                type="text"
                placeholder="e.g. Fall 2026"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors">
              Create Course
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No courses yet</p>
          <p className="text-zinc-600 text-sm mt-1">Add a course to organize your lectures</p>
        </div>
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
                className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-zinc-900"
                        style={{ backgroundColor: course.color }}
                      />
                      <h3 className="font-semibold truncate">{course.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 ml-7">
                      {course.code && (
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                          {course.code}
                        </span>
                      )}
                      {course.semester && (
                        <span className="text-xs text-zinc-500">
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
                      className="text-zinc-700 hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
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
                      className="text-zinc-700 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
                      aria-label="Delete course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: course.id }}
                      className="text-zinc-700 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
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
      className="bg-zinc-900/50 border border-indigo-500/40 rounded-2xl p-5 space-y-4"
      aria-label={`Edit ${course.name}`}
    >
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor={`edit-name-${course.id}`}>
          Course name
        </label>
        <input
          id={`edit-name-${course.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor={`edit-code-${course.id}`}>
            Course code
          </label>
          <input
            id={`edit-code-${course.id}`}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor={`edit-sem-${course.id}`}>
            Semester
          </label>
          <input
            id={`edit-sem-${course.id}`}
            type="text"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
      </div>
      <div>
        <span className="block text-xs font-medium text-zinc-400 mb-1.5">Color</span>
        <div className="flex items-center gap-2" role="group" aria-label="Course color">
          {COLORS.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Color: ${swatch}`}
                aria-pressed={selected}
                className={`w-7 h-7 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                  selected
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 px-4 py-2 text-sm rounded-xl"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="bg-zinc-900/50 border border-red-500/40 rounded-2xl p-5 flex items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <p className="font-medium text-zinc-100 truncate">Delete this course?</p>
        <p className="text-xs text-zinc-500 mt-1 truncate">
          {course.name} will be removed. Lectures will be orphaned.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-400 hover:text-zinc-200 px-3 py-1.5 text-sm rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Yes, delete
        </button>
      </div>
    </div>
  );
}
