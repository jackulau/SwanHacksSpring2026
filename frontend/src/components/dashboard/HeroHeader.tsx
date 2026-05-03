/**
 * Dashboard hero — the "Good morning, Jef" card.
 *
 * Layout:
 *   ┌─ aurora-vibe background ─────────────────────────────┐
 *   │  Good morning, Jef                          [🔥 12d] │
 *   │  Here's your study overview                          │
 *   └──────────────────────────────────────────────────────┘
 *
 * The streak chip is intentionally placed **inside the greeting card** (not
 * as a separate row below) per the redesign brief. Loading and empty states
 * are both handled here so callers can pass values directly without wrapping
 * the chip in conditional logic of their own.
 */

import { Flame } from "lucide-react";
import { SkeletonText } from "../layout/Skeleton";

interface HeroHeaderProps {
  /** First-name or pre-`@` portion of the user's email. */
  name: string;
  streak: number;
  todayCompleted: boolean;
  /** When the streak hook is still loading we render a discreet placeholder chip. */
  streakLoading?: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function HeroHeader({
  name,
  streak,
  todayCompleted,
  streakLoading = false,
}: HeroHeaderProps) {
  const greeting = getGreeting();

  return (
    <section className="vibe-aurora rounded-3xl p-6 sm:p-8 soft-shadow">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {greeting},{" "}
            <span className="bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">
              {name}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-300/80 mt-1.5">
            Here&apos;s your study overview
          </p>
        </div>

        <StreakChip
          streak={streak}
          todayCompleted={todayCompleted}
          loading={streakLoading}
        />
      </div>
    </section>
  );
}

interface StreakChipProps {
  streak: number;
  todayCompleted: boolean;
  loading: boolean;
}

function StreakChip({ streak, todayCompleted, loading }: StreakChipProps) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-3 self-start sm:self-center px-4 py-2.5 rounded-2xl glass-strong">
        <SkeletonText width="2rem" />
        <SkeletonText width="4rem" />
      </div>
    );
  }

  const active = streak > 0;
  const onFire = streak >= 7;

  return (
    <div
      className={`inline-flex items-center gap-3 self-start sm:self-center px-4 py-2.5 rounded-2xl glass-strong ${
        active ? "border-orange-500/30" : "border-white/10"
      }`}
      aria-label={
        active
          ? `Current streak: ${streak} day${streak === 1 ? "" : "s"}${todayCompleted ? ", today completed" : ""}`
          : "No active streak"
      }
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          active ? "bg-orange-500/20" : "bg-zinc-800/60"
        }`}
      >
        <Flame
          className={`h-5 w-5 ${active ? "text-orange-400 streak-flame" : "text-zinc-500"}`}
          aria-hidden="true"
        />
      </span>
      <div className="leading-tight">
        <p
          className={`text-base font-bold ${active ? "text-orange-100" : "text-zinc-300"}`}
        >
          {streak} {streak === 1 ? "day" : "days"}
          {onFire && (
            <span className="ml-2 text-[11px] uppercase tracking-wider text-orange-300/90">
              on fire
            </span>
          )}
        </p>
        <p className="text-[11px] text-zinc-400">
          {!active
            ? "Start a session to begin"
            : todayCompleted
              ? "Today complete"
              : "Study today to extend"}
        </p>
      </div>
    </div>
  );
}
