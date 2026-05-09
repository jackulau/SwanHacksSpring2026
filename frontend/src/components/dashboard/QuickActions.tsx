/**
 * Quick actions strip — one primary action ("Start recording") plus a small
 * row of plain text links to the most-frequent destinations.
 *
 * Replaces the prior tabbed card with three pill buttons. We honor the
 * "one primary action per page" rule: green CTA in solid green, secondary
 * links rendered as understated text links.
 */

import { Link } from "@tanstack/react-router";
import { Mic, Search } from "lucide-react";

interface QuickActionsProps {
  /** Number of flashcards due now. When > 0, the "Review" link surfaces a count. */
  dueCount: number | null;
  loading: boolean;
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function QuickActions({ dueCount, loading }: QuickActionsProps) {
  const dueLabel =
    !loading && dueCount !== null && dueCount > 0
      ? `Review (${dueCount.toLocaleString()} due)`
      : "Review";
  const cmdKey = isMacPlatform() ? "⌘K" : "Ctrl K";

  return (
    <section
      aria-label="Quick actions"
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <Link
          to="/capture"
          className="inline-flex items-center justify-center gap-2 self-start bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-sm rounded-md px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <Mic className="w-4 h-4" aria-hidden="true" />
          Start recording
        </Link>
        <span
          className="hidden md:inline-flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)]"
          aria-hidden="true"
        >
          <Search className="w-3 h-3" aria-hidden="true" />
          Press
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
            {cmdKey}
          </kbd>
          to jump anywhere
        </span>
      </div>

      <nav
        aria-label="Quick links"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
      >
        <Link
          to="/capture/upload"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
        >
          Upload lecture
        </Link>
        <Link
          to="/courses"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
        >
          Courses
        </Link>
        <Link
          to="/study/flashcards"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
        >
          {dueLabel}
        </Link>
        <Link
          to="/calendar"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-sm"
        >
          Calendar
        </Link>
      </nav>
    </section>
  );
}
