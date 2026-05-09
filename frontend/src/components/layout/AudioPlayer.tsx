import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useAudioPlayer } from "../../lib/audioPlayer";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer() {
  const {
    src,
    title,
    currentTime,
    duration,
    playing,
    rate,
    error,
    seek,
    togglePlay,
    setRate,
    setSrc,
    skip,
  } = useAudioPlayer();

  const active = src !== null;

  // Note: Space is intentionally NOT bound here. Multiple pages bind Space
  // (capture → record toggle, flashcard deck → flip card). Letting the
  // global audio player also claim Space would double-fire on those pages.
  // Use 'k' for play/pause — same convention as YouTube and most players.
  useKeyboardShortcuts(
    [
      { key: "k", handler: () => { void togglePlay(); } },
      { key: "j", handler: () => skip(-10) },
      { key: "l", handler: () => skip(10) },
    ],
    active,
  );

  if (!active) return null;

  const handleScrub = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (!Number.isNaN(next)) seek(next);
  };

  const handleRateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number(event.target.value);
    if (!Number.isNaN(next)) setRate(next);
  };

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 sm:gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 sm:px-4 py-2 shadow-lg"
      style={{ height: "var(--audio-player-height, 56px)" }}
    >
      {title && (
        <span
          className="truncate text-xs sm:text-sm text-[var(--color-text-muted)] max-w-[40%] sm:max-w-48"
          title={title}
        >
          {title}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="truncate text-xs text-[var(--color-record)] max-w-[60%] sm:max-w-72"
        >
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={() => skip(-10)}
        className="hidden sm:inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        aria-label="Skip back 10 seconds"
      >
        <SkipBack className="w-4 h-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => { void togglePlay(); }}
        className="rounded-full bg-[var(--color-primary)] p-2 text-white hover:bg-[var(--color-primary-hover)]"
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
      >
        {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={() => skip(10)}
        className="hidden sm:inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        aria-label="Skip forward 10 seconds"
      >
        <SkipForward className="w-4 h-4" aria-hidden="true" />
      </button>

      <span className="hidden sm:inline w-10 text-right text-xs text-[var(--color-text-subtle)] tabular-nums">
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={handleScrub}
        className="flex-1 h-1 accent-[var(--color-primary)]"
        aria-label="Seek"
      />

      <span className="hidden sm:inline w-10 text-xs text-[var(--color-text-subtle)] tabular-nums">
        {formatTime(duration)}
      </span>

      <label className="hidden sm:inline-flex items-center gap-1">
        <span className="sr-only">Playback speed</span>
        <select
          value={rate}
          onChange={handleRateChange}
          className="rounded border border-[var(--color-border)] bg-[var(--color-input)] px-1 py-0.5 font-mono text-xs text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
          aria-label="Playback speed"
        >
          {SPEED_OPTIONS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}×
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => setSrc(null)}
        className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label="Close audio player"
        title="Close audio player"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
