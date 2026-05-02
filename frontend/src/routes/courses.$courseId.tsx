import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Clock } from "lucide-react";
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

  if (loading) return <div className="p-6"><p className="text-zinc-500">Loading...</p></div>;
  if (!course) return <div className="p-6"><p className="text-zinc-400">Course not found.</p></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: course.color }} />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{course.name}</h1>
          <p className="text-zinc-500 text-sm">{course.code} · {course.semester}</p>
        </div>
      </div>

      {lectures.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No lectures yet. Record or upload one from the Capture page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lectures.map((lec) => (
            <Link
              key={lec.id}
              to="/lectures/$lectureId"
              params={{ lectureId: lec.id }}
              className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700 hover:border-zinc-500 rounded-xl p-4 transition-colors"
            >
              <div>
                <p className="font-medium text-zinc-100">{lec.title}</p>
                <p className="text-sm text-zinc-500 mt-1">
                  {new Date(lec.recorded_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.ceil(lec.duration_secs / 60)} min
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  lec.status === 'ready' ? 'bg-green-900/50 text-green-300' :
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
