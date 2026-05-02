import { Flame } from 'lucide-react';

interface StudyStreakProps {
  streak: number;
  todayCompleted: boolean;
}

export function StudyStreak({ streak, todayCompleted }: StudyStreakProps) {
  return (
    <div className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
      <div className={`p-2 rounded-full ${streak > 0 ? 'bg-orange-500/20' : 'bg-zinc-700/50'}`}>
        <Flame className={`w-6 h-6 ${streak > 0 ? 'text-orange-400' : 'text-zinc-500'}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100">{streak} day{streak !== 1 ? 's' : ''}</p>
        <p className="text-sm text-zinc-400">
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
