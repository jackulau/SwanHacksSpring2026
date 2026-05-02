import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, BookOpen, Trash2 } from "lucide-react";
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

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function CourseList({ userId }: { userId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [semester, setSemester] = useState('');

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

  async function handleCreate(e: React.FormEvent) {
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

  async function handleDelete(id: string) {
    await pb.collection('courses').delete(id);
    fetchCourses();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Courses</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="Course name (e.g. Biology 201)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Course code (e.g. BIO 201)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Semester (e.g. Fall 2026)"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-200 px-4 py-2">
              Cancel
            </button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-colors">
              Create
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No courses yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-zinc-500 transition-colors"
            >
              <div className="flex items-start justify-between">
                <Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: course.color }}
                    />
                    <h3 className="font-semibold text-zinc-100">{course.name}</h3>
                  </div>
                  {course.code && <p className="text-sm text-zinc-400">{course.code}</p>}
                  {course.semester && <p className="text-xs text-zinc-500 mt-1">{course.semester}</p>}
                </Link>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                  aria-label="Delete course"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
