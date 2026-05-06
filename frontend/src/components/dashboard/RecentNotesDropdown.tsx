/**
 * "Recent Notes" component.
 *
 * Two render variants:
 *   • `sidebar` — collapsible list rendered inside the AppShell sidebar.
 *   • `card`    — typographic list rendered inside the dashboard body.
 *
 * The dashboard variant used to be a grid of thumbnail cards, which read
 * as "AI card spam". It's now a simple typographic list with subtle row
 * dividers — same data, much quieter visual surface.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, NotebookPen, FileText } from "lucide-react";
import type { Lecture } from "../../lib/types";
import { Skeleton } from "../layout/Skeleton";
import { EmptyState } from "../layout/EmptyState";

interface RecentNotesDropdownProps {
  lectures: Lecture[];
  loading: boolean;
  /** Render style: `card` is the dashboard list; `sidebar` is the compact sidebar dropdown. */
  variant?: "card" | "sidebar";
  /** Defaults closed. Sidebar variant is uncontrolled and remembers state across renders. */
  defaultOpen?: boolean;
  /** Hide all chrome and only render the list — used when the parent owns the title row. */
  hideHeader?: boolean;
  /** Maximum number of lectures shown when expanded. */
  limit?: number;
}

export function RecentNotesDropdown({
  lectures,
  loading,
  variant = "card",
  defaultOpen = false,
  hideHeader = false,
  limit = 5,
}: RecentNotesDropdownProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  const activeLectureId =
    pathname.startsWith("/lectures/")
      ? pathname.split("/")[2]
      : null;

  useEffect(() => {
    if (defaultOpen !== undefined) setOpen(defaultOpen);
  }, [defaultOpen]);

  // Auto-open when the user is reading a lecture so the active one is visible.
  useEffect(() => {
    if (activeLectureId && variant === "sidebar") setOpen(true);
  }, [activeLectureId, variant]);

  const items = lectures.slice(0, limit);

  // ── Sidebar variant ─────────────────────────────────────────────────
  if (variant === "sidebar") {
    return (
      <div>
        <div className="flex items-center mx-1">
          <Link
            to="/courses"
            className="flex-1 flex items-center gap-3 pl-4 pr-2 py-2 text-sm text-white/70 hover:text-white rounded-l-md transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <NotebookPen className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>Notes</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse recent notes" : "Expand recent notes"}
            className="p-2 rounded-r-md text-white/70 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {open && (
          <div ref={listRef} className="mt-1 ml-4 pl-2">
            {loading ? (
              <div className="space-y-2 py-2 pr-2">
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--color-text-subtle)] italic">
                No recent notes — open a lecture to start one.
              </p>
            ) : (
              <ul className="py-1 space-y-0.5">
                {items.map((lec) => {
                  const isActive = lec.id === activeLectureId;
                  return (
                    <li key={lec.id}>
                      <Link
                        to="/lectures/$lectureId"
                        params={{ lectureId: lec.id }}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm truncate rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                          isActive
                            ? "bg-white/[0.12] text-white"
                            : "text-white/60 hover:text-white hover:bg-white/[0.08]"
                        }`}
                        title={lec.title}
                      >
                        <span className="truncate">{lec.title || "Untitled"}</span>
                        {lec.duration_secs > 0 && (
                          <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-subtle)]">
                            {Math.round(lec.duration_secs / 60)}m
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Card variant: typographic list (no thumbnails, no rounded card) ─
  return (
    <section aria-label="Recent notes" className="flex flex-col gap-4">
      {!hideHeader && (
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Recent notes
          </h2>
          <Link
            to="/courses"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
          >
            View all
          </Link>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={FileText}
          title="No recent notes"
          description="Record or upload a lecture and your notes appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((lec) => (
            <li key={lec.id}>
              <Link
                to="/lectures/$lectureId"
                params={{ lectureId: lec.id }}
                title={lec.title || "Untitled"}
                className="flex items-baseline justify-between gap-4 py-2 text-sm group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
              >
                <span className="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary-strong)] transition-colors">
                  {lec.title || "Untitled"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-subtle)]">
                  {formatRecency(lec.updated || lec.recorded_at)}
                  {lec.duration_secs > 0 && (
                    <>
                      {" · "}
                      {Math.round(lec.duration_secs / 60)}m
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatRecency(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
