import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Lecture, Assignment, CalendarEventRecord } from "../lib/types";
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
  Trash2,
  Sparkles,
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
  /** PocketBase record id for user-created events (kind === "user"). */
  recordId?: string;
  title: string;
  subtitle?: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  kind: EventKind;
  href?: string;
  externalHref?: string;
  /** Free-form notes attached to a user event. Persisted via PB. */
  notes?: string;
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

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Format a yyyy-mm-dd ISO date into a friendly preview label:
 * "Today", "Tomorrow", or "Mon, May 6". Used by the natural-language bar.
 */
function humanizePreviewDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return target.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Convert ISO date (yyyy-mm-dd) + minute-of-day into an ISO timestamp. */
function localDateTimeToIso(date: string, minutes: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const hr = Math.floor(minutes / 60);
  const min = minutes % 60;
  const local = new Date(y, (m || 1) - 1, d || 1, hr, min, 0, 0);
  return local.toISOString();
}

/** Format a minute-of-day as "HH:MM" for <input type="time"> values. */
function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse a "HH:MM" <input type="time"> value into minutes-of-day. */
function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Best-effort natural-language event parser. Lossy by design — if we can't
 * confidently extract a date or time, we surface the raw title and let the
 * user edit it inline. Recognises:
 *   - relative dates: today, tonight, tomorrow, "next mon", weekday names
 *   - times: "3pm", "3:30pm", "15:00", "at 9", "from 9-11"
 *   - duration: "for 90m", "for 2h"
 * Returns null when the input is empty.
 */
export interface ParsedNLEvent {
  title: string;
  date: string; // yyyy-mm-dd
  startMinutes: number;
  endMinutes: number;
  /** True when the parser had to guess a default time. UI shows a chip. */
  inferredTime: boolean;
}

const DOW_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseNaturalEvent(input: string, now: Date = new Date()): ParsedNLEvent | null {
  const raw = input.trim();
  if (!raw) return null;
  let working = raw;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = today;

  // Relative-date keywords (consume them so they don't pollute the title).
  const re = (pat: RegExp): RegExpMatchArray | null => working.match(pat);
  if (re(/\btomorrow\b/i)) {
    date = addDays(today, 1);
    working = working.replace(/\btomorrow\b/i, "");
  } else if (re(/\btonight\b/i)) {
    date = today;
    working = working.replace(/\btonight\b/i, "");
  } else if (re(/\btoday\b/i)) {
    date = today;
    working = working.replace(/\btoday\b/i, "");
  } else {
    const nextMatch = working.match(/\bnext\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);
    const onlyMatch = working.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);
    const wkMatch = nextMatch ?? onlyMatch;
    if (wkMatch) {
      const idx = DOW_NAMES.findIndex((d) => d.startsWith(wkMatch[1].toLowerCase()));
      if (idx >= 0) {
        const cur = today.getDay();
        let delta = (idx - cur + 7) % 7;
        if (delta === 0 || nextMatch) delta = delta === 0 ? 7 : delta;
        date = addDays(today, delta);
        working = working.replace(wkMatch[0], "");
      }
    }
  }

  // Time + duration. Accept "at 9", "9pm", "9:30am", "from 9-11", "9-11am".
  let inferredTime = true;
  let startMinutes = 9 * 60;
  let endMinutes = 10 * 60;

  const rangeMatch = working.match(
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (rangeMatch) {
    const aH = parseInt(rangeMatch[1], 10);
    const aM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const bH = parseInt(rangeMatch[3], 10);
    const bM = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;
    const meridiem = rangeMatch[5]?.toLowerCase();
    const apply = (h: number, isStart: boolean) => {
      if (meridiem === "pm" && h < 12) return h + 12;
      if (meridiem === "am" && h === 12) return 0;
      // No meridiem: assume AM for morning hours (<8 → PM heuristic skipped),
      // PM for ambiguous "1-3" because students study afternoons.
      if (!meridiem && h >= 1 && h <= 7 && isStart) return h + 12;
      return h;
    };
    startMinutes = apply(aH, true) * 60 + aM;
    endMinutes = apply(bH, false) * 60 + bM;
    if (endMinutes <= startMinutes) endMinutes = startMinutes + 60;
    inferredTime = false;
    working = working.replace(rangeMatch[0], "");
  } else {
    const timeMatch = working.match(
      /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    );
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const mer = timeMatch[3]?.toLowerCase();
      if (mer === "pm" && h < 12) h += 12;
      else if (mer === "am" && h === 12) h = 0;
      else if (!mer && h >= 1 && h <= 7) h += 12; // afternoon heuristic
      if (h >= 0 && h < 24 && m >= 0 && m < 60 && timeMatch[1].length <= 2) {
        startMinutes = h * 60 + m;
        endMinutes = startMinutes + 60;
        inferredTime = false;
        working = working.replace(timeMatch[0], "");
      }
    }
  }

  const durationMatch = working.match(/\bfor\s+(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\b/i);
  if (durationMatch) {
    const n = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    const minutes = unit.startsWith("h") ? n * 60 : n;
    endMinutes = startMinutes + Math.max(15, minutes);
    working = working.replace(durationMatch[0], "");
  }

  const title = working.replace(/\s{2,}/g, " ").replace(/^[\s,-]+|[\s,-]+$/g, "").trim() || raw;

  return {
    title,
    date: isoDate(date),
    startMinutes,
    endMinutes,
    inferredTime,
  };
}

