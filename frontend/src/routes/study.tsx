import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, HelpCircle, Clock, Zap, Target, TrendingUp } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { pb } from "../lib/pocketbase";

export const Route = createFileRoute("/study")({
  component: StudyPage,
});

function StudyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isIndex = location.pathname === "/study";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {isIndex ? <StudyHub userId={user.id} /> : <Outlet />}
    </AppShell>
  );
}

function StudyHub({ userId }: { userId: string }) {
  const [dueCount, setDueCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      pb.collection('flashcards')
        .getList(1, 1, { filter: `user = "${userId}" && (next_review <= "${now}" || next_review = "")` })
        .then((r) => r.totalItems)
        .catch(() => 0),
      pb.collection('quizzes')
        .getList(1, 1, { filter: `user = "${userId}"` })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ]).then(([d, q]) => {
      setDueCount(d);
      setQuizCount(q);
      setLoading(false);
    });
  }, [userId]);

  return (
    <>
      <PageHeader title="Study Hub" subtitle="Choose how you want to study" />
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        {/* Study modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/study/flashcards"
            className="group relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/40 rounded-2xl p-6 transition-all soft-shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-black mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-1 text-white">Flashcards</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Review with spaced repetition
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                dueCount > 0
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                  : 'bg-[var(--color-input)] text-[var(--color-text-subtle)]'
              }`}>
                {loading ? '...' : `${dueCount} cards due`}
              </span>
            </div>
          </Link>

          <Link
            to="/study/planner"
            className="group relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/40 rounded-2xl p-6 transition-all soft-shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-black mb-4">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-1 text-white">Quizzes</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Test your knowledge
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-input)] text-[var(--color-text-subtle)]">
                {loading ? '...' : `${quizCount} available`}
              </span>
            </div>
          </Link>

          <Link
            to="/study/planner"
            className="group relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/40 rounded-2xl p-6 transition-all soft-shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-black mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-1 text-white">Study Planner</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Pomodoro timer & scheduling
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-input)] text-[var(--color-text-subtle)]">
                25 min sessions
              </span>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6">
          <h2 className="font-semibold mb-5 text-white">Your Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center mx-auto mb-2">
                <Brain className="w-5 h-5 text-[var(--color-primary-strong)]" />
              </div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : dueCount}</p>
              <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">Cards Due</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center mx-auto mb-2">
                <Target className="w-5 h-5 text-[var(--color-primary-strong)]" />
              </div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : quizCount}</p>
              <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">Quizzes</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center mx-auto mb-2">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-rose-600/10 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">Cards Mastered</p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6">
          <h2 className="font-semibold mb-4 text-white">Study Tips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: '🍅', tip: 'Use Pomodoro — 25 min focus + 5 min break' },
              { emoji: '🔁', tip: 'Review flashcards daily for best retention' },
              { emoji: '📝', tip: 'Take quizzes before exams to find weak spots' },
              { emoji: '⏱️', tip: 'Short frequent sessions beat long cram sessions' },
            ].map(({ emoji, tip }) => (
              <div key={tip} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                <span className="text-lg shrink-0">{emoji}</span>
                <p className="text-sm text-[var(--color-text-muted)]">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
