import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
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
    seek,
    togglePlay,
    setRate,
    skip,
  } = useAudioPlayer();

  const active = src !== null;

  useKeyboardShortcuts(
    [
      { key: " ", handler: () => { void togglePlay(); } },
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
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 sm:gap-4 border-t border-zinc-700 bg-zinc-900 px-3 sm:px-4 py-2"
      style={{ height: "var(--audio-player-height, 56px)" }}
    >
      {title && (
        <span className="hidden sm:inline truncate max-w-48 text-sm text-zinc-400">
          {title}
        </span>
      )}

      <button
        type="button"
        onClick={() => skip(-10)}
        className="hidden sm:inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
        aria-label="Skip back 10 seconds"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => { void togglePlay(); }}
        className="rounded-full bg-[var(--color-primary)] p-2 text-black hover:bg-[var(--color-primary-hover)]"
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => skip(10)}
        className="hidden sm:inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
        aria-label="Skip forward 10 seconds"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      <span className="hidden sm:inline w-10 text-right text-xs text-zinc-500 tabular-nums">
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

      <span className="hidden sm:inline w-10 text-xs text-zinc-500 tabular-nums">
        {formatTime(duration)}
      </span>

      <label className="hidden sm:inline-flex items-center gap-1">
        <span className="sr-only">Playback speed</span>
        <select
          value={rate}
          onChange={handleRateChange}
          className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-300 hover:border-zinc-500"
          aria-label="Playback speed"
        >
          {SPEED_OPTIONS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}×
            </option>
          ))}
        </select>
      </label>

      <Volume2 className="hidden sm:inline w-4 h-4 text-zinc-500" aria-hidden="true" />
    </div>
  );
}
