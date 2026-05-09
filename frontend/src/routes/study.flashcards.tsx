import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

interface FlashcardsSearch {
  /** Pathname to navigate back to on completion. Validated to start with `/`. */
  from?: string;
}

export const Route = createFileRoute("/study/flashcards")({
  component: FlashcardsPage,
  validateSearch: (raw: Record<string, unknown>): FlashcardsSearch => {
    const from = typeof raw.from === "string" ? raw.from : undefined;
    // Only allow same-origin paths to defend against open-redirect surprises
    // even though the router won't honor cross-origin URLs.
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      return { from };
    }
    return {};
  },
});

type Stage = "loading" | "ready" | "reviewing" | "complete";

function FlashcardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const { rateCard, getDueCards } = useSM2();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stage, setStage] = useState<Stage>("loading");

  const goBack = useCallback(() => {
    if (from) {
      navigate({ to: from });
    } else {
      navigate({ to: "/study" });
    }
  }, [from, navigate]);

  useEffect(() => {
    if (!user) return;
    getDueCards(user.id)
      .then((c) => {
        setCards(c);
        setStage(c.length === 0 ? "ready" : "ready");
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
    setStage("complete");
  }, []);

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
            title="No cards due"
            description="Record or upload a lecture to generate flashcards, then return here when they're ready for review."
            size="lg"
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
            {cards.length}
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
            Come back tomorrow for your next review.
          </p>
          <button
            onClick={goBack}
            className="w-full h-12 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
          >
            {from ? "Back to lecture" : "Back to Study"}
          </button>
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
