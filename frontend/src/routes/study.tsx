import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { StudyStreak } from "../components/study/StudyStreak";
import { useStudyStreak } from "../hooks/useStudyStreak";
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

interface HubCounts {
  due: number;
  quizzes: number;
}

function StudyHub({ userId }: { userId: string }) {
  const [counts, setCounts] = useState<HubCounts | null>(null);
  const { streak, todayCompleted } = useStudyStreak();

  useEffect(() => {
    const now = new Date().toISOString();
    let cancelled = false;
    Promise.all([
      pb.collection('flashcards')
        .getList(1, 1, { filter: `user = "${userId}" && (next_review <= "${now}" || next_review = "")` })
        .then((r) => r.totalItems)
        .catch(() => 0),
      pb.collection('quizzes')
        .getList(1, 1, { filter: `user = "${userId}"` })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ]).then(([due, quizzes]) => {
      if (cancelled) return;
      setCounts({ due, quizzes });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Single primary action per page: Start Pomodoro. ≤2-click depth from sidebar.
  return (
    <>
      <PageHeader
        title="Study"
        subtitle="Focus, review, plan."
        actions={<StudyStreak streak={streak} todayCompleted={todayCompleted} />}
      />
      <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto">
        {/* Primary action */}
        <Link
          to="/study/planner"
          search={{ start: true }}
          className="block bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md h-12 flex items-center justify-center font-medium transition-colors mb-8"
        >
          Start Pomodoro
        </Link>

        {/* Typographic launcher rows — Things 3 / Linear style */}
        <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          <LauncherRow
            to="/study/due"
            label="Review due today"
            description="Every deck, one queue"
            meta={
              counts === null
                ? '…'
                : counts.due === 0
                  ? 'All caught up'
                  : `${counts.due} due`
            }
            metaActive={counts !== null && counts.due > 0}
          />
          <LauncherRow
            to="/study/flashcards"
            label="Flashcards"
            description="Spaced repetition review"
            meta={
              counts === null
                ? '…'
                : counts.due === 0
                  ? 'No cards due'
                  : `${counts.due} due`
            }
            metaActive={counts !== null && counts.due > 0}
          />
          <LauncherRow
            to="/study/planner"
            label="Planner"
            description="Tasks and Pomodoro sessions"
            meta="Today"
          />
          <LauncherRow
            to="/courses"
            label="Quizzes"
            description={
              counts !== null && counts.quizzes === 0
                ? "Generate a study set on a lecture to create your first quiz"
                : "Open a lecture to take its quiz"
            }
            meta={
              counts === null
                ? '…'
                : counts.quizzes === 0
                  ? 'None yet'
                  : `${counts.quizzes} available`
            }
            metaActive={counts !== null && counts.quizzes > 0}
          />
          <LauncherRow
            to="/play"
            label="Multiplayer"
            description="Join a friend's quiz with a 6-character code"
            meta="Open"
          />
          <LauncherRow
            to="/sessions"
            label="Sessions"
            description="Hosted or joined rounds"
            meta="History"
          />
          <LauncherRow
            to="/decks"
            label="Decks"
            description="Per-deck stats, export, delete"
            meta="Library"
          />
          <LauncherRow
            to="/goals"
            label="Goals"
            description="Set and track learning targets"
            meta="Plan"
          />
          <LauncherRow
            to="/focus"
            label="Focus"
            description="Distraction-free pomodoro"
            meta="25 min"
          />
        </ul>
      </div>
    </>
  );
}

interface LauncherRowProps {
  to: string;
  label: string;
  description: string;
  meta: string;
  metaActive?: boolean;
  disabled?: boolean;
}

function LauncherRow({ to, label, description, meta, metaActive, disabled }: LauncherRowProps) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-base text-[var(--color-text)] font-medium tracking-tight">{label}</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`text-xs tabular-nums ${
            metaActive
              ? 'text-[var(--color-primary-strong)]'
              : 'text-[var(--color-text-subtle)]'
          }`}
        >
          {meta}
        </span>
        <ArrowUpRight
          className="w-4 h-4 text-[var(--color-text-subtle)] group-hover:text-[var(--color-text)] transition-colors"
          aria-hidden="true"
        />
      </div>
    </>
  );

  if (disabled) {
    return (
      <li
        className="flex items-center justify-between py-4 opacity-50"
        aria-disabled="true"
      >
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={to}
        className="group flex items-center justify-between py-4 hover:bg-[var(--color-surface-raised)] -mx-2 px-2 rounded-md transition-colors"
      >
        {content}
      </Link>
    </li>
  );
}
