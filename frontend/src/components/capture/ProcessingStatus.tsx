import { Loader2, CheckCircle2, XCircle, FileText, BookOpen, Brain, HelpCircle } from 'lucide-react';

type Stage = 'transcribing' | 'cleaning' | 'notes' | 'flashcards' | 'quiz' | 'done' | 'error';

interface ProcessingStatusProps {
  currentStage: Stage;
  error?: string;
}

const stages: { key: Stage; label: string; icon: typeof FileText }[] = [
  { key: 'transcribing', label: 'Transcribing audio', icon: FileText },
  { key: 'cleaning', label: 'Cleaning transcript', icon: FileText },
  { key: 'notes', label: 'Generating notes', icon: BookOpen },
  { key: 'flashcards', label: 'Creating flashcards', icon: Brain },
  { key: 'quiz', label: 'Building quiz', icon: HelpCircle },
];

export function ProcessingStatus({ currentStage, error }: ProcessingStatusProps) {
  const currentIdx = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Processing lecture</h3>

      <div className="space-y-3">
        {stages.map((stage, idx) => {
          let status: 'done' | 'active' | 'pending' | 'error' = 'pending';

          if (currentStage === 'error' && idx === currentIdx) {
            status = 'error';
          } else if (currentStage === 'done' || idx < currentIdx) {
            status = 'done';
          } else if (idx === currentIdx) {
            status = 'active';
          }

          return (
            <div key={stage.key} className="flex items-center gap-3">
              {status === 'done' && (
                <CheckCircle2 className="w-5 h-5 text-[var(--color-primary-strong)] shrink-0" />
              )}
              {status === 'active' && (
                <Loader2 className="w-5 h-5 text-[var(--color-primary-strong)] animate-spin shrink-0" />
              )}
              {status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-[var(--color-border-strong)] shrink-0" />
              )}
              {status === 'error' && (
                <XCircle className="w-5 h-5 text-[var(--color-record)] shrink-0" />
              )}
              <span
                className={
                  status === 'done'
                    ? 'text-[var(--color-text-muted)]'
                    : status === 'active'
                      ? 'text-white font-medium'
                      : status === 'error'
                        ? 'text-[var(--color-record)]'
                        : 'text-[var(--color-text-subtle)]'
                }
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-[var(--color-record)]/10 border border-[var(--color-record)]/40 rounded-xl p-3 text-[var(--color-record)] text-sm">
          {error}
        </div>
      )}

      {currentStage === 'done' && (
        <div className="bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/40 rounded-xl p-3 text-[var(--color-primary-strong)] text-sm">
          Processing complete. Your notes, flashcards, and quiz are ready.
        </div>
      )}
    </div>
  );
}
