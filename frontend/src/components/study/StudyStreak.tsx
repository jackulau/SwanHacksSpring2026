import { Flame } from 'lucide-react';

interface StudyStreakProps {
  streak: number;
  todayCompleted: boolean;
}

/**
 * Inline streak chip — sized to live in `<PageHeader actions>`.
 * Orange/red is allowed for this single component (it's the streak metaphor).
 */
export function StudyStreak({ streak, todayCompleted }: StudyStreakProps) {
  const active = streak > 0;
  const dayLabel = `${streak} day${streak === 1 ? '' : 's'}`;
  const a11y = active
    ? `${dayLabel} streak${todayCompleted ? ', today completed' : ''}`
    : 'No active streak';

  return (
    <span
      role="status"
      aria-label={a11y}
      className={`inline-flex items-center gap-2 h-8 px-3 rounded-md border text-sm tabular-nums ${
        active
          ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
          : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
      }`}
    >
      <Flame
        className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-[var(--color-text-subtle)]'}`}
        aria-hidden="true"
      />
      <span className="font-medium">{dayLabel}</span>
      {active && !todayCompleted && (
        <span className="text-[11px] text-orange-300/80">at risk</span>
      )}
    </span>
  );
}
