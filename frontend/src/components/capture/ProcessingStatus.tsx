import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type Stage = 'transcribing' | 'cleaning' | 'notes' | 'flashcards' | 'quiz' | 'done' | 'error';

interface ProcessingStatusProps {
  currentStage: Stage;
  error?: string;
}

const STAGES: { key: Stage; label: string }[] = [
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'cleaning', label: 'Cleaning transcript' },
  { key: 'notes', label: 'Generating notes' },
  { key: 'flashcards', label: 'Creating flashcards' },
  { key: 'quiz', label: 'Building quiz' },
];

/**
 * Inline, single-row progress indicator.
 *
 * Replaces the previous step-list card. We show a thin determinate progress
 * bar plus the current stage label and any final-state message — total height
 * stays under ~80px so it never competes with the recording surface.
 */
export function ProcessingStatus({ currentStage, error }: ProcessingStatusProps) {
  const idx = STAGES.findIndex((s) => s.key === currentStage);
  const isError = currentStage === 'error';
  const isDone = currentStage === 'done';
  const total = STAGES.length;

  // Progress: 0..1 — done = 1, otherwise (idx+1)/total once active.
  const progress = isDone ? 1 : isError ? Math.max(idx, 0) / total : (idx + 1) / total;

  const activeLabel = isDone
    ? 'Processing complete'
    : isError
      ? 'Processing failed'
      : STAGES[idx]?.label ?? 'Working';

  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-[var(--color-text)] font-medium">
          {isDone && (
            <CheckCircle2
              className="w-4 h-4 text-[var(--color-primary-strong)]"
              aria-hidden="true"
            />
          )}
          {isError && (
            <XCircle className="w-4 h-4 text-[var(--color-record)]" aria-hidden="true" />
          )}
          {!isDone && !isError && (
            <Loader2
              className="w-4 h-4 text-[var(--color-primary-strong)] animate-spin"
              aria-hidden="true"
            />
          )}
          <span>{activeLabel}</span>
        </span>
        {!isDone && !isError && (
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {Math.max(idx + 1, 1)} / {total}
          </span>
        )}
      </div>

      <div
        className="h-1 w-full bg-[var(--color-input)] overflow-hidden rounded-sm"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className={`h-full transition-all duration-500 ${
            isError ? 'bg-[var(--color-record)]' : 'bg-[var(--color-primary)]'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {error && (
        <p className="text-xs text-[var(--color-record)]">{error}</p>
      )}
      {isDone && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Notes, flashcards, and quiz are ready.
        </p>
      )}
    </div>
  );
}
