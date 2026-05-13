/**
 * /stats — personal analytics dashboard.
 *
 * Five cards:
 *   1. Study time this week (sum of study_sessions.duration_secs, last 7d).
 *   2. Cards reviewed (lifetime total + last-7d mini bar by day).
 *   3. Quiz performance (avg of last 10 attempts + sparkline).
 *   4. Library size (count of notes, lectures, flashcards, quizzes, asl).
 *   5. Top 5 decks by flashcard count.
 *
 * Charts are inline SVG / styled divs — no charts dep. We pull lightweight
 * `getList(1, 1)` requests for counts and `-completed_at`/`-started_at`
 * for the recent windows. Filters are scoped to `user = "<id>"` to match
 * PocketBase's per-user rules.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Clock,
  GraduationCap,
  Hand,
  HelpCircle,
  Layers,
  Library,
  Trophy,
  FileText,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/layout/Skeleton";
import { EmptyState } from "../components/layout/EmptyState";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Flashcard, QuizAttempt, StudySession } from "../lib/types";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

const DAY_MS = 24 * 60 * 60 * 1000;

interface StatsBundle {
  weekSessions: StudySession[];
  recentAttempts: QuizAttempt[];
  flashcards: Flashcard[];
  counts: {
    notes: number;
    lectures: number;
    flashcards: number;
    quizzes: number;
    asl: number;
  };
}

async function fetchCount(
  collection: string,
  filter: string,
  requestKey: string,
): Promise<number> {
  try {
    const res = await pb
      .collection(collection)
      .getList(1, 1, { filter, requestKey });
    return res.totalItems;
  } catch {
    return 0;
  }
}

function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StatsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const userFilter = `user = "${user.id}"`;
    Promise.all([
      pb
        .collection("study_sessions")
        .getFullList<StudySession>({
          filter: `${userFilter} && started_at >= "${since}"`,
          sort: "-started_at",
          requestKey: "stats-week-sessions",
        })
        .catch(() => [] as StudySession[]),
      pb
        .collection("quiz_attempts")
        .getList<QuizAttempt>(1, 10, {
          filter: userFilter,
          sort: "-completed_at",
          requestKey: "stats-attempts",
        })
        .then((r) => r.items)
        .catch(() => [] as QuizAttempt[]),
      pb
        .collection("flashcards")
        .getFullList<Flashcard>({
          filter: userFilter,
          fields: "id,deck_name,repetitions",
          requestKey: "stats-flashcards",
        })
        .catch(() => [] as Flashcard[]),
      fetchCount("note_pages", `${userFilter} && archived = false`, "stats-c-notes"),
      fetchCount("lectures", userFilter, "stats-c-lectures"),
      fetchCount("flashcards", userFilter, "stats-c-flashcards"),
      fetchCount("quizzes", userFilter, "stats-c-quizzes"),
      fetchCount("asl_segments", userFilter, "stats-c-asl"),
    ])
      .then(
        ([
          weekSessions,
          recentAttempts,
          flashcards,
          notes,
          lectures,
          flashcardsCount,
          quizzes,
          asl,
        ]) => {
          if (cancelled) return;
          setData({
            weekSessions,
            recentAttempts,
            flashcards,
            counts: {
              notes,
              lectures,
              flashcards: flashcardsCount,
              quizzes,
              asl,
            },
          });
          setLoading(false);
        },
      )
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const studyHoursThisWeek = useMemo(() => {
    if (!data) return 0;
    const total = data.weekSessions.reduce(
      (acc, s) => acc + (s.duration_secs || 0),
      0,
    );
    return total / 3600;
  }, [data]);

  // Bucket cards-reviewed by day for the last 7 days (today is rightmost).
  const cardsByDay = useMemo(() => {
    const buckets = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { dayStart: d.getTime(), count: 0 };
    });
    if (!data) return buckets;
    for (const s of data.weekSessions) {
      const ts = new Date(s.started_at).getTime();
      if (Number.isNaN(ts)) continue;
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (ts >= buckets[i].dayStart) {
          buckets[i].count += s.cards_reviewed || 0;
          break;
        }
      }
    }
    return buckets;
  }, [data]);

  const cardsThisWeek = cardsByDay.reduce((acc, b) => acc + b.count, 0);

  const quizAvg = useMemo(() => {
    if (!data || data.recentAttempts.length === 0) return null;
    const sum = data.recentAttempts.reduce(
      (acc, a) => acc + (a.percentage || 0),
      0,
    );
    return sum / data.recentAttempts.length;
  }, [data]);

  // Sparkline series ordered oldest -> newest so the line reads left-to-right.
  const quizSeries = useMemo(() => {
    if (!data) return [] as number[];
    return [...data.recentAttempts]
      .reverse()
      .map((a) => Math.max(0, Math.min(100, a.percentage || 0)));
  }, [data]);

  const topDecks = useMemo(() => {
    if (!data) return [] as { name: string; count: number }[];
    const m = new Map<string, number>();
    for (const f of data.flashcards) {
      const name = (f.deck_name || "Untitled deck").trim() || "Untitled deck";
      m.set(name, (m.get(name) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Stats"
        subtitle="A quiet read on your study patterns — only you can see this."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* a) Study time this week */}
          <Card
            icon={Clock}
            title="Study time this week"
            subtitle="Sum of timed study sessions, last 7 days"
            loading={loading}
          >
            {!loading && data && data.weekSessions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No sessions yet"
                description="Start a flashcard or quiz session to start the clock."
                size="sm"
              />
            ) : (
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
                  {studyHoursThisWeek.toFixed(1)}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  hours
                </span>
              </div>
            )}
            {!loading && data && data.weekSessions.length > 0 && (
              <p className="text-xs text-[var(--color-text-subtle)] mt-2">
                {data.weekSessions.length} session
                {data.weekSessions.length === 1 ? "" : "s"}
              </p>
            )}
          </Card>

          {/* b) Cards reviewed */}
          <Card
            icon={Layers}
            title="Cards reviewed"
            subtitle="All-time, plus the last 7 days by day"
            loading={loading}
          >
            {!loading && data && cardsThisWeek === 0 ? (
              <EmptyState
                icon={Layers}
                title="No reviews logged"
                description="Card reviews show here once you finish a session."
                size="sm"
              />
            ) : (
              <>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
                    {cardsThisWeek}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    this week
                  </span>
                </div>
                <DayBars buckets={cardsByDay} />
              </>
            )}
          </Card>

          {/* c) Quiz performance */}
          <Card
            icon={Trophy}
            title="Quiz performance"
            subtitle="Average of your last 10 attempts"
            loading={loading}
          >
            {!loading && data && data.recentAttempts.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No quiz attempts yet"
                description="Take a quiz to see your trend here."
                size="sm"
              />
            ) : (
              <>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
                    {quizAvg !== null ? Math.round(quizAvg) : "—"}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    %
                  </span>
                </div>
                <Sparkline values={quizSeries} />
              </>
            )}
          </Card>

          {/* d) Library size */}
          <Card
            icon={Library}
            title="Library size"
            subtitle="What's in your account right now"
            loading={loading}
            wide
          >
            {!loading && data && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <CountTile
                  icon={FileText}
                  label="Note pages"
                  value={data.counts.notes}
                />
                <CountTile
                  icon={GraduationCap}
                  label="Lectures"
                  value={data.counts.lectures}
                />
                <CountTile
                  icon={Layers}
                  label="Flashcards"
                  value={data.counts.flashcards}
                />
                <CountTile
                  icon={HelpCircle}
                  label="Quizzes"
                  value={data.counts.quizzes}
                />
                <CountTile
                  icon={Hand}
                  label="ASL segments"
                  value={data.counts.asl}
                />
              </ul>
            )}
          </Card>

          {/* e) Top decks */}
          <Card
            icon={BarChart3}
            title="Top decks"
            subtitle="Biggest decks by flashcard count"
            loading={loading}
            wide
          >
            {!loading && data && topDecks.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No decks yet"
                description="Generate cards from a lecture to fill this in."
                size="sm"
              />
            ) : (
              <ul className="space-y-2 pt-1">
                {topDecks.map((d) => {
                  const max = topDecks[0]?.count || 1;
                  const pct = Math.max(4, Math.round((d.count / max) * 100));
                  return (
                    <li key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-[var(--color-text)]">
                          {d.name}
                        </span>
                        <span className="text-[var(--color-text-subtle)] tabular-nums">
                          {d.count}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--color-surface-raised)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-primary)]"
                          style={{ width: `${pct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

interface CardProps {
  icon: typeof Clock;
  title: string;
  subtitle?: string;
  loading: boolean;
  wide?: boolean;
  children?: React.ReactNode;
}

function Card({ icon: Icon, title, subtitle, loading, wide, children }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col ${
        wide ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <header className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-subtle)] shrink-0">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-[5rem]">
        {loading ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function DayBars({ buckets }: { buckets: { dayStart: number; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="mt-3">
      <div className="flex items-end gap-1.5 h-16">
        {buckets.map((b, i) => {
          const pct = (b.count / max) * 100;
          const day = new Date(b.dayStart).getDay();
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[var(--color-primary)]/80 min-h-[2px]"
                style={{ height: `${pct}%` }}
                aria-label={`${b.count} cards`}
                title={`${b.count} cards`}
              />
              <span className="text-[10px] text-[var(--color-text-subtle)] tabular-nums">
                {labels[day]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const W = 220;
  const H = 48;
  const padX = 2;
  const padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  // Force the y-axis to 0..100 so absolute scores feel comparable.
  const points = values.map((v, i) => {
    const x =
      values.length === 1
        ? padX + innerW / 2
        : padX + (i / (values.length - 1)) * innerW;
    const y = padY + innerH - (v / 100) * innerH;
    return { x, y };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      className="mt-3 overflow-visible"
      role="img"
      aria-label={`Last ${values.length} quiz percentages`}
    >
      <line
        x1={padX}
        x2={W - padX}
        y1={H - padY}
        y2={H - padY}
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="var(--color-primary)" />
    </svg>
  );
}

function CountTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
}) {
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 px-3 py-2.5 flex items-center gap-2.5">
      <Icon
        className="w-4 h-4 text-[var(--color-text-subtle)] shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-lg font-semibold text-[var(--color-text)] tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[11px] text-[var(--color-text-subtle)] mt-1">
          {label}
        </div>
      </div>
    </li>
  );
}
