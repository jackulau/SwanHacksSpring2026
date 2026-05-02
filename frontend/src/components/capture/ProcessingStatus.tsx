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
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-zinc-100">Processing Lecture</h3>

      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
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
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              )}
              {status === 'active' && (
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
              )}
              {status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-zinc-600 shrink-0" />
              )}
              {status === 'error' && (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <span
                className={
                  status === 'done'
                    ? 'text-zinc-400'
                    : status === 'active'
                      ? 'text-zinc-100 font-medium'
                      : status === 'error'
                        ? 'text-red-400'
                        : 'text-zinc-600'
                }
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {currentStage === 'done' && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-green-300 text-sm">
          Processing complete. Your notes, flashcards, and quiz are ready.
        </div>
      )}
    </div>
  );
}
