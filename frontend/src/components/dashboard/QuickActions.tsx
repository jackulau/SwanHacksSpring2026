/**
 * Quick actions strip — one primary action ("Start recording") plus a small
 * row of plain text links to the most-frequent destinations.
 *
 * Replaces the prior tabbed card with three pill buttons. We honor the
 * "one primary action per page" rule: green CTA in solid green, secondary
 * links rendered as understated text links.
 */

import { Link } from "@tanstack/react-router";
import { Monitor, Mic, Upload } from "lucide-react";

interface QuickActionsProps {
  /** Number of flashcards due now. When > 0, the "Review" link surfaces a count. */
  dueCount: number | null;
  loading: boolean;
}

export function QuickActions({ dueCount, loading }: QuickActionsProps) {
  const dueLabel =
    !loading && dueCount !== null && dueCount > 0
      ? `Review (${dueCount.toLocaleString()} due)`
      : "Review";

  return (
    <section
      aria-label="Quick actions"
      className="rounded-lg border border-[#e8e8e8] bg-white p-5"
    >
      <h2 className="text-4xl font-normal tracking-tight text-black">
        Quick Actions
      </h2>

      <div className="mt-7 grid gap-3 md:grid-cols-3">
        <Link
          to="/calendar"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border-2 border-[#d8f6df] bg-[#edfff2] px-4 text-lg font-normal text-[#438937] transition-colors hover:border-[#bdebc9] focus:outline-none focus:ring-2 focus:ring-[#438937]"
        >
          <Monitor className="h-7 w-7" aria-hidden="true" />
          Online lecture
        </Link>
        <Link
          to="/capture"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-[#eeeeee] bg-white px-4 text-lg font-normal text-black transition-colors hover:border-[#d8f6df] hover:text-[#438937] focus:outline-none focus:ring-2 focus:ring-[#438937]"
        >
          <Mic className="h-7 w-7" aria-hidden="true" />
          Record lecture
        </Link>
        <Link
          to="/capture/upload"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-[#eeeeee] bg-white px-4 text-lg font-normal text-black transition-colors hover:border-[#d8f6df] hover:text-[#438937] focus:outline-none focus:ring-2 focus:ring-[#438937]"
        >
          <Upload className="h-7 w-7" aria-hidden="true" />
          Upload lecture
        </Link>
      </div>

      <div className="mt-4">
        <Link
          to="/capture"
          className="inline-flex min-h-20 w-full items-center justify-center rounded-lg border-2 border-[#d8f6df] bg-[#edfff2] px-4 text-2xl font-normal text-[#438937] transition-colors hover:border-[#bdebc9] focus:outline-none focus:ring-2 focus:ring-[#438937]"
        >
          Share Screen
        </Link>
      </div>

      {dueLabel !== "Review" && (
        <Link
          to="/study/flashcards"
          className="mt-4 inline-flex text-sm font-semibold text-[#438937] hover:text-[#326c29] focus:outline-none focus:ring-2 focus:ring-[#438937] rounded-sm"
        >
          {dueLabel}
        </Link>
      )}
    </section>
  );
}
