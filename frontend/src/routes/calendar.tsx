import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/layout/Skeleton";
import { EmptyState } from "../components/layout/EmptyState";
import { pb } from "../lib/pocketbase";
import type { Lecture, Assignment } from "../lib/types";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <PageHeader title="Calendar" subtitle="Lectures and assignments at a glance" />
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <CalendarBoard userId={user.id} />
        </div>
      </div>
    </AppShell>
  );
}

interface DayItem {
  id: string;
  type: "lecture" | "assignment";
  title: string;
  href: string;
  param?: string;
}

function CalendarBoard({ userId }: { userId: string }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      pb
        .collection("lectures")
        .getFullList<Lecture>({ filter: `user = "${userId}"` })
        .catch(() => [] as Lecture[]),
      pb
        .collection("assignments")
        .getFullList<Assignment>({ filter: `user = "${userId}"` })
        .catch(() => [] as Assignment[]),
    ]).then(([lec, asg]) => {
      if (cancelled) return;
      setLectures(lec);
      setAssignments(asg);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const l of lectures) {
      const key = isoDay(l.recorded_at || l.created);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push({
        id: l.id,
        type: "lecture",
        title: l.title || "Untitled lecture",
        href: "/lectures/$lectureId",
        param: l.id,
      });
      map.set(key, arr);
    }
    for (const a of assignments) {
      const key = isoDay(a.due_at);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push({
        id: a.id,
        type: "assignment",
        title: a.title,
        href: a.canvas_url,
      });
      map.set(key, arr);
    }
    return map;
  }, [lectures, assignments]);

  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const days = monthGrid(cursor);
  const totalItems = lectures.length + assignments.length;

  return (
    <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] soft-shadow overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-white text-lg">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] p-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : totalItems === 0 ? (
        <div className="p-6">
          <EmptyState
            size="md"
            icon={CalendarIcon}
            title="Nothing scheduled"
            description="Record a lecture or sync Canvas assignments to populate the calendar."
            action={
              <Link
                to="/capture"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
              >
                Start a recording
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] px-2 pt-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 pb-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] p-px">
            {days.map(({ date, inMonth }) => {
              const key = isoDay(date.toISOString());
              const items = key ? itemsByDay.get(key) ?? [] : [];
              const today = isSameDay(date, new Date());
              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[88px] bg-[var(--color-surface)] p-2 text-xs ${
                    inMonth ? "text-white" : "text-[var(--color-text-subtle)]"
                  }`}
                >
                  <div
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] mb-1 ${
                      today
                        ? "bg-[var(--color-primary)] text-black font-semibold"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <ul className="space-y-1">
                    {items.slice(0, 2).map((it) => (
                      <li key={it.id}>
                        <CalendarChip item={it} />
                      </li>
                    ))}
                    {items.length > 2 && (
                      <li className="text-[10px] text-[var(--color-text-muted)] px-1">
                        +{items.length - 2} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CalendarChip({ item }: { item: DayItem }) {
  const tone =
    item.type === "lecture"
      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
      : "bg-amber-500/15 text-amber-300";
  if (item.type === "lecture" && item.param) {
    return (
      <Link
        to="/lectures/$lectureId"
        params={{ lectureId: item.param }}
        className={`block truncate rounded px-1.5 py-0.5 text-[10px] ${tone}`}
        title={item.title}
      >
        {item.title}
      </Link>
    );
  }
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className={`block truncate rounded px-1.5 py-0.5 text-[10px] ${tone}`}
      title={item.title}
    >
      {item.title}
    </a>
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoDay(iso?: string): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return undefined;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function monthGrid(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(monthStart);
  const startWeekday = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startWeekday);
  const out: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    out.push({ date: d, inMonth: d.getMonth() === monthStart.getMonth() });
  }
  // Trim to 5 weeks unless 6 are needed
  const fiveWeeks = out.slice(0, 35);
  const sixthRowNeeded = out.slice(35).some((g) => g.inMonth);
  return sixthRowNeeded ? out : fiveWeeks;
}
