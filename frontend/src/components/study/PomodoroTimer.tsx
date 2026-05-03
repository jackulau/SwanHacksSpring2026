import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { usePomodoro } from '../../hooks/usePomodoro';
import { useStudySession } from '../../hooks/useStudySession';

interface PomodoroTimerProps {
  workMinutes?: number;
}

export function PomodoroTimer({ workMinutes = 25 }: PomodoroTimerProps) {
  const timer = usePomodoro({ workMinutes });
  const { start, finish } = useStudySession();

  // Track the active session id and the last completed-session count so we
  // only commit a record when a work phase actually finishes (not on pause
  // or reset).
  const sessionIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(timer.phase);
  const prevTotalRef = useRef(timer.totalSessions);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const currentPhase = timer.phase;

    // Detect a fresh work phase entry: idle → work OR break → work.
    if (currentPhase === 'work' && prevPhase !== 'work' && !sessionIdRef.current) {
      let cancelled = false;
      start({ session_type: 'pomodoro' })
        .then((id) => {
          if (cancelled) return;
          sessionIdRef.current = id;
        })
        .catch(() => {
          // Best-effort: errors logged inside hook.
        });

      // Capture the cancellation flag in a closure variable that survives
      // until the next effect run via prevPhaseRef update below.
      prevPhaseRef.current = currentPhase;
      prevTotalRef.current = timer.totalSessions;
      return () => {
        cancelled = true;
      };
    }

    // Detect successful completion: totalSessions increments while phase
    // transitions out of work. This indicates a full work cycle finished
    // (NOT a manual reset, NOT a pause).
    if (
      timer.totalSessions > prevTotalRef.current &&
      prevPhase === 'work' &&
      currentPhase !== 'work'
    ) {
      const id = sessionIdRef.current;
      if (id) {
        sessionIdRef.current = null;
        void finish(id);
      }
    }

    // Detect reset: phase returns to idle. Discard any in-flight session
    // without writing a completion (the row was created at start; we leave
    // it as a partial without ended_at, mirroring the abandon-tab case).
    if (currentPhase === 'idle' && prevPhase !== 'idle') {
      sessionIdRef.current = null;
    }

    prevPhaseRef.current = currentPhase;
    prevTotalRef.current = timer.totalSessions;
  }, [timer.phase, timer.totalSessions, start, finish]);

  // On unmount, finalize an in-flight session so partial work isn't lost.
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (!id) return;
      sessionIdRef.current = null;
      void finish(id);
    };
  }, [finish]);

  const mins = Math.floor(timer.timeRemaining / 60);
  const secs = timer.timeRemaining % 60;

  const phaseColors = {
    idle: 'text-[var(--color-text-muted)]',
    work: 'text-[var(--color-primary-strong)]',
    break: 'text-emerald-400',
  };

  const phaseLabels = {
    idle: 'Ready',
    work: 'Focus Time',
    break: 'Break',
  };

  const progress = timer.phase === 'idle'
    ? 0
    : timer.phase === 'work'
      ? 1 - timer.timeRemaining / (workMinutes * 60)
      : 1 - timer.timeRemaining / (5 * 60);

  return (
    <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl p-6 text-center">
      <p className={`text-sm font-medium mb-2 ${phaseColors[timer.phase]}`}>
        {phaseLabels[timer.phase]}
      </p>

      <p className="text-5xl font-mono font-bold text-white mb-4">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>

      <div className="w-full h-1.5 bg-[var(--color-input)] rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-1000 ${
            timer.phase === 'break' ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black rounded-full p-3 transition-colors"
          aria-label={timer.isRunning ? 'Pause' : 'Start'}
        >
          {timer.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={timer.reset}
          className="bg-black border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-white rounded-full p-3 transition-colors"
          aria-label="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={timer.skip}
          className="bg-black border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-white rounded-full p-3 transition-colors"
          aria-label="Skip phase"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-subtle)] mt-3">
        Session {timer.currentSession + 1} · {timer.totalSessions} completed
      </p>
    </div>
  );
}
