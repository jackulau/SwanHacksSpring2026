import { Mic, Square, Pause, Play } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

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
        onClick={onStart}
        className="flex items-center gap-2 bg-[var(--color-record)] hover:opacity-90 text-black font-semibold px-6 py-3 rounded-full transition-colors"
        aria-label="Start recording"
      >
        <Mic className="w-5 h-5" />
        Start recording
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={isPaused ? onResume : onPause}
        className="flex items-center gap-2 bg-black border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-white px-4 py-3 rounded-full transition-colors"
        aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
      >
        {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
      </button>
      <button
        onClick={onStop}
        className="flex items-center gap-2 bg-[var(--color-record)] hover:opacity-90 text-black font-semibold px-6 py-3 rounded-full transition-colors"
        aria-label="Stop recording"
      >
        <Square className="w-4 h-4" />
        Stop
      </button>
    </div>
  );
}
