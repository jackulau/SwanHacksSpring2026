import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { pb } from "../lib/pocketbase";
import {
  Mic,
  BookOpen,
  Clock,
  GraduationCap,
  Brain,
  Sparkles,
  Hand,
  Accessibility,
  ArrowRight,
  FileText,
  BarChart3,
  Calendar,
  Upload,
} from "lucide-react";
import { AssignmentList } from "../components/canvas/AssignmentList";
import { useStudyStreak } from "../hooks/useStudyStreak";
import { HeroHeader } from "../components/dashboard/HeroHeader";
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentNotesDropdown } from "../components/dashboard/RecentNotesDropdown";
import { Skeleton, SkeletonText } from "../components/layout/Skeleton";
import { EmptyState } from "../components/layout/EmptyState";
import type { Course, Lecture } from "../lib/types";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-zinc-900/80 bg-[var(--color-bg)]/80 backdrop-blur">
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
            className="text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2 rounded-full transition-colors"
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
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
            Study smarter.
          </span>
        </h1>
        <p className="text-lg text-zinc-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Record or upload any lecture — HackStack transcribes it, generates
          notes, flashcards, and quizzes automatically. Built accessibility-first
          for every learner.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
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
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900/80">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
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
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900/80">
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
                disclosure. Dyslexia-friendly fonts, high-contrast mode, reading
                rulers, text-to-speech, and sign language support — all built in
                from day one.
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
                <div className="text-xs text-zinc-500">
                  Atkinson Hyperlegible
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="text-2xl font-bold font-opendyslexic">Aa</div>
                <div className="text-xs text-zinc-500">OpenDyslexic</div>
              </div>
              <div className="bg-black border border-white rounded-xl p-4 space-y-2">
                <div className="text-lg font-bold text-white">High Contrast</div>
                <div className="text-xs text-zinc-300">Maximum readability</div>
              </div>
              <div className="rounded-xl p-4 space-y-2 vibe-aurora">
                <div className="relative z-10 text-lg font-bold text-white">
                  Aurora Dark
                </div>
                <div className="relative z-10 text-xs text-zinc-300">
                  Calm, focused canvas
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sign language section */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900/80">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-indigo-400 text-sm font-medium mb-4">
            <Hand className="w-4 h-4" />
            MediaPipe Integration
          </div>
          <h2 className="text-3xl font-bold mb-4">Sign language recognition</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8">
            HackStack uses MediaPipe Hands to detect ASL fingerspelling in
            real-time. Sign language captions appear alongside audio captions —
            making lectures accessible for deaf and hard-of-hearing students.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {["A", "B", "D", "F", "I", "O", "S", "V", "W", "Y"].map((letter) => (
              <div
                key={letter}
                className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg font-bold text-indigo-400"
              >
                {letter}
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-4">
            Currently supported ASL letters
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-12 py-20 border-t border-zinc-900/80">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to study smarter?</h2>
          <p className="text-zinc-400 mb-8">
            Join HackStack and turn any lecture into study material in minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 border-t border-zinc-900/80">
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

interface FeatureCardProps {
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ color, icon, title, description }: FeatureCardProps) {
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

interface StepCardProps {
  step: string;
  title: string;
  description: string;
}

function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm mx-auto mb-4">
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

interface DashboardProps {
  userId: string;
  email: string;
}

function Dashboard({ userId, email }: DashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [dueCount, setDueCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const streak = useStudyStreak();

  useEffect(() => {
    let cancelled = false;
    const nowIso = new Date().toISOString();
    Promise.all([
      pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${userId}"`, sort: "-created" })
        .catch(() => [] as Course[]),
      pb
        .collection("lectures")
        .getFullList<Lecture>({
          filter: `user = "${userId}"`,
          // -updated approximates "most recently accessed" — PB updates that
          // field whenever the lecture is touched (read tracking, retitling,
          // reprocessing).
          sort: "-updated",
        })
        .catch(() => [] as Lecture[]),
      pb
        .collection("flashcards")
        .getList(1, 1, {
          filter: `user = "${userId}" && next_review <= "${nowIso}"`,
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ]).then(([c, l, d]) => {
      if (cancelled) return;
      setCourses(c);
      setLectures(l);
      setDueCount(d);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = email.split("@")[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* ── Hero with streak ─────────────────────────────────────── */}
      <HeroHeader
        name={displayName}
        streak={streak.streak}
        todayCompleted={streak.todayCompleted}
        streakLoading={streak.loading}
      />

      {/* ── Quick actions ────────────────────────────────────────── */}
      <QuickActions
        dueCount={loading ? null : dueCount}
        loading={loading}
      />

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          iconColor="text-amber-400"
          label="Due Today"
          value={loading ? "—" : String(dueCount)}
          loading={loading}
        />
        <StatCard
          icon={<GraduationCap className="w-4 h-4" />}
          iconColor="text-indigo-400"
          label="Courses"
          value={loading ? "—" : String(courses.length)}
          loading={loading}
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          iconColor="text-emerald-400"
          label="Lectures"
          value={loading ? "—" : String(lectures.length)}
          loading={loading}
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4" />}
          iconColor="text-rose-400"
          label="Streak"
          value={
            streak.loading
              ? "—"
              : streak.streak === 0
                ? "0 days"
                : `${streak.streak} day${streak.streak === 1 ? "" : "s"}`
          }
          loading={streak.loading}
        />
      </div>

      {/* ── Two-column: Recent Notes (with caret-only dropdown) + Courses ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <RecentNotesDropdown
          lectures={lectures}
          loading={loading}
          variant="card"
          defaultOpen
        />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6 soft-shadow">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-zinc-100">Your Courses</h2>
            <Link
              to="/courses"
              className="text-xs text-indigo-300 hover:text-indigo-200"
            >
              Manage
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              size="sm"
              icon={GraduationCap}
              title="No courses yet"
              description="Add a course to organize lectures"
              action={
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                >
                  Add your first course
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          ) : (
            <ul className="space-y-1">
              {courses.slice(0, 5).map((course) => (
                <li key={course.id}>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-zinc-900/50"
                      style={{ backgroundColor: course.color, "--tw-ring-color": `${course.color}40` } as React.CSSProperties}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-zinc-100">
                        {course.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {course.code}
                        {course.semester && ` · ${course.semester}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Upcoming Assignments ──────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6 soft-shadow">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-zinc-100">Upcoming Assignments</h2>
          </div>
          <Link
            to="/settings"
            className="text-xs text-indigo-300 hover:text-indigo-200"
          >
            Canvas settings
          </Link>
        </div>
        <AssignmentList userId={userId} limit={5} />
      </div>

      {/* ── Mobile-only quick links to capture/upload (re-iterates QA above for thumb-reach) ── */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <Link
          to="/capture"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 transition-colors"
        >
          <Mic className="w-4 h-4" />
          <span className="text-sm font-medium">Record</span>
        </Link>
        <Link
          to="/capture/upload"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Upload</span>
        </Link>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string;
  loading?: boolean;
}

function StatCard({ icon, iconColor, label, value, loading = false }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 soft-shadow">
      <div className={`${iconColor} mb-2`} aria-hidden="true">
        {icon}
      </div>
      {loading ? (
        <div className="space-y-2">
          <SkeletonText width="3rem" />
          <SkeletonText width="4rem" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </>
      )}
    </div>
  );
}
