/**
 * "Recent Notes" dropdown.
 *
 * Behaviour (per redesign brief):
 *   • Clicking the **title** ("Recent Notes") navigates to the notes index.
 *   • Clicking the **caret** toggles the dropdown open/closed — and *only*
 *     the caret. The title is a plain Link; the caret is a separate button.
 *   • The dropdown lists the most-recently-accessed lectures.
 *   • Empty state inside the dropdown is explicit, not a silent no-op.
 *
 * "Most recently accessed" is approximated by `Lecture.updated` (PocketBase
 * auto-updates that field whenever the lecture record is touched — opening
 * the lecture page increments `last_opened_at` via existing app behaviour;
 * if that's missing we fall back to `updated`, which still produces a useful
 * recency ordering).
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText } from "lucide-react";
import type { Lecture } from "../../lib/types";
import { Skeleton } from "../layout/Skeleton";
import { EmptyState } from "../layout/EmptyState";

interface RecentNotesDropdownProps {
  lectures: Lecture[];
  loading: boolean;
  /** Render style: `card` is the dashboard panel; `sidebar` is the compact sidebar dropdown. */
  variant?: "card" | "sidebar";
  /** Defaults closed. Sidebar variant is uncontrolled and remembers state across renders. */
  defaultOpen?: boolean;
  /** Hide all chrome and only render the list — used inside the dashboard panel where the parent owns the title row. */
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

  // Reset to closed when the variant or limit changes meaningfully — keeps
  // the sidebar's collapsed default consistent across navigation.
  useEffect(() => {
    if (defaultOpen !== undefined) setOpen(defaultOpen);
  }, [defaultOpen]);

  const items = lectures.slice(0, limit);

  // ── Sidebar variant ─────────────────────────────────────────────────
  if (variant === "sidebar") {
    return (
      <div>
        <div className="flex items-center">
          <Link
            to="/courses"
            className="flex-1 flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Notes</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse recent notes" : "Expand recent notes"}
            className="p-1.5 mr-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <ChevronRight
              className="w-4 h-4 caret-rotate"
              data-open={open}
              aria-hidden="true"
            />
          </button>
        </div>

        {open && (
          <div ref={listRef} className="mt-1 ml-4 pl-3 border-l border-zinc-800/80">
            {loading ? (
              <div className="space-y-1.5 py-1.5">
                <Skeleton className="h-7" />
                <Skeleton className="h-7" />
                <Skeleton className="h-7" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-2 py-2 text-xs text-zinc-500 italic">
                No notes yet
              </p>
            ) : (
              <ul className="py-1 space-y-0.5">
                {items.map((lec) => (
                  <li key={lec.id}>
                    <Link
                      to="/lectures/$lectureId"
                      params={{ lectureId: lec.id }}
                      className="block px-2 py-1.5 text-xs text-zinc-400 hover:text-white truncate rounded-md hover:bg-zinc-800/60 transition-colors"
                      title={lec.title}
                    >
                      {lec.title || "Untitled"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Card variant (dashboard) ────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 soft-shadow">
      {!hideHeader && (
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Link
            to="/courses"
            className="font-semibold text-zinc-100 hover:text-indigo-300 transition-colors"
          >
            Recent Notes
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <ChevronRight
              className="w-4 h-4 caret-rotate"
              data-open={open}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {open && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="space-y-2 px-2 py-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              size="sm"
              icon={FileText}
              title="No notes yet"
              description="Record or upload a lecture to generate notes"
            />
          ) : (
            <ul>
              {items.map((lec) => (
                <li key={lec.id}>
                  <Link
                    to="/lectures/$lectureId"
                    params={{ lectureId: lec.id }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                      <FileText className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-100 truncate">
                        {lec.title || "Untitled"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {formatRecency(lec.updated || lec.recorded_at)}
                      </p>
                    </div>
                    <StatusPill status={lec.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Lecture["status"] }) {
  const tone =
    status === "ready"
      ? "bg-emerald-900/40 text-emerald-300"
      : status === "error"
        ? "bg-red-900/40 text-red-300"
        : "bg-amber-900/40 text-amber-300";
  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${tone}`}
    >
      {status}
    </span>
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
