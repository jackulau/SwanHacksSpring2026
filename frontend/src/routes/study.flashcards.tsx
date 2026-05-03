import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { FlashcardDeck } from "../components/study/FlashcardDeck";
import { PageHeader } from "../components/layout/PageHeader";
import { useSM2 } from "../hooks/useSM2";
import { useAuth } from "../lib/auth";
import type { Flashcard } from "../lib/types";
import type { QualityRating } from "../lib/sm2";

export const Route = createFileRoute("/study/flashcards")({
  component: FlashcardsPage,
});

function FlashcardsPage() {
  const { user } = useAuth();
  const { rateCard, getDueCards } = useSM2();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setSessionComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDueCards(user.id).then((c) => {
      setCards(c);
      setLoading(false);
    });
  }, [user, getDueCards]);

  const handleRate = useCallback(
    async (card: Flashcard, rating: QualityRating) => {
      await rateCard(card, rating);
    },
    [rateCard],
  );

  const handleComplete = useCallback(() => {
    setSessionComplete(true);
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Flashcards" />
        <div className="p-6 max-w-2xl mx-auto">
          <p className="text-[var(--color-text-muted)]">Loading flashcards...</p>
        </div>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <PageHeader title="Flashcards" />
        <div className="p-6 max-w-2xl mx-auto text-center py-16">
          <p className="text-xl text-white mb-2">No cards due for review</p>
          <p className="text-[var(--color-text-muted)]">
            Record or upload a lecture to generate flashcards automatically.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Flashcards" subtitle="Review with spaced repetition" />
      <div className="p-6 max-w-2xl mx-auto">
        <FlashcardDeck cards={cards} onRate={handleRate} onComplete={handleComplete} />
      </div>
    </>
  );
}
