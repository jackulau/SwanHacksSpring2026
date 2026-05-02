import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { pb } from "../lib/pocketbase";
import {
  Mic,
  Upload,
  BookOpen,
  Flame,
  Clock,
  GraduationCap,
  Brain,
  Sparkles,
  Hand,
  Accessibility,
  ArrowRight,
  Zap,
  FileText,
  BarChart3,
} from "lucide-react";
import type { Course, Lecture } from "../lib/types";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LandingPage />;
  return (
    <AppShell>
      <Dashboard userId={user.id} email={user.email} />
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════
   Landing Page (public)
   ═══════════════════════════════════════════════ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-7 h-7 text-indigo-400" />
          <span className="text-xl font-bold tracking-tight">HackStack</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-full transition-colors"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-20 pb-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          AI-powered study platform
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
          Record lectures.
          <br />
          <span className="text-indigo-400">Study smarter.</span>
        </h1>
        <p className="text-lg text-zinc-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Record or upload any lecture — HackStack transcribes it, generates
          notes, flashcards, and quizzes automatically. Built accessibility-first
          for every learner.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 lg:px-12 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            color="bg-indigo-500"
            icon={<Mic className="w-6 h-6" />}
            title="Live Recording"
            description="Record lectures with real-time captions powered by Deepgram"
          />
          <FeatureCard
            color="bg-amber-500"
            icon={<Brain className="w-6 h-6" />}
            title="Smart Flashcards"
            description="AI-generated cards with SM-2 spaced repetition scheduling"
          />
          <FeatureCard
            color="bg-emerald-500"
            icon={<FileText className="w-6 h-6" />}
            title="Auto Notes"
            description="Structured notes generated from transcripts — key terms, examples, summaries"
          />
          <FeatureCard
            color="bg-rose-500"
            icon={<BarChart3 className="w-6 h-6" />}
            title="Practice Quizzes"
            description="Multiple choice, true/false, short answer — test yourself instantly"
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            How it works
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-lg mx-auto">
            Three steps from lecture to exam-ready
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Capture"
              description="Record live or upload audio/video. Real-time captions appear as you speak — with sign language detection via MediaPipe."
            />
            <StepCard
              step="2"
              title="Process"
              description="AI cleans up the transcript, generates structured notes, flashcards, and quiz questions — all automatically."
            />
            <StepCard
              step="3"
              title="Study"
              description="Review flashcards with spaced repetition, take practice quizzes, and track your progress with a Pomodoro timer."
            />
          </div>
        </div>
      </section>

      {/* Accessibility section */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-medium mb-4">
                <Accessibility className="w-4 h-4" />
                Accessibility-first
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Built for every learner
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                HackStack is designed so every student can use it without
                disclosure. Dyslexia-friendly fonts, high-contrast themes,
                reading rulers, text-to-speech, and sign language support — all
                built in from day one.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "OpenDyslexic font",
                  "High contrast mode",
                  "Reading ruler",
                  "Text-to-speech",
                  "Focus mode",
                  "Sign language",
                  "Reduced motion",
                  "Adjustable text size",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-sm text-zinc-300"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="text-2xl font-bold font-atkinson">Aa</div>
                <div className="text-xs text-zinc-500">Atkinson Hyperlegible</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="text-2xl font-bold font-opendyslexic">Aa</div>
                <div className="text-xs text-zinc-500">OpenDyslexic</div>
              </div>
              <div className="bg-black border border-white rounded-xl p-4 space-y-2">
                <div className="text-lg font-bold text-white">High Contrast</div>
                <div className="text-xs text-zinc-300">Maximum readability</div>
              </div>
              <div className="bg-[#f5f0e8] border border-[#c9b99a] rounded-xl p-4 space-y-2">
                <div className="text-lg font-bold text-[#3b2e1a]">Sepia</div>
                <div className="text-xs text-[#7a6b52]">Reduced eye strain</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sign language section */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-indigo-400 text-sm font-medium mb-4">
            <Hand className="w-4 h-4" />
            MediaPipe Integration
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Sign language recognition
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8">
            HackStack uses MediaPipe Hands to detect ASL fingerspelling in
            real-time. Sign language captions appear alongside audio captions —
            making lectures accessible for deaf and hard-of-hearing students.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {["A", "B", "D", "F", "I", "O", "S", "V", "W", "Y"].map(
              (letter) => (
                <div
                  key={letter}
                  className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg font-bold text-indigo-400"
                >
                  {letter}
                </div>
              ),
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-4">
            Currently supported ASL letters
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to study smarter?</h2>
          <p className="text-zinc-400 mb-8">
            Join HackStack and turn any lecture into study material in minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <GraduationCap className="w-4 h-4" />
            HackStack
          </div>
          <p className="text-xs text-zinc-600">
            Built with accessibility in mind
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  color,
  icon,
  title,
  description,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700 transition-colors">
      <div
        className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white mb-4`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Dashboard (authenticated)
   ═══════════════════════════════════════════════ */

function Dashboard({ userId, email }: { userId: string; email: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${userId}"`, sort: "-created" })
        .catch(() => [] as Course[]),
      pb
        .collection("lectures")
        .getFullList<Lecture>({
          filter: `user = "${userId}"`,
          sort: "-recorded_at",
        })
        .catch(() => [] as Lecture[]),
      pb
        .collection("flashcards")
        .getList(1, 1, {
          filter: `user = "${userId}" && next_review <= "${new Date().toISOString()}"`,
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ]).then(([c, l, d]) => {
      setCourses(c);
      setLectures(l);
      setDueCount(d);
      setLoading(false);
    });
  }, [userId]);

  const greeting = getGreeting();

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {email.split("@")[0]}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Here&apos;s your study overview
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/capture"
          className="group flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border border-indigo-500/20 rounded-2xl hover:border-indigo-500/40 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Record Lecture</p>
            <p className="text-sm text-zinc-500">Start live capture</p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 ml-auto group-hover:text-indigo-400 transition-colors" />
        </Link>

        <Link
          to="/capture/upload"
          className="group flex items-center gap-4 p-5 bg-gradient-to-br from-amber-600/20 to-amber-600/5 border border-amber-500/20 rounded-2xl hover:border-amber-500/40 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Upload Audio</p>
            <p className="text-sm text-zinc-500">Import a recording</p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 ml-auto group-hover:text-amber-400 transition-colors" />
        </Link>

        <Link
          to="/study/flashcards"
          className="group flex items-center gap-4 p-5 bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-500/20 rounded-2xl hover:border-emerald-500/40 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Review Cards</p>
            <p className="text-sm text-zinc-500">
              {dueCount > 0 ? `${dueCount} due now` : "All caught up"}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 ml-auto group-hover:text-emerald-400 transition-colors" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          iconColor="text-amber-400"
          label="Due Today"
          value={loading ? "—" : String(dueCount)}
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          iconColor="text-rose-400"
          label="Streak"
          value="0 days"
        />
        <StatCard
          icon={<GraduationCap className="w-4 h-4" />}
          iconColor="text-indigo-400"
          label="Courses"
          value={loading ? "—" : String(courses.length)}
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          iconColor="text-emerald-400"
          label="Lectures"
          value={loading ? "—" : String(lectures.length)}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lectures */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Recent Lectures</h2>
            {lectures.length > 0 && (
              <Link
                to="/courses"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                View all
              </Link>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-zinc-800/50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : lectures.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No lectures yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Record or upload your first lecture
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lectures.slice(0, 5).map((lec) => (
                <Link
                  key={lec.id}
                  to="/lectures/$lectureId"
                  params={{ lectureId: lec.id }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lec.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(lec.recorded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      lec.status === "ready"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : lec.status === "error"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-amber-900/50 text-amber-300"
                    }`}
                  >
                    {lec.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Courses */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Your Courses</h2>
            <Link
              to="/courses"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Manage
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-zinc-800/50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No courses yet</p>
              <Link
                to="/courses"
                className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300"
              >
                Add your first course
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {courses.slice(0, 5).map((course) => (
                <Link
                  key={course.id}
                  to="/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: course.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {course.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {course.code}
                      {course.semester && ` · ${course.semester}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
      <div className={`${iconColor} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
