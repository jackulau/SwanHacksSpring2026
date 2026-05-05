import { motion, useReducedMotion } from 'framer-motion';

interface FlashcardCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
}

/**
 * The flashcard itself — the only element in the suite allowed `rounded-lg`
 * and a subtle shadow, since it carries the physical card metaphor. Big type,
 * generous whitespace, no decorative chrome.
 */
export function FlashcardCard({ front, back, isFlipped, onFlip }: FlashcardCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className="relative w-full perspective-1000"
      style={{ minHeight: 360 }}
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onFlip();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={
        isFlipped
          ? 'Showing answer. Press space to show question.'
          : 'Showing question. Press space to show answer.'
      }
    >
      <motion.div
        className="relative w-full"
        style={{ minHeight: 360, transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="absolute inset-0 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-12 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-3xl sm:text-4xl text-[var(--color-text)] text-center leading-snug font-medium tracking-tight">
            {front}
          </p>
        </div>

        <div
          className="absolute inset-0 bg-[var(--color-surface-raised)] border border-[var(--color-primary)]/40 rounded-lg p-12 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-3xl sm:text-4xl text-[var(--color-text)] text-center leading-snug font-medium tracking-tight">
            {back}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
