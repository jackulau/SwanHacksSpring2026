import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { QuizRunner } from "../components/study/QuizRunner";
import { pb } from "../lib/pocketbase";
import type { Quiz, QuizQuestion } from "../lib/types";

export const Route = createFileRoute("/study/quiz/$quizId")({
  component: QuizPage,
});

function QuizPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { quizId } = Route.useParams();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    pb.collection("quizzes")
      .getOne<Quiz>(quizId)
      .then(setQuiz)
      .catch(() => setError("Quiz not found"))
      .finally(() => setLoading(false));
  }, [user, quizId]);

  const handleComplete = useCallback(
    async (answers: { questionId: string; answer: number | boolean | string; correct: boolean; pointsEarned: number }[]) => {
      if (!quiz || !user) return;
      const totalEarned = answers.reduce((s, a) => s + a.pointsEarned, 0);
      const totalPossible = (quiz.questions as QuizQuestion[]).reduce((s, q) => s + q.points, 0);
      try {
        await pb.collection("quiz_attempts").create({
          quiz: quiz.id,
          user: user.id,
          answers: answers.map((a) => ({
            question_id: a.questionId,
            answer: a.answer,
            correct: a.correct,
            points_earned: a.pointsEarned,
          })),
          score: totalEarned,
          max_score: totalPossible,
          percentage: Math.round((totalEarned / totalPossible) * 100),
          time_taken_secs: 0,
          completed_at: new Date().toISOString(),
        });
      } catch {
        // attempt save is best-effort
      }
    },
    [quiz, user],
  );

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <PageHeader title="Quiz" />
        <div className="p-6">
          <p className="text-[var(--color-text-muted)]">Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !quiz) {
    return (
      <AppShell>
        <PageHeader title="Quiz" />
        <div className="p-6 max-w-3xl mx-auto">
          <button
            onClick={() => navigate({ to: "/study" })}
            className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Study
          </button>
          <p className="text-[var(--color-text-muted)]">{error || "Quiz not found"}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={quiz.title} eyebrow="Quiz" />
      <div className="p-6 max-w-3xl mx-auto">
        <button
          onClick={() => navigate({ to: "/study" })}
          className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Study
        </button>
        <QuizRunner
          questions={(quiz.questions as QuizQuestion[]) || []}
          onComplete={handleComplete}
        />
      </div>
    </AppShell>
  );
}
