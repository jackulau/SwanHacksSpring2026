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
import { ChevronDown, NotebookPen, FileText, Play } from "lucide-react";
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
  const [renderSidebarList, setRenderSidebarList] = useState<boolean>(defaultOpen);
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

  useEffect(() => {
    if (variant !== "sidebar") return;
    if (open) {
      setRenderSidebarList(true);
      return;
    }
    const timer = window.setTimeout(() => setRenderSidebarList(false), 260);
    return () => window.clearTimeout(timer);
  }, [open, variant]);

  const items = lectures.slice(0, limit);

  // ── Sidebar variant ─────────────────────────────────────────────────
  if (variant === "sidebar") {
    return (
      <div>
        <div className="flex h-16 items-center">
          <Link
            to="/courses"
            className="flex h-full flex-1 items-center gap-5 pl-7 pr-2 text-[21px] font-normal text-white/90 transition-[background-color,color] duration-200 ease-[var(--motion-ease)] hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/80"
          >
            <NotebookPen className="h-7 w-7 shrink-0" aria-hidden="true" />
            <span>Notes</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse recent notes" : "Expand recent notes"}
            className="flex h-full w-14 items-center justify-center text-white transition-colors duration-200 ease-[var(--motion-ease)] hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/80"
          >
            <ChevronDown
              className={`h-7 w-7 transition-transform duration-200 ease-[var(--motion-ease)] ${
                open ? "" : "rotate-180"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {renderSidebarList && (
          <div
            className="sidebar-collapse ml-14 pr-5"
            data-open={open ? "true" : "false"}
            aria-hidden={!open}
          >
            <div ref={listRef}>
              {loading ? (
                <div className="space-y-2 py-2 pr-2">
                  <Skeleton className="h-6" />
                  <Skeleton className="h-6" />
                  <Skeleton className="h-6" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-3 py-2 text-sm text-white/65">
                  No recent notes yet.
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
                          className={`flex items-center justify-between gap-2 px-3 py-2 text-sm truncate rounded-md transition-[background-color,color] duration-200 ease-[var(--motion-ease)] focus:outline-none focus:ring-2 focus:ring-white/80 ${
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
          </div>
        )}
      </div>
    );
  }

  // ── Card variant: typographic list (no thumbnails, no rounded card) ─
  return (
    <section aria-label="Recent notes" className="flex min-h-[360px] flex-col rounded-lg border border-[#e8e8e8] bg-white p-5">
      {!hideHeader && (
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-4xl font-normal tracking-tight text-black">
            Recents
          </h2>
          <Link
            to="/courses"
            className="text-sm font-semibold text-[#438937] hover:text-[#326c29] transition-colors focus:outline-none focus:ring-2 focus:ring-[#438937] rounded-sm"
          >
            View all
          </Link>
        </div>
      )}

      {loading ? (
        <div className="grid flex-1 gap-5 md:grid-cols-2" aria-label="Loading recent notes">
          <RecentNoteSkeleton />
          <RecentNoteSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            size="sm"
            icon={FileText}
            title="No recent notes"
            description="Record or upload a lecture and your notes appear here."
          />
        </div>
      ) : (
        <ul className="grid gap-5 overflow-y-auto pr-1 md:grid-cols-2">
          {items.map((lec) => (
            <li key={lec.id} className="min-w-0">
              <Link
                to="/lectures/$lectureId"
                params={{ lectureId: lec.id }}
                title={lec.title || "Untitled"}
                className="motion-hover-lift group block rounded-lg focus:outline-none focus:ring-2 focus:ring-[#438937]"
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1f321e,#111),radial-gradient(circle_at_72%_30%,rgba(244,112,23,0.85),transparent_19%),radial-gradient(circle_at_14%_78%,rgba(244,112,23,0.65),transparent_16%)]">
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(255,129,31,0.8),transparent_14%),radial-gradient(circle_at_18%_72%,rgba(255,129,31,0.55),transparent_12%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.35))]" />
                  <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(0,0,0,0.34)_0_2px,transparent_2px_44px)] opacity-50" />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 transition-transform group-hover:scale-105">
                      <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden="true" />
                    </span>
                  </span>
                </div>
                <div className="px-6 pb-1 pt-5">
                  <h3 className="truncate text-2xl font-normal text-[#438937]">
                    {lec.title || "Untitled"}
                  </h3>
                  <p className="mt-4 text-base font-bold text-black">
                    {formatLectureDate(lec.recorded_at || lec.created)}
                    {lec.duration_secs > 0 && (
                      <>
                        {" | "}
                        {formatDuration(lec.duration_secs)}
                      </>
                    )}
                  </p>
                  <div className="mt-5 flex justify-end">
                    <span className="inline-flex min-w-40 items-center justify-center rounded-full border-2 border-[#d8f6df] bg-[#edfff2] px-8 py-2 text-lg font-normal text-[#438937] transition-colors duration-200 ease-[var(--motion-ease)] group-hover:border-[#bdebc9]">
                      View
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentNoteSkeleton() {
  return (
    <div className="min-w-0" aria-hidden="true">
      <Skeleton className="aspect-[16/9] rounded-lg" />
      <div className="px-6 pb-1 pt-5">
        <Skeleton className="h-8 w-3/5 rounded-md" />
        <Skeleton className="mt-4 h-5 w-4/5 rounded-md" />
        <div className="mt-5 flex justify-end">
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function formatLectureDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}mins`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}mins`;
}
