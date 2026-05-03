/**
 * Dashboard hero — the greeting / streak band that runs along the top of
 * the home page.
 *
 * Layout (matches `dark-mode-empty.png` and `light-mode-filled.png`):
 *   ┌─ vibe-aurora (grey gradient w/ subtle green glow) ─────────────────┐
 *   │  Good Morning, Name                       🔥 12d                   │
 *   │  WEDNESDAY, AUGUST 17, 2022                                        │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * The user dropdown sits *above* this strip in `<AppShell>` (top-right
 * floating); we leave room for it on the right. The streak chip lives in
 * the greeting card so the user always sees their current streak when they
 * land on the dashboard, per the brief.
 */

import { Flame } from "lucide-react";
import { SkeletonText } from "../layout/Skeleton";

interface HeroHeaderProps {
  name: string;
  streak: number;
  todayCompleted: boolean;
  streakLoading?: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

function formatToday(): string {
  return new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function HeroHeader({
  name,
  streak,
  todayCompleted,
  streakLoading = false,
}: HeroHeaderProps) {
  const greeting = getGreeting();
  const dateLabel = formatToday();

  return (
    <section className="vibe-aurora px-4 sm:px-6 lg:px-8 pt-10 pb-8">
      <div className="max-w-6xl mx-auto relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pr-0 lg:pr-44">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            {greeting}, {name}
          </h1>
          <p className="text-xs sm:text-sm tracking-[0.18em] text-[var(--color-text-muted)] mt-2">
            {dateLabel}
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
      <div className="inline-flex items-center gap-3 self-start sm:self-end px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10">
        <SkeletonText width="2rem" />
        <SkeletonText width="4rem" />
      </div>
    );
  }

  const active = streak > 0;
  const onFire = streak >= 7;

  return (
    <div
      className={`inline-flex items-center gap-3 self-start sm:self-end px-4 py-2.5 rounded-2xl bg-black/40 border ${
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