/** Convert a CalendarEventRecord (PB) into a CalendarEvent (local). */
function recordToEvent(rec: CalendarEventRecord): CalendarEvent | null {
  const start = new Date(rec.start_at);
  const end = new Date(rec.end_at);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return {
    id: `usr-${rec.id}`,
    recordId: rec.id,
    title: rec.title,
    date: isoDate(start),
    startMinutes,
    endMinutes: endMinutes > startMinutes ? endMinutes : startMinutes + 60,
    kind: "user",
    notes: rec.notes ?? "",
    externalHref: rec.external_href || undefined,
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
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [nlInput, setNlInput] = useState("");
  const [nlOpen, setNlOpen] = useState(false);
  const nlRef = useRef<HTMLInputElement | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<Record<EventKind, boolean>>({
    lecture: true,
    assignment: true,
    user: true,
  });

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
        .getFullList<Lecture>({ filter: `user = "${user.id}"`, requestKey: "cal-lectures" })
        .catch(() => [] as Lecture[]),
      pb
        .collection("assignments")
        .getFullList<Assignment>({ filter: `user = "${user.id}"`, requestKey: "cal-assignments" })
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

  // Load user-created events from PocketBase. Failures fall back to empty list
  // — the UI still works locally, the user just won't see persisted events.
  useEffect(() => {
    if (!user) {
      setUserEvents([]);
      return;
    }
    let cancelled = false;
    pb.collection("calendar_events")
      .getFullList<CalendarEventRecord>({
        filter: `user = "${user.id}"`,
        requestKey: "cal-user-events",
      })
      .then((records) => {
        if (cancelled) return;
        const mapped: CalendarEvent[] = [];
        for (const r of records) {
          const ev = recordToEvent(r);
          if (ev) mapped.push(ev);
        }
        setUserEvents(mapped);
      })
      .catch(() => {
        // Collection may not exist yet (pre-migration). Fall back to empty.
        if (!cancelled) setUserEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const events = useMemo(
    () =>
      [...remoteEvents, ...userEvents].filter((e) => visibleKinds[e.kind]),
    [remoteEvents, userEvents, visibleKinds],
  );

  const visibleDays = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const sun = startOfWeek(anchor, 0);
      return Array.from({ length: 7 }, (_, i) => addDays(sun, i));
    }
    const mon = startOfWeek(anchor, 1);
    return Array.from({ length: 5 }, (_, i) => addDays(mon, i));
  }, [anchor, view]);

  // Keep the mini-month in sync with the visible anchor month so navigating
  // weeks/days across a month boundary doesn't leave the sidebar stale.
  useEffect(() => {
    if (
      anchor.getFullYear() !== miniMonth.getFullYear() ||
      anchor.getMonth() !== miniMonth.getMonth()
    ) {
      setMiniMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

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

  /**
   * Render the draft input visibly regardless of current view bounds.
   *
   * The toolbar "+ New event" button anchors to today / now, but the user can
   * be looking at school-week (no weekend columns) or be past DAY_END_HOUR.
   * Clamp the day to the first visible day in the current grid, and clamp
   * the hour into [DAY_START_HOUR, DAY_END_HOUR - 1] so the input always lands
   * in view.
   */
  const handleSlotClick = (date: string, hour: number) => {
    const visibleKeys = visibleDays.map(isoDate);
    const clampedDate = visibleKeys.includes(date) ? date : visibleKeys[0] ?? date;
    const clampedHour = Math.min(
      Math.max(hour, DAY_START_HOUR),
      DAY_END_HOUR - 1,
    );
    setCreating({ date: clampedDate, startMinutes: clampedHour * 60 });
    setDraftTitle("");
  };

  const commitEvent = async () => {
    if (!creating || !draftTitle.trim() || !user) {
      setCreating(null);
      return;
    }
    const title = draftTitle.trim();
    const startMinutes = creating.startMinutes;
    const endMinutes = startMinutes + 60;
    const date = creating.date;
    setCreating(null);
    setDraftTitle("");

    try {
      const rec = await pb.collection("calendar_events").create<CalendarEventRecord>({
        user: user.id,
        title,
        start_at: localDateTimeToIso(date, startMinutes),
        end_at: localDateTimeToIso(date, endMinutes),
        notes: "",
        color: "",
        external_href: "",
      });
      const ev = recordToEvent(rec);
      if (ev) setUserEvents((prev) => [...prev, ev]);
    } catch {
      // PB write failed (collection missing, offline, etc.) — fall back to a
      // local-only event so the UX doesn't lose the user's input.
      setUserEvents((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          title,
          date,
          startMinutes,
          endMinutes,
          kind: "user",
        },
      ]);
    }
  };

  const openEvent = (e: CalendarEvent) => {
    // User events always open the edit modal — even when they carry an
    // external link, so the student can change the time / notes / link
    // without first clearing the URL. The modal still has its own "Open" CTA.
    if (e.kind === "user") {
      setEditing(e);
      return;
    }
    if (e.href) navigate({ to: e.href });
    else if (e.externalHref) window.open(e.externalHref, "_blank", "noopener,noreferrer");
  };

  const saveEditedEvent = async (updated: CalendarEvent) => {
    setUserEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditing(null);
    if (!updated.recordId) return;
    try {
      await pb.collection("calendar_events").update(updated.recordId, {
        title: updated.title,
        start_at: localDateTimeToIso(updated.date, updated.startMinutes),
        end_at: localDateTimeToIso(updated.date, updated.endMinutes),
        notes: updated.notes ?? "",
        external_href: updated.externalHref ?? "",
      });
    } catch {
      // Persistence failure — local state already updated. No retry queue.
    }
  };

  const deleteEditedEvent = async (target: CalendarEvent) => {
    setUserEvents((prev) => prev.filter((e) => e.id !== target.id));
    setEditing(null);
    if (!target.recordId) return;
    try {
      await pb.collection("calendar_events").delete(target.recordId);
    } catch {
      // Persistence failure — local state already removed.
    }
  };

  const toggleKind = (kind: EventKind) => {
    setVisibleKinds((prev) => ({ ...prev, [kind]: !prev[kind] }));
  };

  const submitNaturalEvent = useCallback(async () => {
    const parsed = parseNaturalEvent(nlInput, new Date());
    if (!parsed || !user) return;
    setNlInput("");
    setNlOpen(false);
    try {
      const rec = await pb.collection("calendar_events").create<CalendarEventRecord>({
        user: user.id,
        title: parsed.title,
        start_at: localDateTimeToIso(parsed.date, parsed.startMinutes),
        end_at: localDateTimeToIso(parsed.date, parsed.endMinutes),
        notes: parsed.inferredTime ? "Time inferred — edit to confirm." : "",
        color: "",
        external_href: "",
      });
      const ev = recordToEvent(rec);
      if (ev) {
        setUserEvents((prev) => [...prev, ev]);
        // Pan calendar to the event date so the user sees the result.
        const [y, m, d] = parsed.date.split("-").map(Number);
        setAnchor(new Date(y, (m || 1) - 1, d || 1));
      }
    } catch {
      // Local fallback so input never feels lost.
      setUserEvents((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          title: parsed.title,
          date: parsed.date,
          startMinutes: parsed.startMinutes,
          endMinutes: parsed.endMinutes,
          kind: "user",
        },
      ]);
    }
  }, [nlInput, user]);

  // View-level keyboard shortcuts (T today, arrows, 1-4 view, N new event,
  // / focus quick-add). All shortcuts are no-ops while a field is focused.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "t":
          e.preventDefault();
          goToday();
          return;
        case "arrowleft":
          e.preventDefault();
          navigateRange(-1);
          return;
        case "arrowright":
          e.preventDefault();
          navigateRange(1);
          return;
        case "1":
          e.preventDefault();
          setView("day");
          return;
        case "2":
          e.preventDefault();
          setView("schoolWeek");
          return;
        case "3":
          e.preventDefault();
          setView("week");
          return;
        case "4":
          e.preventDefault();
          setView("month");
          return;
        case "n":
          e.preventDefault();
          if (view === "month") setView("day");
          handleSlotClick(isoDate(anchor), new Date().getHours());
          return;
        case "/":
          e.preventDefault();
          setNlOpen(true);
          window.setTimeout(() => nlRef.current?.focus(), 0);
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Top toolbar */}
      <div className="flex items-center gap-1 px-4 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] shrink-0 overflow-x-auto">
        {nlOpen ? (
          <NaturalLanguageBar
            inputRef={nlRef}
            value={nlInput}
            onChange={setNlInput}
            onSubmit={submitNaturalEvent}
            onClose={() => {
              setNlOpen(false);
              setNlInput("");
            }}
          />
        ) : (
          <>
            <button
              onClick={() => {
                setNlOpen(true);
                window.setTimeout(() => nlRef.current?.focus(), 0);
              }}
              className="flex items-center gap-2 px-3 h-8 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium transition-colors shrink-0"
              title="New event — try natural language like 'Bio review tomorrow 3pm'"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              New event
              <kbd className="hidden sm:inline px-1 py-0.5 text-[10px] font-mono rounded bg-white/15 text-white/85">/</kbd>
            </button>
            <button
              onClick={() => {
                // The draft block only renders inside WeekGrid, so jump out of
                // month view first — otherwise "Blank slot" silently no-ops.
                if (view === "month") setView("day");
                handleSlotClick(isoDate(anchor), new Date().getHours());
              }}
              className="px-2.5 h-8 rounded-md hover:bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
              title="Drop a blank event at the current hour (n)"
            >
              Blank slot
            </button>
          </>
        )}

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
              <CalendarLegendRow
                color="var(--color-primary)"
                label="Lectures"
                count={remoteEvents.filter((e) => e.kind === "lecture").length}
                visible={visibleKinds.lecture}
                onToggle={() => toggleKind("lecture")}
              />
              <CalendarLegendRow
                color="rgb(251 191 36)"
                label="Assignments"
                count={remoteEvents.filter((e) => e.kind === "assignment").length}
                visible={visibleKinds.assignment}
                onToggle={() => toggleKind("assignment")}
              />
              <CalendarLegendRow
                color="var(--color-text-subtle)"
                label="Personal"
                count={userEvents.length}
                visible={visibleKinds.user}
                onToggle={() => toggleKind("user")}
              />
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
              <CalendarIcon className="w-3.5 h-3.5" aria-hidden="true" />
              Today
            </button>
            <button onClick={() => navigateRange(-1)} className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] grid place-items-center" aria-label="Previous">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button onClick={() => navigateRange(1)} className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] grid place-items-center" aria-label="Next">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <h1 className="text-base font-semibold text-[var(--color-text)] ml-1">{rangeLabel}</h1>

            <div className="ml-auto text-xs text-[var(--color-text-subtle)] tabular-nums">
              {loading
                ? "Syncing…"
                : `${events.length.toLocaleString()} ${events.length === 1 ? "event" : "events"}`}
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

      {editing && (
        <EditEventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSave={saveEditedEvent}
          onDelete={deleteEditedEvent}
        />
      )}
    </div>
  );
}

