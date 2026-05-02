import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { usePomodoro } from '../../hooks/usePomodoro';

interface PomodoroTimerProps {
  workMinutes?: number;
}

export function PomodoroTimer({ workMinutes = 25 }: PomodoroTimerProps) {
  const timer = usePomodoro({ workMinutes });

  const mins = Math.floor(timer.timeRemaining / 60);
  const secs = timer.timeRemaining % 60;

  const phaseColors = {
    idle: 'text-zinc-400',
    work: 'text-indigo-400',
    break: 'text-green-400',
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
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 text-center">
      <p className={`text-sm font-medium mb-2 ${phaseColors[timer.phase]}`}>
        {phaseLabels[timer.phase]}
      </p>

      <p className="text-5xl font-mono font-bold text-zinc-100 mb-4">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>

      <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-1000 ${
            timer.phase === 'break' ? 'bg-green-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-3 transition-colors"
          aria-label={timer.isRunning ? 'Pause' : 'Start'}
        >
          {timer.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={timer.reset}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-full p-3 transition-colors"
          aria-label="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={timer.skip}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-full p-3 transition-colors"
          aria-label="Skip phase"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Session {timer.currentSession + 1} · {timer.totalSessions} completed
      </p>
    </div>
  );
}
