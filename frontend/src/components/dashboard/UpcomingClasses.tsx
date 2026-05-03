/**
 * "Upcoming classes" panel — vertical list on the right of the dashboard.
 *
 * Sources data from the `assignments` collection (Canvas-synced) plus any
 * future scheduled lectures. Each row links into the corresponding course or
 * Canvas URL. Skeletons while loading; explicit empty state when there's
 * nothing on the horizon.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { Skeleton } from "../layout/Skeleton";
import { EmptyState } from "../layout/EmptyState";
import { pb } from "../../lib/pocketbase";
import type { Assignment, Course } from "../../lib/types";

interface UpcomingClassesProps {
  userId: string;
}

interface UpcomingItem {
  id: string;
  title: string;
  meta: string;
  href: string;
  /** When set, renders a green "Join the meeting" CTA on the first card. */
  meetingUrl?: string;
}

export function UpcomingClasses({ userId }: UpcomingClassesProps) {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      pb
        .collection("assignments")
        .getFullList<Assignment>({
          filter: `user = "${userId}" && due_at >= "${new Date().toISOString()}"`,
          sort: "due_at",
        })
        .catch(() => [] as Assignment[]),
      pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${userId}"` })
        .catch(() => [] as Course[]),
    ]).then(([asg, courses]) => {
      if (cancelled) return;
      const courseById = new Map(courses.map((c) => [c.id, c]));
      const list: UpcomingItem[] = asg.slice(0, 8).map((a, i) => {
        const course = a.course ? courseById.get(a.course) : undefined;
        return {
          id: a.id,
          title: course?.code || course?.name || a.title,
          meta: formatDueLine(a.due_at),
          href: a.canvas_url,
          // First item gets the highlight "Join the meeting" CTA when it
          // looks like a meeting URL.
          meetingUrl: i === 0 && isMeetingLike(a.canvas_url) ? a.canvas_url : undefined,
        };
      });
      setItems(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 soft-shadow flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Upcoming classes</h2>
        <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
      </div>

      {loading ? (
        <div className="space-y-3 flex-1">
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center">
          <div className="w-full">
            <EmptyState
              size="sm"
              icon={Calendar}
              title="Nothing upcoming"
              description="Sync Canvas in Settings to see classes here."
            />
          </div>
        </div>
      ) : (
        <ul className="space-y-2 flex-1">
          {items.map((item, i) => (
            <li key={item.id}>
              {i === 0 && item.meetingUrl ? (
                <a
                  href={item.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl bg-black border border-[var(--color-border)] p-3 hover:border-[var(--color-primary)]/60 transition-colors"
                >
                  <p className="text-sm font-bold text-[var(--color-primary-strong)]">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {item.meta}
                  </p>
                  {item.href && (
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                      {hostname(item.href)}
                    </p>
                  )}
                  <span className="mt-2 inline-flex w-full items-center justify-center text-xs font-semibold text-black bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-full px-3 py-1.5 transition-colors">
                    Join the meeting
                  </span>
                </a>
              ) : (
                <ItemRow item={item} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: UpcomingItem }) {
  const inner = (
    <>
      <p className="text-sm font-bold text-white truncate">{item.title}</p>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{item.meta}</p>
    </>
  );
  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-3 hover:border-[var(--color-primary)]/40 transition-colors"
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      to="/courses"
      className="block rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-3 hover:border-[var(--color-primary)]/40 transition-colors"
    >
      {inner}
    </Link>
  );
}

function formatDueLine(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  const date = t.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = t.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} @ ${time}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isMeetingLike(url?: string): boolean {
  if (!url) return false;
  return /zoom\.|meet\.google|teams\.microsoft|webex\./i.test(url);
}
