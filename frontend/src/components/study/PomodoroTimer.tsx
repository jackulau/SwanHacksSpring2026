import { useEffect, useRef } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePomodoro } from '../../hooks/usePomodoro';
import { useStudySession } from '../../hooks/useStudySession';

interface PomodoroTimerProps {
  workMinutes?: number;
  breakMinutes?: number;
  /** Render compactly (used in the study hub launcher). */
  compact?: boolean;
  /** Auto-start on mount — used so a sidebar/hub link can start a session in one click. */
  autoStart?: boolean;
}

// SVG ring geometry. Kept as constants so the dasharray math is honest.
const RING_RADIUS = 88;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

export function PomodoroTimer({
  workMinutes = 25,
  breakMinutes = 5,
  compact = false,
  autoStart = false,
}: PomodoroTimerProps) {
  const timer = usePomodoro({ workMinutes, breakMinutes });
  const { start: startSession, finish: finishSession } = useStudySession();

  const sessionIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(timer.phase);
  const prevTotalRef = useRef(timer.totalSessions);
  const announceRef = useRef(timer.phase);

  // Auto-start once on mount (≤2 click depth from the hub).
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      timer.start();
    }
  }, [autoStart, timer]);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const currentPhase = timer.phase;

    if (currentPhase === 'work' && prevPhase !== 'work' && !sessionIdRef.current) {
      let cancelled = false;
      startSession({ session_type: 'pomodoro' })
        .then((id) => {
          if (cancelled) return;
          sessionIdRef.current = id;
        })
        .catch(() => {});
      prevPhaseRef.current = currentPhase;
      prevTotalRef.current = timer.totalSessions;
      return () => {
        cancelled = true;
      };
    }

    if (
      timer.totalSessions > prevTotalRef.current &&
      prevPhase === 'work' &&
      currentPhase !== 'work'
    ) {
      const id = sessionIdRef.current;
      if (id) {
        sessionIdRef.current = null;
        void finishSession(id);
      }
    }

    if (currentPhase === 'idle' && prevPhase !== 'idle') {
      sessionIdRef.current = null;
    }

    prevPhaseRef.current = currentPhase;
    prevTotalRef.current = timer.totalSessions;
  }, [timer.phase, timer.totalSessions, startSession, finishSession]);

  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (!id) return;
      sessionIdRef.current = null;
      void finishSession(id);
    };
  }, [finishSession]);

  // Track phase transitions for the aria-live announcer.
  useEffect(() => {
    announceRef.current = timer.phase;
  }, [timer.phase]);

  const mins = Math.floor(timer.timeRemaining / 60);
  const secs = timer.timeRemaining % 60;
  const timeLabel = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const totalSecsForPhase =
    timer.phase === 'break' ? breakMinutes * 60 : workMinutes * 60;
  const progress =
    timer.phase === 'idle' ? 0 : 1 - timer.timeRemaining / totalSecsForPhase;
  const dashOffset = RING_CIRCUM * (1 - Math.max(0, Math.min(1, progress)));

  const phaseLabel =
    timer.phase === 'idle' ? 'Ready' : timer.phase === 'work' ? 'Focus' : 'Break';

  const ringSize = compact ? 160 : 224;
  const fontSize = compact ? 'text-4xl' : 'text-6xl';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Screen-reader announcement for phase transitions */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {timer.phase === 'idle'
          ? 'Pomodoro idle.'
          : timer.phase === 'work'
            ? `Focus session, ${mins} minutes ${secs} seconds remaining.`
            : `Break, ${mins} minutes ${secs} seconds remaining.`}
      </span>

      <div
        className="relative"
        style={{ width: ringSize, height: ringSize }}
        role="timer"
        aria-label={`${phaseLabel}, ${timeLabel} remaining`}
      >
        <svg
          width={ringSize}
          height={ringSize}
          viewBox="0 0 200 200"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="6"
          />
          <circle
            cx="100"
            cy="100"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUM}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-subtle)] mb-2">
            {phaseLabel}
          </p>
          <p
            className={`${fontSize} font-mono font-semibold text-[var(--color-text)] tabular-nums tracking-tight`}
          >
            {timeLabel}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium h-10 px-6 rounded-md transition-colors flex items-center gap-2"
          aria-label={timer.isRunning ? 'Pause timer' : 'Start timer'}
        >
          {timer.isRunning ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {timer.phase === 'idle' ? 'Start' : 'Resume'}
            </>
          )}
        </button>
        <button
          onClick={timer.skip}
          disabled={timer.phase === 'idle'}
          className="h-10 px-4 rounded-md border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          aria-label="Skip phase"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
      </div>

      {timer.totalSessions > 0 && (
        <p className="text-xs text-[var(--color-text-subtle)] tabular-nums">
          {timer.totalSessions} session{timer.totalSessions === 1 ? '' : 's'} completed today
        </p>
      )}
    </div>
  );
}
