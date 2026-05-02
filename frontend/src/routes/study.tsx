import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, HelpCircle, Clock } from "lucide-react";
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

  useEffect(() => {
    const now = new Date().toISOString();
    pb.collection('flashcards')
      .getList(1, 1, { filter: `user = "${userId}" && (next_review <= "${now}" || next_review = "")` })
      .then((r) => setDueCount(r.totalItems))
      .catch(() => {});

    pb.collection('quizzes')
      .getList(1, 1, { filter: `user = "${userId}"` })
      .then((r) => setQuizCount(r.totalItems))
      .catch(() => {});
  }, [userId]);

  const actions = [
    {
      icon: Brain,
      label: 'Flashcard Review',
      description: `${dueCount} cards due`,
      to: '/study/flashcards' as const,
      color: 'text-indigo-400',
    },
    {
      icon: HelpCircle,
      label: 'Quizzes',
      description: `${quizCount} available`,
      to: '/study/planner' as const,
      color: 'text-green-400',
    },
    {
      icon: Clock,
      label: 'Study Planner',
      description: 'Pomodoro & scheduling',
      to: '/study/planner' as const,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Study Hub</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.to}
              className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-500 rounded-xl p-5 transition-colors"
            >
              <Icon className={`w-8 h-8 ${action.color} mb-3`} />
              <p className="font-semibold text-zinc-100">{action.label}</p>
              <p className="text-sm text-zinc-400 mt-1">{action.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Quick Stats</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-indigo-400">{dueCount}</p>
            <p className="text-sm text-zinc-500">Cards Due</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-400">{quizCount}</p>
            <p className="text-sm text-zinc-500">Quizzes</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-amber-400">0</p>
            <p className="text-sm text-zinc-500">Day Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
}
