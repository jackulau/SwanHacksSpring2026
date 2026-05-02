import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, HelpCircle, Clock, Zap, Target, TrendingUp } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Study Hub</h1>
        <p className="text-zinc-500 text-sm mt-1">Choose how you want to study</p>
      </div>

      {/* Study modes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/study/flashcards"
          className="group relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl p-6 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white mb-4">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Flashcards</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Review with spaced repetition
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              dueCount > 0
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              {loading ? '...' : `${dueCount} cards due`}
            </span>
          </div>
        </Link>

        <Link
          to="/study/planner"
          className="group relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-6 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white mb-4">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Quizzes</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Test your knowledge
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500">
              {loading ? '...' : `${quizCount} available`}
            </span>
          </div>
        </Link>

        <Link
          to="/study/planner"
          className="group relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-amber-600/5 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-6 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white mb-4">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Study Planner</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Pomodoro timer & scheduling
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500">
              25 min sessions
            </span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <h2 className="font-semibold mb-5">Your Progress</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center mx-auto mb-2">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold">{loading ? '—' : dueCount}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Cards Due</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center mx-auto mb-2">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold">{loading ? '—' : quizCount}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Quizzes</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-zinc-500 mt-0.5">Day Streak</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-zinc-500 mt-0.5">Cards Mastered</p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Study Tips</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { emoji: '🍅', tip: 'Use Pomodoro — 25 min focus + 5 min break' },
            { emoji: '🔁', tip: 'Review flashcards daily for best retention' },
            { emoji: '📝', tip: 'Take quizzes before exams to find weak spots' },
            { emoji: '⏱️', tip: 'Short frequent sessions beat long cram sessions' },
          ].map(({ emoji, tip }) => (
            <div key={tip} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/30">
              <span className="text-lg shrink-0">{emoji}</span>
              <p className="text-sm text-zinc-400">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
