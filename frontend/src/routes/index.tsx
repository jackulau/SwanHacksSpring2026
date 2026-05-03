import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { ConvergeLogo } from "../components/layout/ConvergeLogo";
import { pb } from "../lib/pocketbase";
import {
  Mic,
  BookOpen,
  Brain,
  Sparkles,
  Hand,
  Accessibility,
  ArrowRight,
  FileText,
  BarChart3,
} from "lucide-react";
import { useStudyStreak } from "../hooks/useStudyStreak";
import { HeroHeader } from "../components/dashboard/HeroHeader";
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentNotesDropdown } from "../components/dashboard/RecentNotesDropdown";
import { UpcomingClasses } from "../components/dashboard/UpcomingClasses";
import type { Lecture } from "../lib/types";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-[var(--color-border)] bg-black/80 backdrop-blur">
        <div className="flex items-center gap-2 text-white">
          <ConvergeLogo className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight">Converge</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-[var(--color-text-muted)] hover:text-white transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/login"
            className="text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-5 py-2 rounded-full transition-colors"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-20 pb-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/20 text-[var(--color-primary-strong)] text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          AI-powered study platform
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
          Record lectures.
          <br />
          <span className="text-[var(--color-primary-strong)]">
            Study smarter.
          </span>
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] mt-6 max-w-2xl mx-auto leading-relaxed">
          Record or upload any lecture — Converge transcribes it, generates
          notes, flashcards, and quizzes automatically. Built accessibility-first
          for every learner.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
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
            icon={<Mic className="w-6 h-6" />}
            title="Live Recording"
            description="Record lectures with real-time captions powered by Deepgram"
          />
          <FeatureCard
            icon={<Brain className="w-6 h-6" />}
            title="Smart Flashcards"
            description="AI-generated cards with SM-2 spaced repetition scheduling"
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Auto Notes"
            description="Structured notes generated from transcripts — key terms, examples, summaries"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="Practice Quizzes"
            description="Multiple choice, true/false, short answer — test yourself instantly"
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-12 py-20 border-t border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
          <p className="text-[var(--color-text-muted)] text-center mb-12 max-w-lg mx-auto">
            Three steps from lecture to exam-ready
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard step="1" title="Capture" description="Record live or upload audio/video. Real-time captions appear as you speak — with sign language detection via MediaPipe." />
            <StepCard step="2" title="Process" description="AI cleans up the transcript, generates structured notes, flashcards, and quiz questions — all automatically." />
            <StepCard step="3" title="Study" description="Review flashcards with spaced repetition, take practice quizzes, and track your progress with a Pomodoro timer." />
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="px-6 lg:px-12 py-20 border-t border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-[var(--color-primary-strong)] text-sm font-medium mb-4">
                <Accessibility className="w-4 h-4" />
                Accessibility-first
              </div>
              <h2 className="text-3xl font-bold mb-4">Built for every learner</h2>
              <p className="text-[var(--color-text-muted)] leading-relaxed mb-6">
                Converge is designed so every student can use it without
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
                  <div key={feature} className="flex items-center gap-2 text-sm text-white">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="bg-black border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                <div className="text-2xl font-bold font-atkinson">Aa</div>
                <div className="text-xs text-[var(--color-text-subtle)]">Atkinson Hyperlegible</div>
              </div>
              <div className="bg-black border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                <div className="text-2xl font-bold font-opendyslexic">Aa</div>
                <div className="text-xs text-[var(--color-text-subtle)]">OpenDyslexic</div>
              </div>
              <div className="bg-black border border-white rounded-xl p-4 space-y-2">
                <div className="text-lg font-bold">High Contrast</div>
                <div className="text-xs text-[var(--color-text-muted)]">Maximum readability</div>
              </div>
              <div className="rounded-xl p-4 space-y-2 vibe-aurora">
                <div className="relative z-10 text-lg font-bold text-white">Aurora Dark</div>
                <div className="relative z-10 text-xs text-[var(--color-text-muted)]">Calm, focused canvas</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sign language section */}
      <section className="px-6 lg:px-12 py-20 border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[var(--color-primary-strong)] text-sm font-medium mb-4">
            <Hand className="w-4 h-4" />
            MediaPipe Integration
          </div>
          <h2 className="text-3xl font-bold mb-4">Sign language recognition</h2>
          <p className="text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed mb-8">
            Converge uses MediaPipe Hands to detect ASL fingerspelling in
            real-time. Sign language captions appear alongside audio captions —
            making lectures accessible for deaf and hard-of-hearing students.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {["A", "B", "D", "F", "I", "O", "S", "V", "W", "Y"].map((letter) => (
              <div key={letter} className="w-12 h-12 rounded-xl bg-black border border-[var(--color-border)] flex items-center justify-center text-lg font-bold text-[var(--color-primary-strong)]">
                {letter}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-subtle)] mt-4">Currently supported ASL letters</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-12 py-20 border-t border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to study smarter?</h2>
          <p className="text-[var(--color-text-muted)] mb-8">
            Join Converge and turn any lecture into study material in minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold px-8 py-3.5 rounded-full text-base transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 lg:px-12 py-8 border-t border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-text-subtle)] text-sm">
            <ConvergeLogo className="w-4 h-4" />
            Converge
          </div>
          <p className="text-xs text-[var(--color-text-subtle)]">Built with accessibility in mind</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black p-6 hover:border-[var(--color-primary)]/40 transition-colors">
      <div className="w-12 h-12 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-black mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
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
      <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-black font-bold text-sm mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
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
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [dueCount, setDueCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const streak = useStudyStreak();

  useEffect(() => {
    let cancelled = false;
    const nowIso = new Date().toISOString();
    Promise.all([
      pb
        .collection("lectures")
        .getFullList<Lecture>({
          filter: `user = "${userId}"`,
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
    ]).then(([l, d]) => {
      if (cancelled) return;
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
    <div className="space-y-0">
      {/* Greeting band — runs across the top, no horizontal padding around it */}
      <HeroHeader
        name={displayName}
        streak={streak.streak}
        todayCompleted={streak.todayCompleted}
        streakLoading={streak.loading}
      />

      {/* Body — two-column layout: left stack (Quick Actions + Recents), right column (Upcoming) */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 -mt-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            <QuickActions
              dueCount={loading ? null : dueCount}
              loading={loading}
            />
            <RecentNotesDropdown
              lectures={lectures}
              loading={loading}
              variant="card"
              defaultOpen
            />
          </div>
          <div className="lg:col-span-1">
            <UpcomingClasses userId={userId} />
          </div>
        </div>

        {/* Mobile-only quick links */}
        <div className="grid grid-cols-2 gap-3 lg:hidden mt-4 max-w-6xl mx-auto">
          <Link
            to="/capture"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black border border-[var(--color-border)] text-[var(--color-record)] hover:border-[var(--color-record)]/50 transition-colors"
          >
            <Mic className="w-4 h-4" />
            <span className="text-sm font-medium">Record</span>
          </Link>
          <Link
            to="/courses"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black border border-[var(--color-border)] text-[var(--color-primary-strong)] hover:border-[var(--color-primary)]/50 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Notes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
