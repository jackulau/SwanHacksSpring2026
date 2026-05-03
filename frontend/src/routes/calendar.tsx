import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Lecture, Assignment } from "../lib/types";
import {
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  CalendarCheck,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/calendar")({
  component: () => (
    <AppShell>
      <CalendarPage />
    </AppShell>
  ),
});

type ViewMode = "day" | "schoolWeek" | "week" | "month";
type EventKind = "lecture" | "assignment" | "user";

type CalendarEvent = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  kind: EventKind;
  href?: string;
  externalHref?: string;
};

const HOUR_HEIGHT = 56;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const LECTURE_DEFAULT_DURATION_MIN = 60;
const ASSIGNMENT_BLOCK_DURATION_MIN = 30;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const KIND_STYLE: Record<EventKind, { bg: string; bar: string; text: string; sub: string }> = {
  lecture: {
    bg: "bg-[var(--color-primary-soft)] hover:bg-[color-mix(in_oklab,var(--color-primary-soft)_85%,white)]",
    bar: "bg-[var(--color-primary)]",
    text: "text-[var(--color-text)]",
    sub: "text-[var(--color-text-muted)]",
  },
  assignment: {
    bg: "bg-amber-500/15 hover:bg-amber-500/25",
    bar: "bg-amber-400",
    text: "text-amber-50",
    sub: "text-amber-200/80",
  },
  user: {
    bg: "bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-elevated)]",
    bar: "bg-[var(--color-text-subtle)]",
    text: "text-[var(--color-text)]",
    sub: "text-[var(--color-text-muted)]",
  },
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(d.getDate() + n);
  return nd;
}

