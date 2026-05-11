/**
 * Dashboard hero — typography-led greeting block at the top of the home page.
 *
 * Replaces the previous aurora-gradient band + streak chip combo with a
 * quiet, scannable header: a single H1 greeting and a small date eyebrow.
 * Streak data still flows through (consumed elsewhere if needed) but the
 * dashboard no longer competes with itself for the user's attention.
 */

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
    year: "numeric",
  });
}

export function HeroHeader({
  name,
  streak: _streak,
  todayCompleted: _todayCompleted,
  streakLoading: _streakLoading = false,
}: HeroHeaderProps) {
  const greeting = getGreeting();
  const dateLabel = formatToday();

  const subtitle = dateLabel;

  return (
    <section className="relative mx-2 mt-2 grid min-h-[430px] place-items-center rounded-t-[28px] bg-[linear-gradient(180deg,rgba(119,208,101,0.52)_0%,rgba(233,247,235,0.82)_62%,rgba(255,255,255,1)_100%)] px-6 py-16">
      <div className="w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight text-black sm:text-6xl lg:text-7xl">
          {greeting},{" "}
          <span className="text-[#72d64f]">{name}</span>
        </h1>
        <p className="mt-6 text-2xl font-normal uppercase tracking-wide text-black sm:text-3xl">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
