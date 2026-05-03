import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import {
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Columns,
  Filter,
  Share2,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  CalendarCheck,
  Check,
  X,
  Repeat,
} from "lucide-react";

export const Route = createFileRoute("/calendar")({
  component: () => (
    <AppShell>
      <CalendarPage />
    </AppShell>
  ),
});

type ViewMode = "day" | "schoolWeek" | "week" | "month";

type CalendarEvent = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  color: string;
  recurring?: boolean;
};

const HOUR_HEIGHT = 56;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

const COLOR_CLASSES: Record<string, { bg: string; bar: string; text: string; sub: string }> = {
  indigo: { bg: "bg-indigo-500/15 hover:bg-indigo-500/25", bar: "bg-indigo-400", text: "text-indigo-100", sub: "text-indigo-300/80" },
  emerald: { bg: "bg-emerald-500/15 hover:bg-emerald-500/25", bar: "bg-emerald-400", text: "text-emerald-100", sub: "text-emerald-300/80" },
  rose: { bg: "bg-rose-500/15 hover:bg-rose-500/25", bar: "bg-rose-400", text: "text-rose-100", sub: "text-rose-300/80" },
  amber: { bg: "bg-amber-500/15 hover:bg-amber-500/25", bar: "bg-amber-400", text: "text-amber-100", sub: "text-amber-300/80" },
  sky: { bg: "bg-sky-500/15 hover:bg-sky-500/25", bar: "bg-sky-400", text: "text-sky-100", sub: "text-sky-300/80" },
  violet: { bg: "bg-violet-500/15 hover:bg-violet-500/25", bar: "bg-violet-400", text: "text-violet-100", sub: "text-violet-300/80" },
};

function seedEvents(anchor: Date): CalendarEvent[] {
  const monday = startOfWeek(anchor, 1);
  const day = (offset: number) => isoDate(addDays(monday, offset));
  return [
    { id: "1", title: "CS 301 Lecture", subtitle: "Prof. Kim · Room 204", date: day(0), startMinutes: 10 * 60, endMinutes: 11 * 60 + 15, color: "indigo", recurring: true },
    { id: "2", title: "Champ and Lauren 1:1", subtitle: "Myers, Lauren", date: day(0), startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, color: "violet", recurring: true },
    { id: "3", title: "Study Group", subtitle: "Library, 3rd floor", date: day(1), startMinutes: 14 * 60, endMinutes: 15 * 60 + 30, color: "emerald" },
    { id: "4", title: "Office Hours", subtitle: "Dr. Patel", date: day(2), startMinutes: 11 * 60, endMinutes: 12 * 60, color: "sky" },
    { id: "5", title: "Project Standup", date: day(2), startMinutes: 13 * 60, endMinutes: 13 * 60 + 30, color: "amber", recurring: true },
    { id: "6", title: "Calc II Quiz", subtitle: "Bring scantron", date: day(3), startMinutes: 9 * 60, endMinutes: 10 * 60, color: "rose" },
    { id: "7", title: "Capstone Sync", date: day(4), startMinutes: 15 * 60, endMinutes: 16 * 60, color: "indigo" },
  ];
}

