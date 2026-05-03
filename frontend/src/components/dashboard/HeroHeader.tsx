/**
 * Dashboard hero — typography-led greeting block at the top of the home page.
 *
 * Replaces the previous aurora-gradient band + streak chip combo with a
 * quiet, scannable header: a single H1 greeting and a small date eyebrow.
 * Streak data still flows through (consumed elsewhere if needed) but the
 * dashboard no longer competes with itself for the user's attention.
 */

import { PageHeader } from "../layout/PageHeader";

interface HeroHeaderProps {
  name: string;
  /** Streak data is accepted for backwards compatibility; rendered subtly inline. */
  streak: number;
  todayCompleted: boolean;
  streakLoading?: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good evening";
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function HeroHeader({
  name,
  streak,
  todayCompleted,
  streakLoading = false,
}: HeroHeaderProps) {
  const greeting = getGreeting();
  const dateLabel = formatToday();

  // Streak surfaces only when meaningful, as a quiet trailing fragment in the
  // subtitle — never as a heavy chip.
  let subtitle = dateLabel;
  if (!streakLoading && streak > 0) {
    const suffix = todayCompleted
      ? `${streak}-day streak, today complete`
      : `${streak}-day streak`;
    subtitle = `${dateLabel} · ${suffix}`;
  }

  return <PageHeader title={`${greeting}, ${name}`} subtitle={subtitle} />;
}
