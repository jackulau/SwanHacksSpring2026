import { useState, useRef, useCallback, useEffect } from 'react';

type PomodoroPhase = 'work' | 'break' | 'idle';

interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  onPhaseChange?: (phase: PomodoroPhase) => void;
}

const DEFAULT_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

// Tick cadence for the worker. The displayed countdown is derived from a
// wall-clock `endsAt`, so this only controls how often we re-render — fast
// enough to feel live, slow enough to not flood the message channel.
const TICK_INTERVAL_MS = 250;

interface PomodoroInternalState {
  phase: PomodoroPhase;
  // Wall-clock timestamp at which the current phase ends. Null when not running.
  endsAt: number | null;
  // Remaining ms when paused/idle — restored into endsAt on the next start.
  pausedRemainingMs: number;
  totalSessions: number;
  currentSession: number;
  isRunning: boolean;
}

export function usePomodoro(config: Partial<PomodoroConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const [state, setState] = useState<PomodoroInternalState>(() => ({
    phase: 'idle',
    endsAt: null,
    pausedRemainingMs: cfg.workMinutes * 60_000,
    totalSessions: 0,
    currentSession: 0,
    isRunning: false,
  }));

  // Drives re-renders so the displayed countdown updates each worker tick.
  const [now, setNow] = useState(() => Date.now());

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/timerWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ type: 'tick' }>) => {
      if (e.data.type === 'tick') setNow(Date.now());
    };
    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Start/stop the worker tick stream when the running flag flips.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (state.isRunning) {
      worker.postMessage({ type: 'start', interval: TICK_INTERVAL_MS });
    } else {
      worker.postMessage({ type: 'stop' });
    }
  }, [state.isRunning]);

  // Snap to the right value the moment the tab becomes visible — cheap
  // belt-and-suspenders alongside the worker, also handles wake-from-sleep.
  useEffect(() => {
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Phase transitions: when the running endsAt is reached, advance.
  useEffect(() => {
    if (!state.isRunning || state.endsAt == null) return;
    if (now < state.endsAt) return;

    setState((s) => {
      if (!s.isRunning || s.endsAt == null) return s;
      if (Date.now() < s.endsAt) return s;
      const c = cfgRef.current;
      if (s.phase === 'work') {
        const newSession = s.currentSession + 1;
        const isLongBreak = newSession % c.sessionsBeforeLongBreak === 0;
        const breakMs =
          (isLongBreak ? c.longBreakMinutes : c.breakMinutes) * 60_000;
        c.onPhaseChange?.('break');
        return {
          ...s,
          phase: 'break',
          endsAt: Date.now() + breakMs,
          pausedRemainingMs: breakMs,
          totalSessions: s.totalSessions + 1,
          currentSession: newSession,
        };
      }
      const workMs = c.workMinutes * 60_000;
      c.onPhaseChange?.('work');
      return {
        ...s,
        phase: 'work',
        endsAt: Date.now() + workMs,
        pausedRemainingMs: workMs,
      };
    });
  }, [now, state.isRunning, state.endsAt]);

  const start = useCallback(() => {
    setState((s) => {
      const c = cfgRef.current;
      const startingPhase = s.phase === 'idle' ? 'work' : s.phase;
      const remainingMs =
        s.phase === 'idle' ? c.workMinutes * 60_000 : s.pausedRemainingMs;
      return {
        ...s,
        phase: startingPhase,
        endsAt: Date.now() + remainingMs,
        pausedRemainingMs: remainingMs,
        isRunning: true,
      };
    });
  }, []);

  const pause = useCallback(() => {
    setState((s) => {
      if (!s.isRunning || s.endsAt == null) {
        return { ...s, isRunning: false };
      }
      const remainingMs = Math.max(0, s.endsAt - Date.now());
      return {
        ...s,
        isRunning: false,
        endsAt: null,
        pausedRemainingMs: remainingMs,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      endsAt: null,
      pausedRemainingMs: cfgRef.current.workMinutes * 60_000,
      totalSessions: 0,
      currentSession: 0,
      isRunning: false,
    });
  }, []);

  const skip = useCallback(() => {
    setState((s) => {
      if (s.phase === 'idle') return s;
      const c = cfgRef.current;
      if (s.phase === 'work') {
        const newSession = s.currentSession + 1;
        const isLongBreak = newSession % c.sessionsBeforeLongBreak === 0;
        const breakMs =
          (isLongBreak ? c.longBreakMinutes : c.breakMinutes) * 60_000;
        c.onPhaseChange?.('break');
        return {
          ...s,
          phase: 'break',
          endsAt: s.isRunning ? Date.now() + breakMs : null,
          pausedRemainingMs: breakMs,
          totalSessions: s.totalSessions + 1,
          currentSession: newSession,
        };
      }
      const workMs = c.workMinutes * 60_000;
      c.onPhaseChange?.('work');
      return {
        ...s,
        phase: 'work',
        endsAt: s.isRunning ? Date.now() + workMs : null,
        pausedRemainingMs: workMs,
      };
    });
  }, []);

  const remainingMs =
    state.isRunning && state.endsAt != null
      ? Math.max(0, state.endsAt - now)
      : state.pausedRemainingMs;
  const timeRemaining = Math.ceil(remainingMs / 1000);

  return {
    phase: state.phase,
    timeRemaining,
    totalSessions: state.totalSessions,
    currentSession: state.currentSession,
    isRunning: state.isRunning,
    start,
    pause,
    reset,
    skip,
  };
}
