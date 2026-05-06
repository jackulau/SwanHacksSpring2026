/**
 * "Today" + "This week" lists rendered as a single typographic block.
 *
 * Sources: PocketBase `assignments` (Canvas-synced) + scheduled `lectures`.
 * The component splits items into a "Today" group (due/recorded today) and
 * a "This week" group (next 7 days), each rendered as a borderless list with
 * subtle row dividers — no card grid, no shadows, no pills.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { Skeleton } from "../layout/Skeleton";
import { EmptyState } from "../layout/EmptyState";
import { pb } from "../../lib/pocketbase";
import type {
  Assignment,
  Course,
  Lecture,
  CalendarEventRecord,
} from "../../lib/types";

interface UpcomingClassesProps {
  userId: string;
}

interface UpcomingItem {
  id: string;
  title: string;
  /** Short context line (course code, time, etc.). */
  meta: string;
  /** Sort key — milliseconds since epoch. */
  when: number;
  /** External URL (e.g. Canvas, meeting link) — opens in a new tab when set. */
  externalHref?: string;
  /** Internal lecture id — when set, links to /lectures/$lectureId. */
  lectureId?: string;
  /** When set, this row links into /calendar (user-created event). */
  calendarEvent?: boolean;
  /** True when this is a live/joinable meeting link. */
  isMeeting?: boolean;
}

export function UpcomingClasses({ userId }: UpcomingClassesProps) {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Anchor at start-of-day so something due at 10am still shows up in
    // "Today" when the dashboard is opened at 2pm. Without this the user
    // would lose visibility of earlier-today items as the day progressed.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startIso = startOfToday.toISOString();
    const weekAheadIso = new Date(
      startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    Promise.all([
      pb
        .collection("assignments")
        .getFullList<Assignment>({
          filter: `user = "${userId}" && due_at >= "${startIso}" && due_at <= "${weekAheadIso}"`,
          sort: "due_at",
        })
        .catch(() => [] as Assignment[]),
      pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${userId}"` })
        .catch(() => [] as Course[]),
      pb
        .collection("lectures")
        .getFullList<Lecture>({
          filter: `user = "${userId}" && recorded_at >= "${startIso}" && recorded_at <= "${weekAheadIso}"`,
          sort: "recorded_at",
        })
        .catch(() => [] as Lecture[]),
      pb
        .collection("calendar_events")
        .getFullList<CalendarEventRecord>({
          filter: `user = "${userId}" && start_at >= "${startIso}" && start_at <= "${weekAheadIso}"`,
          sort: "start_at",
        })
        .catch(() => [] as CalendarEventRecord[]),
    ]).then(([asg, courses, scheduledLectures, calEvents]) => {
      if (cancelled) return;
      const courseById = new Map(courses.map((c) => [c.id, c]));

      const fromAssignments: UpcomingItem[] = asg.map((a) => {
        const course = a.course ? courseById.get(a.course) : undefined;
        const courseLabel = course?.code || course?.name;
        return {
          id: `asg:${a.id}`,
          title: a.title,
          meta: courseLabel
            ? `${courseLabel} · ${formatDueLine(a.due_at)}`
            : formatDueLine(a.due_at),
          when: new Date(a.due_at).getTime(),
          externalHref: a.canvas_url || undefined,
          isMeeting: isMeetingLike(a.canvas_url),
        };
      });

      const fromLectures: UpcomingItem[] = scheduledLectures.map((l) => {
        const course = l.course ? courseById.get(l.course) : undefined;
        const courseLabel = course?.code || course?.name;
        return {
          id: `lec:${l.id}`,
          title: l.title || "Untitled lecture",
          meta: courseLabel
            ? `${courseLabel} · ${formatDueLine(l.recorded_at)}`
            : formatDueLine(l.recorded_at),
          when: new Date(l.recorded_at).getTime(),
          lectureId: l.id,
        };
      });

      const fromEvents: UpcomingItem[] = calEvents.map((e) => ({
        id: `evt:${e.id}`,
        title: e.title || "Untitled event",
        meta: formatDueLine(e.start_at),
        when: new Date(e.start_at).getTime(),
        externalHref: e.external_href || undefined,
        calendarEvent: !e.external_href,
        isMeeting: isMeetingLike(e.external_href),
      }));

      const merged = [...fromAssignments, ...fromLectures, ...fromEvents].sort(
        (a, b) => a.when - b.when,
      );

      setItems(merged);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const { today, thisWeek } = useMemo(() => splitToday(items), [items]);

  if (loading) {
    return (
      <section aria-label="Upcoming" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Today</h2>
        <div className="space-y-2">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section aria-label="Upcoming" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Today</h2>
        <EmptyState
          size="sm"
          icon={Calendar}
          title="Nothing scheduled"
          description="Sync Canvas in Settings to see today's classes and assignments."
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Section title="Today" emptyText="Nothing due today.">
        {today.map((item) => (
          <UpcomingRow key={item.id} item={item} />
        ))}
      </Section>

      <Section title="This week" emptyText="Nothing else this week.">
        {thisWeek.map((item) => (
          <UpcomingRow key={item.id} item={item} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode[];
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
      {children.length === 0 ? (
        <p className="text-sm text-[var(--color-text-subtle)]">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">{children}</ul>
      )}
    </section>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const tooltip = `${item.title} · ${item.meta}`;
  const titleNode = (
    <span
      className="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors"
      title={tooltip}
    >
      {item.title}
      {item.isMeeting && (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] text-[10px] font-semibold uppercase tracking-wider">
          Live
        </span>
      )}
    </span>
  );
  const metaNode = (
    <span className="shrink-0 text-xs text-[var(--color-text-subtle)] truncate max-w-[55%]">
      {item.meta}
    </span>
  );
  const rowClass =
    "flex items-baseline justify-between gap-4 py-2 text-sm group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm";

  if (item.externalHref) {
    return (
      <li>
        <a href={item.externalHref} target="_blank" rel="noreferrer" className={rowClass}>
          {titleNode}
          {metaNode}
        </a>
      </li>
    );
  }
  if (item.lectureId) {
    return (
      <li>
        <Link
          to="/lectures/$lectureId"
          params={{ lectureId: item.lectureId }}
          className={rowClass}
        >
          {titleNode}
          {metaNode}
        </Link>
      </li>
    );
  }
  if (item.calendarEvent) {
    return (
      <li>
        <Link to="/calendar" className={rowClass}>
          {titleNode}
          {metaNode}
        </Link>
      </li>
    );
  }
  return (
    <li className={rowClass}>
      {titleNode}
      {metaNode}
    </li>
  );
}

function splitToday(items: UpcomingItem[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const today: UpcomingItem[] = [];
  const thisWeek: UpcomingItem[] = [];
  for (const it of items) {
    if (it.when >= startOfToday.getTime() && it.when < startOfTomorrow.getTime()) {
      today.push(it);
    } else if (it.when >= startOfTomorrow.getTime()) {
      thisWeek.push(it);
    }
  }
  return { today, thisWeek };
}

function formatDueLine(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfDayAfter = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);
  const time = t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (t >= startOfToday && t < startOfTomorrow) return time;
  if (t >= startOfTomorrow && t < startOfDayAfter) return `Tomorrow · ${time}`;
  const date = t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${date} · ${time}`;
}

function isMeetingLike(url?: string): boolean {
  if (!url) return false;
  return /zoom\.|meet\.google|teams\.microsoft|webex\./i.test(url);
}
