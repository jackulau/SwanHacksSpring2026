import { createFileRoute, useNavigate, Outlet, useMatch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, BookOpen, Trash2, ChevronRight } from "lucide-react";
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
          {courses.map((course) => (
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
                    onClick={() => handleDelete(course.id)}
                    className="text-zinc-700 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
                    aria-label="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="text-zinc-700 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
