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
import { ChevronDown, NotebookPen, FileText } from "lucide-react";
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
        <div className="flex items-center mx-1">
          {/* Label routes to /courses (notes hub). The chevron alone toggles the dropdown. */}
          <Link
            to="/courses"
            className="flex-1 flex items-center gap-3 pl-4 pr-2 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white rounded-l-lg transition-colors"
          >
            <NotebookPen className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>Notes</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse recent notes" : "Expand recent notes"}
            className="p-2 rounded-r-lg text-[var(--color-text-muted)] hover:text-white transition-colors"
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
              <div className="space-y-1.5 py-1.5 pr-2">
                <Skeleton className="h-7" />
                <Skeleton className="h-7" />
                <Skeleton className="h-7" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--color-text-subtle)] italic">
                No recent notes — open a lecture to start one.
              </p>
            ) : (
              <ul className="py-0.5 space-y-0.5">
                {items.map((lec) => (
                  <li key={lec.id}>
                    <Link
                      to="/lectures/$lectureId"
                      params={{ lectureId: lec.id }}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-white truncate rounded-md hover:bg-white/[0.04] transition-colors"
                      title={lec.title}
                    >
                      <span className="truncate">{lec.title || "Untitled"}</span>
                      {lec.duration_secs > 0 && (
                        <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-subtle)] bg-white/5 px-1.5 py-0.5 rounded">
                          {Math.round(lec.duration_secs / 60)}
                        </span>
                      )}
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

  // ── Card variant (dashboard "Recents" panel) ────────────────────────
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow flex flex-col min-h-[260px]">
      {!hideHeader && (
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Link
            to="/courses"
            className="font-semibold text-white text-lg hover:text-[var(--color-primary-strong)] transition-colors"
          >
            Recents
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2 py-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              size="md"
              icon={FileText}
              title="No recent notes"
              description="Record or upload a lecture and your most-recent notes will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2 py-2">
              {items.map((lec) => (
                <Link
                  key={lec.id}
                  to="/lectures/$lectureId"
                  params={{ lectureId: lec.id }}
                  className="group rounded-xl border border-[var(--color-border)] bg-black overflow-hidden hover:border-[var(--color-primary)]/60 transition-colors"
                >
                  <div className="aspect-video bg-gradient-to-br from-[var(--color-surface-raised)] to-black flex items-center justify-center">
                    <FileText className="w-7 h-7 text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] transition-colors" />
                  </div>
                  <div className="p-3">
                    <p className="text-[12px] font-semibold text-[var(--color-primary-strong)] uppercase tracking-wider truncate">
                      {lec.title || "Untitled"}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      {formatRecency(lec.updated || lec.recorded_at)}
                      {lec.duration_secs > 0 && (
                        <>
                          {" · "}
                          {Math.round(lec.duration_secs / 60)} min
                        </>
                      )}
                    </p>
                    <span className="mt-2 inline-flex items-center justify-center w-full text-xs font-semibold text-[var(--color-primary-strong)] bg-black border border-[var(--color-border)] rounded-full px-3 py-1.5">
                      Edit Notes
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
