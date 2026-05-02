import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Clock, ArrowLeft, Plus } from "lucide-react";
import { pb } from "../lib/pocketbase";
import type { Course, Lecture } from "../lib/types";

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
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <p className="text-zinc-400">Course not found</p>
        <Link to="/courses" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Courses
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-zinc-950"
            style={{ backgroundColor: course.color }}
          />
          <div>
            <h1 className="text-2xl font-bold">{course.name}</h1>
            <p className="text-zinc-500 text-sm">{course.code}{course.semester && ` · ${course.semester}`}</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-zinc-400">
          <FileText className="w-4 h-4" />
          {lectures.length} {lectures.length === 1 ? 'lecture' : 'lectures'}
        </div>
        <Link
          to="/capture"
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Lecture
        </Link>
      </div>

      {/* Lectures */}
      {lectures.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No lectures yet</p>
          <p className="text-zinc-600 text-sm mt-1">Record or upload one from the Capture page</p>
          <Link
            to="/capture"
            className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Go to Capture
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {lectures.map((lec) => (
            <Link
              key={lec.id}
              to="/lectures/$lectureId"
              params={{ lectureId: lec.id }}
              className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-700 transition-colors">
                  <FileText className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{lec.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(lec.recorded_at).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm shrink-0">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.ceil(lec.duration_secs / 60)}m
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  lec.status === 'ready' ? 'bg-emerald-900/50 text-emerald-300' :
                  lec.status === 'error' ? 'bg-red-900/50 text-red-300' :
                  'bg-amber-900/50 text-amber-300'
                }`}>
                  {lec.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
