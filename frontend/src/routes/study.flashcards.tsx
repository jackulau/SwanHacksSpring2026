import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Brain, Play } from "lucide-react";
import { FlashcardDeck } from "../components/study/FlashcardDeck";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
import { useSM2 } from "../hooks/useSM2";
import { useAuth } from "../lib/auth";
import type { Flashcard } from "../lib/types";
import type { QualityRating } from "../lib/sm2";

export const Route = createFileRoute("/study/flashcards")({
  component: FlashcardsPage,
});

type Stage = "loading" | "ready" | "reviewing" | "complete";

function FlashcardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { rateCard, getDueCards } = useSM2();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [reviewedCount, setReviewedCount] = useState<number>(0);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    if (!user) return;
    getDueCards(user.id)
      .then((c) => {
        setCards(c);
        setStage("ready");
      })
      .catch(() => setStage("ready"));
  }, [user, getDueCards]);

  const handleRate = useCallback(
    async (card: Flashcard, rating: QualityRating) => {
      await rateCard(card, rating);
    },
    [rateCard],
  );

  const handleComplete = useCallback(() => {
    setReviewedCount(cards.length);
    setStage("complete");
  }, [cards.length]);

  if (stage === "loading") {
    return (
      <>
        <PageHeader title="Flashcards" />
        <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto space-y-3">
          <Skeleton className="h-1 rounded-md" />
          <Skeleton className="h-[360px] rounded-lg" />
        </div>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <PageHeader title="Flashcards" subtitle="Spaced repetition review." />
        <div className="px-6 lg:px-8 py-12 max-w-2xl mx-auto">
          <EmptyState
            icon={Brain}
            title="No cards due right now"
            description="Either you're caught up for today, or you haven't generated cards yet. New cards appear here as their review intervals come around."
            size="lg"
            action={
              <div className="flex items-center gap-3">
                <Link
                  to="/capture"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Record a lecture
                </Link>
                <Link
                  to="/courses"
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Or browse courses
                </Link>
              </div>
            }
          />
        </div>
      </>
    );
  }

  if (stage === "ready") {
    return (
      <>
        <PageHeader
          title="Flashcards"
          subtitle={`${cards.length} card${cards.length === 1 ? "" : "s"} ready for review.`}
        />
        <div className="px-6 lg:px-8 py-16 max-w-md mx-auto text-center">
          <p className="text-4xl font-semibold text-[var(--color-text)] tracking-tight tabular-nums mb-2">
            {cards.length.toLocaleString()}
          </p>
          <p className="text-[var(--color-text-muted)] mb-8">
            cards due today
          </p>
          <button
            onClick={() => setStage("reviewing")}
            className="w-full h-12 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Start review
          </button>
        </div>
      </>
    );
  }

  if (stage === "complete") {
    return (
      <>
        <PageHeader title="Flashcards" />
        <div className="px-6 lg:px-8 py-16 max-w-md mx-auto text-center">
          <p className="text-3xl font-semibold text-[var(--color-text)] tracking-tight mb-2">
            Session complete
          </p>
          <p className="text-[var(--color-text-muted)] mb-8">
            {reviewedCount > 0
              ? `Reviewed ${reviewedCount} ${reviewedCount === 1 ? "card" : "cards"}. Next review opens as cards become due.`
              : "Next review opens as cards become due."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate({ to: "/study" })}
              className="flex-1 h-11 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
            >
              Back to Study
            </button>
            <Link
              to="/study/planner"
              className="flex-1 h-11 rounded-md border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text)] font-medium transition-colors flex items-center justify-center"
            >
              Open planner
            </Link>
          </div>
        </div>
      </>
    );
  }

  // stage === "reviewing" → full-bleed focus mode (no PageHeader chrome).
  return (
    <div className="px-6 lg:px-8 pt-8 pb-8 max-w-2xl mx-auto">
      <FlashcardDeck cards={cards} onRate={handleRate} onComplete={handleComplete} />
    </div>
  );
}
