import { Sparkles } from "lucide-react";

interface AIChipProps {
  /** Optional override for the hover tooltip. Falls back to a sensible default. */
  title?: string;
  className?: string;
}

/**
 * Tiny "AI" pill rendered next to artifacts that were produced by the LLM
 * pipeline (notes/flashcards/quizzes where source/content_type is
 * 'auto_generated'). Purely decorative — does not change any logic — so
 * it's safe to sprinkle anywhere a piece of content is presented.
 */
export function AIChip({ title = "Generated from this lecture. Edit to override.", className = "" }: AIChipProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-primary-strong)] ${className}`}
    >
      <Sparkles className="w-3 h-3" aria-hidden="true" />
      AI
    </span>
  );
}