function NaturalLanguageBar({
  inputRef,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const preview = useMemo(() => parseNaturalEvent(value, new Date()), [value]);
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Sparkles className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Try: 'Bio review tomorrow 3pm for 90m'"
        className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
        aria-label="Natural-language event input"
      />
      {preview && value.trim() && (
        <span
          className="hidden md:inline text-[11px] text-[var(--color-text-subtle)] truncate max-w-[280px]"
          aria-live="polite"
        >
          → <strong className="text-[var(--color-text-muted)] font-medium">{preview.title}</strong>
          {" · "}
          {humanizePreviewDate(preview.date)} {fmtTime(preview.startMinutes)}
          {preview.inferredTime && <span className="ml-1 text-[var(--color-warning)]">(time guess)</span>}
        </span>
      )}
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="px-3 h-7 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors shrink-0"
      >
        Add
      </button>
      <button
        onClick={onClose}
        aria-label="Close quick-add"
        className="w-7 h-7 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
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

function CalendarLegendRow({
  color,
  label,
  count,
  visible,
  onToggle,
}: {
  color: string;
  label: string;
  count: number;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      className={`flex items-center gap-2.5 w-full px-2 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-raised)] transition-colors ${
        visible ? "text-[var(--color-text)]" : "text-[var(--color-text-subtle)]"
      }`}
    >
      <span
        className={`w-3 h-3 rounded-sm shrink-0 transition-opacity ${visible ? "opacity-100" : "opacity-30"}`}
        style={{ background: color }}
      />
      <span className={`flex-1 text-left ${visible ? "" : "line-through"}`}>{label}</span>
      <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">{count}</span>
    </button>
  );
}

function EditEventModal({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onSave: (updated: CalendarEvent) => void;
  onDelete: (target: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [startTime, setStartTime] = useState(minutesToTimeInput(event.startMinutes));
  const [endTime, setEndTime] = useState(minutesToTimeInput(event.endMinutes));
  const [notes, setNotes] = useState(event.notes ?? "");
  const [externalHref, setExternalHref] = useState(event.externalHref ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    const startMinutes = timeInputToMinutes(startTime);
    const endRaw = timeInputToMinutes(endTime);
    const endMinutes = endRaw > startMinutes ? endRaw : startMinutes + 60;
    // Lightweight URL hygiene — accept blank, otherwise require a scheme.
    const href = externalHref.trim();
    const cleanHref = !href
      ? ""
      : /^https?:\/\//i.test(href)
        ? href
        : `https://${href}`;
    onSave({
      ...event,
      title: title.trim(),
      date,
      startMinutes,
      endMinutes,
      notes: notes,
      externalHref: cleanHref || undefined,
    });
  };

  // Submit on Cmd/Ctrl+Enter; Escape closes from inside any field.
  const onModalKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit event"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onModalKeyDown}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Edit event</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-[var(--color-text-muted)] mb-1">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-[var(--color-text-muted)] mb-1">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">Link (optional)</span>
            <input
              type="url"
              inputMode="url"
              value={externalHref}
              onChange={(e) => setExternalHref(e.target.value)}
              placeholder="meeting link, study guide, lecture URL…"
              className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this event…"
              rows={3}
              className="w-full px-2 py-1.5 rounded-md bg-[var(--color-input)] text-sm text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] leading-6 resize-y"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-muted)]">
                Delete <span className="font-semibold text-[var(--color-text)]">{event.title || "this event"}</span>?
              </span>
              <button
                type="button"
                onClick={() => onDelete(event)}
                autoFocus
                className="text-[var(--color-record)] font-semibold px-2 h-7 rounded-md hover:bg-[var(--color-record)]/10"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 h-7 rounded-md"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium text-[var(--color-record)] hover:bg-[var(--color-record)]/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Delete
            </button>
          )}
          <div className="flex items-center gap-2">
            {externalHref.trim() && (
              <a
                href={
                  /^https?:\/\//i.test(externalHref.trim())
                    ? externalHref.trim()
                    : `https://${externalHref.trim()}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Open
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-8 rounded-md text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 h-8 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-medium transition-colors"
              title="Cmd/Ctrl + Enter"
            >
              Save
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[var(--color-text-subtle)] text-right">
          <kbd className="font-mono">{isMacPlatform() ? "⌘↵" : "Ctrl ↵"}</kbd> save · <kbd className="font-mono">esc</kbd> cancel
        </p>
      </div>
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
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button onClick={onNext} className="w-6 h-6 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] grid place-items-center" aria-label="Next month">
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initial scroll: anchor to current hour (or DAY_START_HOUR if before window)
  // so today's calendar opens with "now" visible instead of starting at 8 AM.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowHour = new Date().getHours();
    const targetHour = Math.max(DAY_START_HOUR, Math.min(DAY_END_HOUR - 2, nowHour - 1));
    const top = (targetHour - DAY_START_HOUR) * HOUR_HEIGHT;
    el.scrollTop = top;
    // Run only on first mount of the grid; subsequent view changes shouldn't
    // jump the user's scroll position back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const k of dayKeys) map[k] = [];
    for (const e of events) if (map[e.date]) map[e.date].push(e);
    return map;
  }, [events, dayKeys]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
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
                {hours.map((h) => {
                  const dayLabel = d.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  });
                  return (
                    <button
                      key={h}
                      onClick={() => onSlotClick(key, h)}
                      className="block w-full border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-raised)]/40 transition-colors"
                      style={{ height: HOUR_HEIGHT }}
                      aria-label={`Create event on ${dayLabel} at ${fmtTime(h * 60)}`}
                    />
                  );
                })}
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
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Refresh on the next minute boundary, then every 60s. Without this the
    // line freezes at the moment the user opened the calendar.
    const msUntilMinute = 60_000 - (Date.now() % 60_000);
    let interval: number | undefined;
    const tick = () => setNow(new Date());
    const initial = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, msUntilMinute);
    return () => {
      window.clearTimeout(initial);
      if (interval) window.clearInterval(interval);
    };
  }, []);
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
  const isShort = height < 36;
  const timeRange = `${fmtTime(event.startMinutes)} – ${fmtTime(event.endMinutes)}`;

  return (
    <button
      onClick={onOpen}
      title={`${event.title} · ${timeRange}`}
      className={`absolute left-1 right-1 rounded-md overflow-hidden text-left ${c.bg} cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
      style={{ top, height: Math.max(height, 22) }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.bar}`} />
      <div className="pl-2.5 pr-2 py-1">
        <div className={`text-xs font-medium ${c.text} truncate flex items-center gap-1`}>
          {event.title}
          {event.externalHref && <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />}
        </div>
        {!isShort && (
          <div className={`text-[10px] ${c.sub} truncate`}>
            {event.subtitle ? event.subtitle : timeRange}
          </div>
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
          // Cell is a div, not a button — event chips inside are interactive
          // and the day-number is a separate keyboard target. Avoids the
          // nested-button accessibility/HTML violation.
          return (
            <div
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={`text-left p-1.5 transition-colors cursor-pointer ${
                inMonth ? "bg-[var(--color-bg)] hover:bg-[var(--color-surface-raised)]" : "bg-[var(--color-bg)]/50 hover:bg-[var(--color-surface-raised)]/50"
              }`}
            >
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPickDay(d);
                }}
                aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                className={`text-xs mb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-full ${
                  isToday
                    ? "inline-grid place-items-center w-5 h-5 rounded-full bg-[var(--color-primary)] text-white font-semibold"
                    : inMonth
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-subtle)]"
                }`}
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const c = KIND_STYLE[e.kind];
                  return (
                    <button
                      key={e.id}
                      type="button"
                      title={`${e.title} · ${fmtTime(e.startMinutes)}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpenEvent(e);
                      }}
                      className={`block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${c.bg} ${c.text}`}
                    >
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[var(--color-text-subtle)] px-1.5">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