function startOfWeek(d: Date, weekStart = 0): Date {
  const nd = new Date(d);
  const diff = (nd.getDay() - weekStart + 7) % 7;
  nd.setDate(nd.getDate() - diff);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function dateToEvent(date: Date, durationMin: number, base: Omit<CalendarEvent, "date" | "startMinutes" | "endMinutes">): CalendarEvent {
  const start = date.getHours() * 60 + date.getMinutes();
  return {
    ...base,
    date: isoDate(date),
    startMinutes: start,
    endMinutes: start + durationMin,
  };
}

function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [anchor, setAnchor] = useState<Date>(today);
  const [view, setView] = useState<ViewMode>("schoolWeek");
  const [miniMonth, setMiniMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [remoteEvents, setRemoteEvents] = useState<CalendarEvent[]>([]);
  const [userEvents, setUserEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<{ date: string; startMinutes: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    if (!user) {
      setRemoteEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      pb
        .collection("lectures")
        .getFullList<Lecture>({ filter: `user = "${user.id}"` })
        .catch(() => [] as Lecture[]),
      pb
        .collection("assignments")
        .getFullList<Assignment>({ filter: `user = "${user.id}"` })
        .catch(() => [] as Assignment[]),
    ]).then(([lec, asg]) => {
      if (cancelled) return;
      const events: CalendarEvent[] = [];
      for (const l of lec) {
        const when = l.recorded_at || l.created;
        if (!when) continue;
        const d = new Date(when);
        if (Number.isNaN(d.valueOf())) continue;
        const dur = l.duration_secs ? Math.max(15, Math.round(l.duration_secs / 60)) : LECTURE_DEFAULT_DURATION_MIN;
        events.push(
          dateToEvent(d, dur, {
            id: `lec-${l.id}`,
            title: l.title || "Untitled lecture",
            kind: "lecture",
            href: `/lectures/${l.id}`,
          }),
        );
      }
      for (const a of asg) {
        if (!a.due_at) continue;
        const d = new Date(a.due_at);
        if (Number.isNaN(d.valueOf())) continue;
        events.push(
          dateToEvent(d, ASSIGNMENT_BLOCK_DURATION_MIN, {
            id: `asg-${a.id}`,
            title: a.title,
            subtitle: a.points_possible ? `${a.points_possible} pts` : undefined,
            kind: "assignment",
            externalHref: a.canvas_url,
          }),
        );
      }
      setRemoteEvents(events);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const events = useMemo(() => [...remoteEvents, ...userEvents], [remoteEvents, userEvents]);

  const visibleDays = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const sun = startOfWeek(anchor, 0);
      return Array.from({ length: 7 }, (_, i) => addDays(sun, i));
    }
    const mon = startOfWeek(anchor, 1);
    return Array.from({ length: 5 }, (_, i) => addDays(mon, i));
  }, [anchor, view]);

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return `${MONTHS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
    }
    if (view === "month") {
      return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    }
    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`;
    }
    return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
  }, [view, anchor, visibleDays]);

  const navigateRange = (dir: -1 | 1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "month") {
      const nd = new Date(anchor);
      nd.setMonth(anchor.getMonth() + dir);
      setAnchor(nd);
      setMiniMonth(new Date(nd.getFullYear(), nd.getMonth(), 1));
    } else setAnchor(addDays(anchor, dir * 7));
  };

  const goToday = () => {
    setAnchor(today);
    setMiniMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleSlotClick = (date: string, hour: number) => {
    setCreating({ date, startMinutes: hour * 60 });
    setDraftTitle("");
  };

  const commitEvent = () => {
    if (!creating || !draftTitle.trim()) {
      setCreating(null);
      return;
    }
    setUserEvents((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        title: draftTitle.trim(),
        date: creating.date,
        startMinutes: creating.startMinutes,
        endMinutes: creating.startMinutes + 60,
        kind: "user",
      },
    ]);
    setCreating(null);
    setDraftTitle("");
  };

  const openEvent = (e: CalendarEvent) => {
    if (e.href) navigate({ to: e.href });
    else if (e.externalHref) window.open(e.externalHref, "_blank", "noopener,noreferrer");
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Top toolbar */}
      <div className="flex items-center gap-1 px-4 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] shrink-0 overflow-x-auto">
        <button
          onClick={() => handleSlotClick(isoDate(anchor), Math.max(DAY_START_HOUR, new Date().getHours()))}
          className="flex items-center gap-2 px-3 h-8 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New event
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>

        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        <ToolbarToggle icon={CalendarIcon} label="Day" active={view === "day"} onClick={() => setView("day")} />
        <ToolbarToggle icon={CalendarRange} label="School week" active={view === "schoolWeek"} onClick={() => setView("schoolWeek")} />
        <ToolbarToggle icon={CalendarDays} label="Week" active={view === "week"} onClick={() => setView("week")} />
        <ToolbarToggle icon={CalendarRange} label="Month" active={view === "month"} onClick={() => setView("month")} />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-64 border-r border-[var(--color-border)] flex flex-col shrink-0 overflow-y-auto">
          <MiniMonth
            month={miniMonth}
            selected={anchor}
            today={today}
            onPrev={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}
            onNext={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}
            onPick={(d) => setAnchor(d)}
          />

          <nav className="px-3 py-2 space-y-0.5">
            <SidebarLink icon={CalendarPlus} label="Add calendar" disabled />
            <SidebarLink icon={CalendarCheck} label="Booking page" disabled />
          </nav>

          <div className="px-3 mt-4 pb-6">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wide px-2 py-1.5">
              My calendars
            </div>
            <div className="space-y-0.5">
              <CalendarLegendRow color="var(--color-primary)" label="Lectures" count={remoteEvents.filter((e) => e.kind === "lecture").length} />
              <CalendarLegendRow color="rgb(251 191 36)" label="Assignments" count={remoteEvents.filter((e) => e.kind === "assignment").length} />
              <CalendarLegendRow color="rgb(255 255 255 / 0.4)" label="Personal" count={userEvents.length} />
            </div>
          </div>
        </aside>

        {/* Main grid area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-border)] shrink-0">
            <button
              onClick={goToday}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-xs font-medium transition-colors"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Today
            </button>
            <button onClick={() => navigateRange(-1)} className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] grid place-items-center" aria-label="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => navigateRange(1)} className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] grid place-items-center" aria-label="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h1 className="text-base font-semibold text-[var(--color-text)] ml-1">{rangeLabel}</h1>

            <div className="ml-auto text-xs text-[var(--color-text-subtle)]">
              {loading ? "Syncing…" : `${remoteEvents.length + userEvents.length} events`}
            </div>
          </div>

          {view === "month" ? (
            <MonthView
              month={anchor}
              today={today}
              events={events}
              onPickDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onOpenEvent={openEvent}
            />
          ) : (
            <WeekGrid
              days={visibleDays}
              today={today}
              events={events}
              creating={creating}
              draftTitle={draftTitle}
              setDraftTitle={setDraftTitle}
              onCommit={commitEvent}
              onCancel={() => setCreating(null)}
              onSlotClick={handleSlotClick}
              onOpenEvent={openEvent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarToggle({
  icon: Icon, label, active, onClick, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md text-sm transition-colors shrink-0 ${
        active
          ? "bg-[var(--color-surface-elevated)] text-[var(--color-text)] ring-1 ring-[var(--color-border-strong)]"
          : disabled
          ? "text-[var(--color-text-subtle)] cursor-not-allowed"
          : "hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function SidebarLink({ icon: Icon, label, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
        disabled ? "text-[var(--color-text-subtle)] cursor-not-allowed" : "text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
      }`}
    >
      <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
      {label}
    </button>
  );
}

function CalendarLegendRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-[var(--color-text)]">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">{count}</span>
    </div>
  );
}

function MiniMonth({
  month, selected, today, onPrev, onNext, onPick,
}: {
  month: Date;
  selected: Date;
  today: Date;
  onPrev: () => void;
  onNext: () => void;
  onPick: (d: Date) => void;
}) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startGrid = startOfWeek(firstOfMonth, 0);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
  const monthLabel = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <div className="px-3 pt-3 pb-2 border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">{monthLabel}</span>
        <div className="flex items-center">
          <button onClick={onPrev} className="w-6 h-6 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] grid place-items-center" aria-label="Previous month">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onNext} className="w-6 h-6 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] grid place-items-center" aria-label="Next month">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-[var(--color-text-subtle)] mb-1">
        {DOW_SHORT.map((d, i) => (
          <div key={i} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = isoDate(d) === isoDate(today);
          const isSelected = isoDate(d) === isoDate(selected);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className={`h-7 text-xs rounded-full transition-colors ${
                isSelected
                  ? "bg-[var(--color-primary)] text-white font-semibold"
                  : isToday
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
                  : inMonth
                  ? "text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                  : "text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-raised)]/60"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days, today, events, creating, draftTitle, setDraftTitle, onCommit, onCancel, onSlotClick, onOpenEvent,
}: {
  days: Date[];
  today: Date;
  events: CalendarEvent[];
  creating: { date: string; startMinutes: number } | null;
  draftTitle: string;
  setDraftTitle: (s: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onSlotClick: (date: string, hour: number) => void;
  onOpenEvent: (e: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const dayKeys = days.map(isoDate);
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const k of dayKeys) map[k] = [];
    for (const e of events) if (map[e.date]) map[e.date].push(e);
    return map;
  }, [events, dayKeys]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-fit">
        <div
          className="grid sticky top-0 z-20 bg-[var(--color-bg)] border-b border-[var(--color-border)]"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const isToday = isoDate(d) === isoDate(today);
            return (
              <div key={d.toISOString()} className="px-3 py-2 border-l border-[var(--color-border)]">
                <div className={`text-2xl font-light ${isToday ? "text-[var(--color-primary-strong)]" : "text-[var(--color-text)]"}`}>
                  {d.getDate()}
                </div>
                <div className={`text-xs ${isToday ? "text-[var(--color-primary-strong)]" : "text-[var(--color-text-subtle)]"}`}>
                  {DOW_FULL[d.getDay()]}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="grid relative"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}
        >
          <div className="border-r border-[var(--color-border)]">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2 text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wide">
                  {fmtTime(h * 60)}
                </span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const key = isoDate(d);
            const isToday = isoDate(d) === isoDate(today);
            return (
              <div key={key} className="relative border-l border-[var(--color-border)]">
                {hours.map((h) => (
                  <button
                    key={h}
                    onClick={() => onSlotClick(key, h)}
                    className="block w-full border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-raised)]/40 transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                    aria-label={`Create event ${key} ${fmtTime(h * 60)}`}
                  />
                ))}
                {isToday && <NowLine />}
                {eventsByDay[key]?.map((e) => (
                  <EventBlock key={e.id} event={e} onOpen={() => onOpenEvent(e)} />
                ))}
                {creating && creating.date === key && (
                  <DraftEventBlock
                    startMinutes={creating.startMinutes}
                    title={draftTitle}
                    setTitle={setDraftTitle}
                    onCommit={onCommit}
                    onCancel={onCancel}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const offset = minutes - DAY_START_HOUR * 60;
  if (offset < 0 || offset > (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;
  const top = (offset / 60) * HOUR_HEIGHT;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-[var(--color-primary-strong)] -ml-1" />
        <div className="flex-1 h-px bg-[var(--color-primary-strong)]" />
      </div>
    </div>
  );
}

function EventBlock({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const offset = event.startMinutes - DAY_START_HOUR * 60;
  const top = (offset / 60) * HOUR_HEIGHT;
  const height = ((event.endMinutes - event.startMinutes) / 60) * HOUR_HEIGHT;
  const c = KIND_STYLE[event.kind];

  return (
    <button
      onClick={onOpen}
      className={`absolute left-1 right-1 rounded-md overflow-hidden text-left ${c.bg} cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
      style={{ top, height: Math.max(height, 22) }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.bar}`} />
      <div className="pl-2.5 pr-2 py-1">
        <div className={`text-xs font-medium ${c.text} truncate flex items-center gap-1`}>
          {event.title}
          {event.externalHref && <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />}
        </div>
        {event.subtitle && (
          <div className={`text-[10px] ${c.sub} truncate`}>{event.subtitle}</div>
        )}
      </div>
    </button>
  );
}

function DraftEventBlock({
  startMinutes, title, setTitle, onCommit, onCancel,
}: {
  startMinutes: number;
  title: string;
  setTitle: (s: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const offset = startMinutes - DAY_START_HOUR * 60;
  const top = (offset / 60) * HOUR_HEIGHT;
  const height = HOUR_HEIGHT;

  return (
    <div
      className="absolute left-1 right-1 rounded-md overflow-hidden bg-[var(--color-primary-soft)] ring-2 ring-[var(--color-primary)] z-20"
      style={{ top, height }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]" />
      <div className="pl-2.5 pr-1 py-1 flex items-center gap-1">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Event name"
          className="flex-1 bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none min-w-0"
        />
        <button onClick={onCommit} className="w-5 h-5 rounded grid place-items-center hover:bg-[var(--color-primary)]/40 text-[var(--color-text)]" aria-label="Save">
          <Check className="w-3 h-3" />
        </button>
        <button onClick={onCancel} className="w-5 h-5 rounded grid place-items-center hover:bg-[var(--color-primary)]/40 text-[var(--color-text)]" aria-label="Cancel">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function MonthView({
  month, today, events, onPickDay, onOpenEvent,
}: {
  month: Date;
  today: Date;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
  onOpenEvent: (e: CalendarEvent) => void;
}) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startGrid = startOfWeek(firstOfMonth, 0);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  return (
    <div className="flex-1 overflow-auto p-2">
      <div className="grid grid-cols-7 text-xs text-[var(--color-text-subtle)] border-b border-[var(--color-border)] pb-1.5 mb-1">
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
          <div key={d} className="px-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden h-[calc(100%-2rem)] min-h-[600px]">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = isoDate(d) === isoDate(today);
          const dayEvents = eventsByDay[isoDate(d)] ?? [];
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={`text-left p-1.5 transition-colors ${
                inMonth ? "bg-[var(--color-bg)] hover:bg-[var(--color-surface-raised)]" : "bg-[var(--color-bg)]/50 hover:bg-[var(--color-surface-raised)]/50"
              }`}
            >
              <div
                className={`text-xs mb-1 ${
                  isToday
                    ? "inline-grid place-items-center w-5 h-5 rounded-full bg-[var(--color-primary)] text-white font-semibold"
                    : inMonth
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-subtle)]"
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const c = KIND_STYLE[e.kind];
                  return (
                    <span
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpenEvent(e);
                      }}
                      className={`block text-[10px] px-1.5 py-0.5 rounded truncate ${c.bg} ${c.text}`}
                    >
                      {e.title}
                    </span>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[var(--color-text-subtle)] px-1.5">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
