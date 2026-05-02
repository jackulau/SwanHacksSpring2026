import { useState, useCallback } from 'react';
import { FlashcardCard } from './FlashcardCard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { Flashcard } from '../../lib/types';
import type { QualityRating } from '../../lib/sm2';

interface FlashcardDeckProps {
  cards: Flashcard[];
  onRate: (card: Flashcard, rating: QualityRating) => void;
  onComplete: () => void;
}

const RATINGS: { key: QualityRating; label: string; color: string; shortcut: string }[] = [
  { key: 'again', label: 'Again', color: 'bg-red-600 hover:bg-red-500', shortcut: '1' },
  { key: 'hard', label: 'Hard', color: 'bg-orange-600 hover:bg-orange-500', shortcut: '2' },
  { key: 'good', label: 'Good', color: 'bg-green-600 hover:bg-green-500', shortcut: '3' },
  { key: 'easy', label: 'Easy', color: 'bg-blue-600 hover:bg-blue-500', shortcut: '4' },
];

export function FlashcardDeck({ cards, onRate, onComplete }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);

  const currentCard = cards[currentIndex];

  const handleRate = useCallback(
    (rating: QualityRating) => {
      if (!currentCard || !isFlipped) return;
      onRate(currentCard, rating);
      setReviewed((r) => r + 1);
      if (rating !== 'again') setCorrect((c) => c + 1);
      setIsFlipped(false);

      if (currentIndex + 1 >= cards.length) {
        onComplete();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentCard, isFlipped, currentIndex, cards.length, onRate, onComplete],
  );

  useKeyboardShortcuts([
    { key: ' ', handler: () => setIsFlipped((f) => !f) },
    { key: '1', handler: () => handleRate('again') },
    { key: '2', handler: () => handleRate('hard') },
    { key: '3', handler: () => handleRate('good') },
    { key: '4', handler: () => handleRate('easy') },
  ]);

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl font-bold text-zinc-100 mb-2">Session Complete</p>
        <p className="text-zinc-400">
          Reviewed {reviewed} cards — {correct}/{reviewed} correct
        </p>
      </div>
    );
  }

  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Card {currentIndex + 1} of {cards.length}
        </span>
        <span>
          {correct}/{reviewed} correct
        </span>
      </div>

      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <FlashcardCard
        front={currentCard.front}
        back={currentCard.back}
        isFlipped={isFlipped}
        onFlip={() => setIsFlipped((f) => !f)}
      />

      {isFlipped && (
        <div className="flex justify-center gap-3">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              onClick={() => handleRate(r.key)}
              className={`${r.color} text-white font-medium px-5 py-2.5 rounded-lg transition-colors`}
            >
              {r.label}
              <span className="ml-1.5 text-xs opacity-60">({r.shortcut})</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-zinc-600 text-xs">
        Space: flip — 1-4: rate
      </p>
    </div>
  );
}
