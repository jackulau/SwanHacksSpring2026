import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { FlashcardDeck } from "../components/study/FlashcardDeck";
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
  const [sessionComplete, setSessionComplete] = useState(false);

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
      <div className="p-6">
        <p className="text-zinc-500">Loading flashcards...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-xl text-zinc-300 mb-2">No cards due for review</p>
        <p className="text-zinc-500">
          Record or upload a lecture to generate flashcards automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Flashcard Review</h1>
      <FlashcardDeck cards={cards} onRate={handleRate} onComplete={handleComplete} />
    </div>
  );
}
