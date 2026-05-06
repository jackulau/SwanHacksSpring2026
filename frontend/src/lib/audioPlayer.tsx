import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Mount <AudioPlayer/> from AppShell.

export interface AudioPlayerContextValue {
  src: string | null;
  title: string | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  /** Set when the audio element fires `error` (file missing, network down, etc). */
  error: string | null;
  setSrc: (src: string | null, title?: string) => void;
  seek: (time: number) => void;
  togglePlay: () => Promise<void>;
  setRate: (rate: number) => void;
  skip: (deltaSeconds: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const MIN_RATE = 0.5;
const MAX_RATE = 2;
const PLAYER_HEIGHT_PX = 56;

function clampRate(rate: number): number {
  if (Number.isNaN(rate)) return 1;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

function setPlayerHeightVar(active: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--audio-player-height",
    active ? `${PLAYER_HEIGHT_PX}px` : "0px",
  );
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [src, setSrcState] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Wire audio element events once the ref is attached.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleDurationChange = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(audio.currentTime);
    };
    const handlePlay = () => {
      setPlaying(true);
      setError(null);
    };
    const handlePause = () => setPlaying(false);
    const handleRateChange = () => setRateState(audio.playbackRate);
    const handleError = () => {
      setPlaying(false);
      // The audio element's MediaError doesn't carry a particularly useful
      // message — keep the user-facing copy generic but actionable.
      setError("Couldn't play this audio. The file may be missing or unsupported.");
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ratechange", handleRateChange);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ratechange", handleRateChange);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // Maintain CSS var so pages can reserve bottom padding.
  useEffect(() => {
    setPlayerHeightVar(src !== null);
    return () => setPlayerHeightVar(false);
  }, [src]);

  const setSrc = useCallback((nextSrc: string | null, nextTitle?: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (nextSrc === null) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setSrcState(null);
      setTitle(null);
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
      setError(null);
      return;
    }

    // Same source: just refresh title (preserve playback position/state).
    if (audio.src === nextSrc) {
      if (typeof nextTitle === "string") setTitle(nextTitle);
      setSrcState(nextSrc);
      return;
    }

    audio.pause();
    audio.src = nextSrc;
    audio.load();
    setSrcState(nextSrc);
    setTitle(nextTitle ?? null);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setError(null);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isNaN(time)) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : duration;
    const clamped = Math.max(0, Math.min(max || 0, time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        // Autoplay rejection or load error — pause event will reflect state.
      }
    } else {
      audio.pause();
    }
  }, []);

  const setRate = useCallback((nextRate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = clampRate(nextRate);
    audio.playbackRate = clamped;
    setRateState(clamped);
  }, []);

  const skip = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + deltaSeconds);
  }, [seek]);

  const value: AudioPlayerContextValue = {
    src,
    title,
    currentTime,
    duration,
    playing,
    rate,
    error,
    setSrc,
    seek,
    togglePlay,
    setRate,
    skip,
  };

  return (
    <AudioPlayerContext value={value}>
      <audio ref={audioRef} preload="metadata" style={{ display: "none" }} />
      {children}
    </AudioPlayerContext>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer must be used inside AudioPlayerProvider");
  }
  return ctx;
}
