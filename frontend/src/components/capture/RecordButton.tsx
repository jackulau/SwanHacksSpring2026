import { Mic, Square, Pause, Play } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

/**
 * Voice-Memos / QuickTime-style circular record button.
 *
 * The button itself is functionally circular — that's a deliberate exception
 * to the project's "no big radii" rule, since a circle is the universal
 * affordance for record. Auxiliary controls (pause/resume) sit inline with
 * standard `rounded-md` to match the rest of the app.
 */
export function RecordButton({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordButtonProps) {
  if (!isRecording) {
    return (
      <button
        type="button"
        onClick={onStart}
        aria-pressed={false}
        aria-label="Start recording"
        className="group relative h-24 w-24 rounded-full bg-[var(--color-record)] outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg)] focus-visible:ring-[var(--color-record)] transition-transform active:scale-95"
      >
        <span className="absolute inset-0 rounded-full bg-[var(--color-record)] opacity-30 group-hover:opacity-50 transition-opacity" />
        <span className="relative flex items-center justify-center h-full w-full">
          <Mic className="w-8 h-8 text-white" aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={isPaused ? onResume : onPause}
        aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        className="h-12 px-4 rounded-md border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-white inline-flex items-center gap-2 text-sm font-medium transition-colors"
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        <span>{isPaused ? 'Resume' : 'Pause'}</span>
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-pressed={true}
        aria-label="Stop recording"
        className="group relative h-24 w-24 rounded-full bg-[var(--color-record)] outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg)] focus-visible:ring-[var(--color-record)] transition-transform active:scale-95"
      >
        <span className="absolute inset-0 rounded-full bg-[var(--color-record)] opacity-40 animate-pulse" />
        <span className="relative flex items-center justify-center h-full w-full">
          <Square className="w-7 h-7 text-white fill-white" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
