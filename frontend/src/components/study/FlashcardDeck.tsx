import { useState, useCallback, useEffect, useRef } from 'react';
import { FlashcardCard } from './FlashcardCard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useStudySession } from '../../hooks/useStudySession';
import type { Flashcard } from '../../lib/types';
import type { QualityRating } from '../../lib/sm2';

interface FlashcardDeckProps {
  cards: Flashcard[];
  onRate: (card: Flashcard, rating: QualityRating) => void;
  onComplete: () => void;
  lectureId?: string;
}

const RATINGS: { key: QualityRating; label: string; color: string; shortcut: string }[] = [
  { key: 'again', label: 'Again', color: 'bg-[var(--color-record)] hover:bg-red-500 text-white', shortcut: '1' },
  { key: 'hard', label: 'Hard', color: 'bg-orange-600 hover:bg-orange-500 text-white', shortcut: '2' },
  { key: 'good', label: 'Good', color: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black', shortcut: '3' },
  { key: 'easy', label: 'Easy', color: 'bg-[var(--color-primary-strong)] hover:bg-[var(--color-primary-hover)] text-black', shortcut: '4' },
];

export function FlashcardDeck({ cards, onRate, onComplete, lectureId }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);

  const currentCard = cards[currentIndex];

  const { start, update, finish } = useStudySession();
  const sessionIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const sessionStateRef = useRef({ reviewed: 0, correct: 0 });

  // Start a session as soon as the deck has cards to show.
  useEffect(() => {
    if (cards.length === 0) return;
    if (sessionIdRef.current) return;

    let cancelled = false;
    start({ session_type: 'flashcard_review', lecture: lectureId })
      .then((id) => {
        if (cancelled) return;
        sessionIdRef.current = id;
      })
      .catch(() => {
        // start() failure already logged inside the hook; sessions are best-effort.
      });

    return () => {
      cancelled = true;
    };
  }, [cards.length, lectureId, start]);

  // Finish the session on unmount if not already done.
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (!id || finishedRef.current) return;
      finishedRef.current = true;
      const { reviewed: r, correct: c } = sessionStateRef.current;
      void finish(id, { cards_reviewed: r, cards_correct: c });
    };
  }, [finish]);

  const handleRate = useCallback(
    (rating: QualityRating) => {
      if (!currentCard || !isFlipped) return;
      onRate(currentCard, rating);

      const nextReviewed = sessionStateRef.current.reviewed + 1;
      const nextCorrect =
        rating !== 'again'
          ? sessionStateRef.current.correct + 1
          : sessionStateRef.current.correct;
      sessionStateRef.current = { reviewed: nextReviewed, correct: nextCorrect };

      setReviewed(nextReviewed);
      if (rating !== 'again') setCorrect(nextCorrect);
      setIsFlipped(false);

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        update(sessionId, {
          cards_reviewed: nextReviewed,
          cards_correct: nextCorrect,
        });
      }

      if (currentIndex + 1 >= cards.length) {
        if (sessionId && !finishedRef.current) {
          finishedRef.current = true;
          void finish(sessionId, {
            cards_reviewed: nextReviewed,
            cards_correct: nextCorrect,
          });
        }
        onComplete();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentCard, isFlipped, currentIndex, cards.length, onRate, onComplete, update, finish],
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
        <p className="text-2xl font-bold text-white mb-2">Session Complete</p>
        <p className="text-[var(--color-text-muted)]">
          Reviewed {reviewed} cards — {correct}/{reviewed} correct
        </p>
      </div>
    );
  }

  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <span>
          Card {currentIndex + 1} of {cards.length}
        </span>
        <span>
          {correct}/{reviewed} correct
        </span>
      </div>

      <div className="w-full h-1.5 bg-[var(--color-input)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] transition-all duration-300"
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
        <div className="flex justify-center gap-3 flex-wrap">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              onClick={() => handleRate(r.key)}
              className={`${r.color} font-semibold px-5 py-2.5 rounded-full transition-colors`}
            >
              {r.label}
              <span className="ml-1.5 text-xs opacity-60">({r.shortcut})</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[var(--color-text-subtle)] text-xs">
        Space: flip — 1-4: rate
      </p>
    </div>
  );
}
