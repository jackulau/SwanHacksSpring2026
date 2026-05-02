import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  onTimeUpdate?: (time: number) => void;
}

export function AudioPlayer({ src, title, onTimeUpdate }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const handleMeta = () => setDuration(audio.duration);
    const handleEnd = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleMeta);
    audio.addEventListener('ended', handleEnd);
    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleMeta);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta));
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  }, []);

  const cycleSpeed = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(playbackRate);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [playbackRate]);

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 px-4 py-2 flex items-center gap-4 z-40">
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && <span className="text-sm text-zinc-400 truncate max-w-48">{title}</span>}

      <button onClick={() => skip(-10)} className="text-zinc-400 hover:text-zinc-200" aria-label="Skip back 10s">
        <SkipBack className="w-4 h-4" />
      </button>

      <button onClick={togglePlay} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-2" aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <button onClick={() => skip(10)} className="text-zinc-400 hover:text-zinc-200" aria-label="Skip forward 10s">
        <SkipForward className="w-4 h-4" />
      </button>

      <span className="text-xs text-zinc-500 w-10 text-right">{fmt(currentTime)}</span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={seek}
        className="flex-1 accent-indigo-500 h-1"
      />

      <span className="text-xs text-zinc-500 w-10">{fmt(duration)}</span>

      <button onClick={cycleSpeed} className="text-xs text-zinc-400 hover:text-zinc-200 font-mono w-10 text-center">
        {playbackRate}x
      </button>

      <Volume2 className="w-4 h-4 text-zinc-500" />
    </div>
  );
}