function CalendarPage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [anchor, setAnchor] = useState<Date>(today);
  const [view, setView] = useState<ViewMode>("schoolWeek");
  const [miniMonth, setMiniMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>(() => seedEvents(today));
  const [selectedCalendars, setSelectedCalendars] = useState({
    main: true,
    school: true,
    personal: true,
  });
  const [creating, setCreating] = useState<{ date: string; startMinutes: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

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

  const navigate = (dir: -1 | 1) => {
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
    setEvents([
      ...events,
      {
        id: Math.random().toString(36).slice(2),
        title: draftTitle.trim(),
        date: creating.date,
        startMinutes: creating.startMinutes,
        endMinutes: creating.startMinutes + 60,
        color: "indigo",
      },
    ]);
    setCreating(null);
    setDraftTitle("");
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-1 px-4 h-12 border-b border-zinc-800 bg-zinc-900/40 shrink-0 overflow-x-auto">
        <button
          onClick={() => handleSlotClick(isoDate(anchor), 9)}
          className="flex items-center gap-2 px-3 h-8 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New event
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        <ToolbarToggle icon={CalendarIcon} label="Day" active={view === "day"} onClick={() => setView("day")} />
        <ToolbarToggle icon={CalendarRange} label="School week" active={view === "schoolWeek"} onClick={() => setView("schoolWeek")} />
        <ToolbarToggle icon={CalendarDays} label="Week" active={view === "week"} onClick={() => setView("week")} />
        <ToolbarToggle icon={CalendarRange} label="Month" active={view === "month"} onClick={() => setView("month")} />
        <ToolbarToggle icon={Columns} label="Split view" active={false} onClick={() => {}} disabled />

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        <button className="flex items-center gap-2 px-3 h-8 rounded-md bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 text-sm transition-colors shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Filter applied
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        <ToolbarButton icon={Share2} label="Share" />
        <ToolbarButton icon={Printer} label="Print" />

        <div className="ml-auto" />
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 border-r border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
          <MiniMonth
            month={miniMonth}
            selected={anchor}
            today={today}
            onPrev={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}
            onNext={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}
            onPick={(d) => setAnchor(d)}
          />

          <nav className="px-3 py-2 space-y-0.5">
            <SidebarLink icon={CalendarPlus} label="Add calendar" />
            <SidebarLink icon={CalendarCheck} label="Go to my booking page" />
          </nav>

          <div className="px-3 mt-4">
            <button className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wide w-full">
              <ChevronDown className="w-3.5 h-3.5" />
              My calendars
            </button>
            <div className="mt-2 space-y-0.5">
              <CalendarToggle
                color="indigo"
                label="Calendar"
                checked={selectedCalendars.main}
                onChange={(v) => setSelectedCalendars({ ...selectedCalendars, main: v })}
              />
              <CalendarToggle
                color="emerald"
                label="School"
                checked={selectedCalendars.school}
                onChange={(v) => setSelectedCalendars({ ...selectedCalendars, school: v })}
              />
              <CalendarToggle
                color="rose"
                label="Personal"
                checked={selectedCalendars.personal}
                onChange={(v) => setSelectedCalendars({ ...selectedCalendars, personal: v })}
              />
              <button className="w-full text-left px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Show all
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-800 shrink-0">
            <button
              onClick={goToday}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition-colors"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Today
            </button>
            <button onClick={() => navigate(-1)} className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white grid place-items-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => navigate(1)} className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white grid place-items-center">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h1 className="text-base font-semibold text-zinc-100 ml-1">{rangeLabel}</h1>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />

            <div className="ml-auto flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-zinc-800/60 text-xs text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              In office
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
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex items-center gap-1.5 px-2.5 h-8 rounded-md hover:bg-zinc-800 text-zinc-300 text-sm transition-colors shrink-0">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
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
          ? "bg-zinc-800 text-white ring-1 ring-zinc-700"
          : disabled
          ? "text-zinc-600 cursor-not-allowed"
          : "hover:bg-zinc-800 text-zinc-300"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function SidebarLink({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
      <Icon className="w-4 h-4 text-zinc-400" />
      {label}
    </button>
  );
}

function CalendarToggle({
  color, label, checked, onChange,
}: {
  color: keyof typeof COLOR_CLASSES;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
    >
      <span
        className={`w-4 h-4 rounded grid place-items-center transition-colors ${
          checked ? COLOR_CLASSES[color].bar : "border border-zinc-600"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-zinc-900" strokeWidth={3} />}
      </span>
      {label}
    </button>
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
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <button className="flex items-center gap-1 text-sm font-semibold text-zinc-100 hover:text-white">
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          {monthLabel}
        </button>
        <div className="flex items-center">
          <button onClick={onPrev} className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 grid place-items-center">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onNext} className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 grid place-items-center">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-zinc-500 mb-1">
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
                  ? "bg-indigo-600 text-white font-semibold"
                  : isToday
                  ? "bg-zinc-800 text-white"
                  : inMonth
                  ? "text-zinc-300 hover:bg-zinc-800"
                  : "text-zinc-600 hover:bg-zinc-800/50"
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
  days, today, events, creating, draftTitle, setDraftTitle, onCommit, onCancel, onSlotClick,
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
          className="grid sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const isToday = isoDate(d) === isoDate(today);
            return (
              <div key={d.toISOString()} className="px-3 py-2 border-l border-zinc-800">
                <div className={`text-2xl font-light ${isToday ? "text-indigo-400" : "text-zinc-200"}`}>
                  {d.getDate()}
                </div>
                <div className={`text-xs ${isToday ? "text-indigo-400" : "text-zinc-500"}`}>
                  {DOW_FULL[d.getDay()]}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))`,
          }}
        >
          <div className="border-r border-zinc-800">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2 text-[10px] text-zinc-500 uppercase tracking-wide">
                  {fmtTime(h * 60)}
                </span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const key = isoDate(d);
            const isToday = isoDate(d) === isoDate(today);
            return (
              <div key={key} className="relative border-l border-zinc-800">
                {hours.map((h) => (
                  <button
                    key={h}
                    onClick={() => onSlotClick(key, h)}
                    className="block w-full border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {isToday && <NowLine />}
                {eventsByDay[key]?.map((e) => (
                  <EventBlock key={e.id} event={e} />
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
        <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
        <div className="flex-1 h-px bg-rose-500" />
      </div>
    </div>
  );
}

function EventBlock({ event }: { event: CalendarEvent }) {
  const offset = event.startMinutes - DAY_START_HOUR * 60;
  const top = (offset / 60) * HOUR_HEIGHT;
  const height = ((event.endMinutes - event.startMinutes) / 60) * HOUR_HEIGHT;
  const c = COLOR_CLASSES[event.color] ?? COLOR_CLASSES.indigo;

  return (
    <div
      className={`absolute left-1 right-1 rounded-md overflow-hidden ${c.bg} cursor-pointer transition-colors group`}
      style={{ top, height: Math.max(height, 22) }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.bar}`} />
      <div className="pl-2.5 pr-2 py-1">
        <div className={`text-xs font-medium ${c.text} truncate flex items-center gap-1`}>
          {event.title}
          {event.recurring && <Repeat className="w-3 h-3 opacity-60 shrink-0" />}
        </div>
        {event.subtitle && (
          <div className={`text-[10px] ${c.sub} truncate`}>{event.subtitle}</div>
        )}
      </div>
    </div>
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
      className="absolute left-1 right-1 rounded-md overflow-hidden bg-indigo-500/25 ring-2 ring-indigo-400 z-20"
      style={{ top, height }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400" />
      <div className="pl-2.5 pr-1 py-1 flex items-center gap-1">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Add title"
          className="flex-1 bg-transparent text-xs text-white placeholder:text-indigo-200/60 focus:outline-none min-w-0"
        />
        <button onClick={onCommit} className="w-5 h-5 rounded grid place-items-center hover:bg-indigo-400/40 text-white">
          <Check className="w-3 h-3" />
        </button>
        <button onClick={onCancel} className="w-5 h-5 rounded grid place-items-center hover:bg-indigo-400/40 text-white">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function MonthView({
  month, today, events, onPickDay,
}: {
  month: Date;
  today: Date;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
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
      <div className="grid grid-cols-7 text-xs text-zinc-500 border-b border-zinc-800 pb-1.5 mb-1">
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
          <div key={d} className="px-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden h-[calc(100%-2rem)] min-h-[600px]">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = isoDate(d) === isoDate(today);
          const dayEvents = eventsByDay[isoDate(d)] ?? [];
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={`text-left p-1.5 transition-colors ${
                inMonth ? "bg-zinc-950 hover:bg-zinc-900" : "bg-zinc-950/50 hover:bg-zinc-900/50"
              }`}
            >
              <div
                className={`text-xs mb-1 ${
                  isToday
                    ? "inline-grid place-items-center w-5 h-5 rounded-full bg-indigo-600 text-white font-semibold"
                    : inMonth
                    ? "text-zinc-300"
                    : "text-zinc-600"
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const c = COLOR_CLASSES[e.color] ?? COLOR_CLASSES.indigo;
                  return (
                    <div
                      key={e.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate ${c.bg} ${c.text}`}
                    >
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-zinc-500 px-1.5">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
