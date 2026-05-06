import { useState, useRef, useCallback, useEffect } from 'react';

type PomodoroPhase = 'work' | 'break' | 'idle';

interface PomodoroState {
  phase: PomodoroPhase;
  timeRemaining: number;
  totalSessions: number;
  currentSession: number;
  isRunning: boolean;
}

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

export function usePomodoro(config: Partial<PomodoroConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<PomodoroState>({
    phase: 'idle',
    timeRemaining: cfg.workMinutes * 60,
    totalSessions: 0,
    currentSession: 0,
    isRunning: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const tick = useCallback(() => {
    setState((s) => {
      if (s.timeRemaining <= 1) {
        cfg.onPhaseChange?.(s.phase === 'work' ? 'break' : 'work');

        if (s.phase === 'work') {
          const newSession = s.currentSession + 1;
          const isLongBreak = newSession % cfg.sessionsBeforeLongBreak === 0;
          return {
            ...s,
            phase: 'break',
            timeRemaining: (isLongBreak ? cfg.longBreakMinutes : cfg.breakMinutes) * 60,
            totalSessions: s.totalSessions + 1,
            currentSession: newSession,
          };
        }
        return {
          ...s,
          phase: 'work',
          timeRemaining: cfg.workMinutes * 60,
        };
      }
      return { ...s, timeRemaining: s.timeRemaining - 1 };
    });
  }, [cfg]);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [state.isRunning, tick]);

  const start = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: s.phase === 'idle' ? 'work' : s.phase,
      isRunning: true,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setState({
      phase: 'idle',
      timeRemaining: cfg.workMinutes * 60,
      totalSessions: 0,
      currentSession: 0,
      isRunning: false,
    });
  }, [cfg.workMinutes]);

  const skip = useCallback(() => {
    // Immediately transition to the next phase regardless of running state.
    // The previous implementation only set timeRemaining=0, which left a paused
    // timer stuck at "0:00" until the user pressed Resume.
    setState((s) => {
      if (s.phase === 'idle') return s;
      cfg.onPhaseChange?.(s.phase === 'work' ? 'break' : 'work');
      if (s.phase === 'work') {
        const newSession = s.currentSession + 1;
        const isLongBreak = newSession % cfg.sessionsBeforeLongBreak === 0;
        return {
          ...s,
          phase: 'break',
          timeRemaining: (isLongBreak ? cfg.longBreakMinutes : cfg.breakMinutes) * 60,
          totalSessions: s.totalSessions + 1,
          currentSession: newSession,
        };
      }
      return {
        ...s,
        phase: 'work',
        timeRemaining: cfg.workMinutes * 60,
      };
    });
  }, [cfg]);

  return { ...state, start, pause, reset, skip };
}
