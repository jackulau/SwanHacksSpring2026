import { Flame } from 'lucide-react';

interface StudyStreakProps {
  streak: number;
  todayCompleted: boolean;
}

export function StudyStreak({ streak, todayCompleted }: StudyStreakProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-full ${streak > 0 ? 'bg-orange-500/20' : 'bg-[var(--color-input)]'}`}>
        <Flame className={`w-6 h-6 ${streak > 0 ? 'text-orange-400' : 'text-[var(--color-text-subtle)]'}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{streak} day{streak !== 1 ? 's' : ''}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {todayCompleted ? 'Keep it going!' : 'Study today to continue your streak'}
        </p>
      </div>
      {streak >= 7 && (
        <div className="ml-auto text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full font-medium">
          On fire
        </div>
      )}
    </div>
  );
}
