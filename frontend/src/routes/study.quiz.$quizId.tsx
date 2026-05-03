import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
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
          percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
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
        <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto space-y-3">
          <Skeleton className="h-1 rounded-md" />
          <Skeleton className="h-8 w-2/3 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
      </AppShell>
    );
  }

  if (error || !quiz) {
    return (
      <AppShell>
        <PageHeader title="Quiz" />
        <div className="px-6 lg:px-8 py-12 max-w-2xl mx-auto">
          <EmptyState
            icon={FileQuestion}
            title={error || "Quiz not found"}
            description="This quiz may have been deleted or never existed."
            size="lg"
            action={
              <button
                onClick={() => navigate({ to: "/study" })}
                className="h-10 px-4 rounded-md border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] text-sm flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Study
              </button>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={quiz.title} eyebrow="Quiz" />
      <div className="px-6 lg:px-8 pt-4 pb-8 max-w-2xl mx-auto">
        <button
          onClick={() => navigate({ to: "/study" })}
          className="inline-flex items-center gap-1 h-8 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <QuizRunner
          questions={(quiz.questions as QuizQuestion[]) || []}
          onComplete={handleComplete}
        />
      </div>
    </AppShell>
  );
}
