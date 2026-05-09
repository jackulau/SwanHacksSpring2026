import { motion } from 'framer-motion';

interface FlashcardCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlashcardCard({ front, back, isFlipped, onFlip }: FlashcardCardProps) {
  return (
    <div
      className="relative w-full max-w-lg mx-auto cursor-pointer perspective-1000"
      style={{ minHeight: 280 }}
      onClick={onFlip}
      onKeyDown={(e) => e.key === ' ' && onFlip()}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? 'Showing answer. Click to show question.' : 'Showing question. Click to show answer.'}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ minHeight: 280, transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      >
        <div
          className="absolute inset-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col items-center justify-center backface-hidden soft-shadow"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-sm text-[var(--color-text-subtle)] mb-4 uppercase tracking-wider">Question</p>
          <p className="text-xl text-white text-center leading-relaxed">{front}</p>
          <p className="text-sm text-[var(--color-text-subtle)] mt-6">Click or press Space to flip</p>
        </div>

        <div
          className="absolute inset-0 bg-[var(--color-surface)] border border-[var(--color-primary)]/50 rounded-2xl p-8 flex flex-col items-center justify-center soft-shadow"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-sm text-[var(--color-primary-strong)] mb-4 uppercase tracking-wider">Answer</p>
          <p className="text-xl text-white text-center leading-relaxed">{back}</p>
        </div>
      </motion.div>
    </div>
  );
}
