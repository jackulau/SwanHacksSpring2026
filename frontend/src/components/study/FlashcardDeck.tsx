import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const RATINGS: { key: QualityRating; label: string; shortcut: string }[] = [
  { key: 'again', label: 'Again', shortcut: '1' },
  { key: 'hard', label: 'Hard', shortcut: '2' },
  { key: 'good', label: 'Good', shortcut: '3' },
  { key: 'easy', label: 'Easy', shortcut: '4' },
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

  useEffect(() => {
    if (cards.length === 0) return;
    if (sessionIdRef.current) return;

    let cancelled = false;
    start({ session_type: 'flashcard_review', lecture: lectureId })
      .then((id) => {
        if (cancelled) return;
        sessionIdRef.current = id;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [cards.length, lectureId, start]);

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

  const goPrev = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
  }, [cards.length]);

  useKeyboardShortcuts([
    { key: ' ', handler: () => setIsFlipped((f) => !f) },
    { key: 'ArrowLeft', handler: goPrev },
    { key: 'ArrowRight', handler: goNext },
    { key: '1', handler: () => handleRate('again') },
    { key: '2', handler: () => handleRate('hard') },
    { key: '3', handler: () => handleRate('good') },
    { key: '4', handler: () => handleRate('easy') },
  ]);

  if (!currentCard) {
    return (
      <div className="text-center py-24">
        <p className="text-3xl font-semibold text-[var(--color-text)] tracking-tight mb-2">
          Session complete
        </p>
        <p className="text-[var(--color-text-muted)] tabular-nums">
          {correct} of {reviewed} correct
        </p>
      </div>
    );
  }

  const progress = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 220px)' }}>
      {/* Progress strip — top of frame */}
      <div className="space-y-2">
        <div
          className="w-full h-1 bg-[var(--color-border)] rounded-md overflow-hidden"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={cards.length}
          aria-label={`Card ${currentIndex + 1} of ${cards.length}`}
        >
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-subtle)] tabular-nums">
          <span>
            {currentIndex + 1} / {cards.length}
          </span>
          <span>
            {correct}/{reviewed} correct
          </span>
        </div>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-2xl">
          <FlashcardCard
            front={currentCard.front}
            back={currentCard.back}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((f) => !f)}
          />
        </div>
      </div>

      {/* Footer controls */}
      <div className="space-y-4">
        {isFlipped ? (
          <div className="flex justify-center gap-2 flex-wrap">
            {RATINGS.map((r) => (
              <button
                key={r.key}
                onClick={() => handleRate(r.key)}
                className={`h-10 px-4 rounded-md text-sm font-medium transition-colors ${
                  r.key === 'good'
                    ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white'
                    : 'border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] bg-transparent'
                }`}
              >
                {r.label}
                <span className="ml-2 text-[11px] opacity-60">{r.shortcut}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="h-10 px-3 rounded-md text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="Previous card"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Prev
            </button>
            <button
              onClick={() => setIsFlipped(true)}
              className="h-10 px-6 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
            >
              Flip
              <span className="ml-2 text-[11px] opacity-70">Space</span>
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === cards.length - 1}
              className="h-10 px-3 rounded-md text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="Next card"
            >
              Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-[var(--color-text-subtle)]">
          Space to flip · 1–4 to rate · ←/→ to navigate
        </p>
      </div>
    </div>
  );
}
