/**
 * Dashboard Quick Actions card.
 *
 * Three pill tabs across the top — Online lecture / Record lecture / Upload
 * lecture — and a contextual input row beneath. Active tab is filled green;
 * inactive tabs are bordered black. Matches the `quickaction-online.png`,
 * `quickaction-record.png` and `quickaction-upload.png` Figma frames.
 *
 * Behaviour:
 *   • Online — paste a meeting/lecture URL, then "Start Notes" navigates
 *     to capture.
 *   • Record — single CTA "Start Recording" (red) → navigates to /capture.
 *   • Upload — single CTA "Upload" (green) → navigates to /capture/upload.
 */

import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Link2, Mic, Monitor, Upload } from "lucide-react";

type Tab = "online" | "record" | "upload";

interface QuickActionsProps {
  /** Number of flashcards due now — surfaced as a small chip in the header. */
  dueCount: number | null;
  loading: boolean;
}

export function QuickActions({ dueCount, loading }: QuickActionsProps) {
  const [tab, setTab] = useState<Tab>("online");
  const [link, setLink] = useState<string>("");
  const navigate = useNavigate();

  function handleStartOnline(e: FormEvent) {
    e.preventDefault();
    // Pass the link via search params so /capture can pick it up.
    navigate({
      to: "/capture",
      search: link ? { link } : undefined,
    } as never);
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 soft-shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        {!loading && dueCount !== null && dueCount > 0 && (
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
            {dueCount} cards due
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <TabButton
          active={tab === "online"}
          onClick={() => setTab("online")}
          icon={<Monitor className="w-4 h-4" />}
          label="Online lecture"
        />
        <TabButton
          active={tab === "record"}
          onClick={() => setTab("record")}
          icon={<Mic className="w-4 h-4" />}
          label="Record lecture"
        />
        <TabButton
          active={tab === "upload"}
          onClick={() => setTab("upload")}
          icon={<Upload className="w-4 h-4" />}
          label="Upload lecture"
        />
      </div>

      {/* Body */}
      {tab === "online" && (
        <form
          onSubmit={handleStartOnline}
          className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3"
        >
          <label className="relative flex-1">
            <span className="sr-only">Lecture link</span>
            <Link2
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste the link to the lecture here"
              className="w-full bg-black border border-[var(--color-border)] text-sm text-white placeholder:text-[var(--color-text-muted)] rounded-full pl-10 pr-4 py-3 focus:outline-none focus:border-[var(--color-primary)]/60"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-between gap-3 bg-black border border-[var(--color-border)] rounded-full pl-5 pr-1 py-1 hover:border-[var(--color-primary)]/60 transition-colors group"
          >
            <span className="text-sm font-semibold text-[var(--color-primary-strong)]">
              Start Notes
            </span>
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-primary)] text-black group-hover:bg-[var(--color-primary-hover)] transition-colors">
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </form>
      )}

      {tab === "record" && (
        <button
          type="button"
          onClick={() => navigate({ to: "/capture" })}
          className="w-full text-center text-base font-semibold text-[var(--color-record)] bg-black border border-[var(--color-border)] rounded-full py-3.5 hover:border-[var(--color-record)]/60 transition-colors"
        >
          Start Recording
        </button>
      )}

      {tab === "upload" && (
        <button
          type="button"
          onClick={() => navigate({ to: "/capture/upload" })}
          className="w-full text-center text-base font-semibold text-[var(--color-primary-strong)] bg-black border border-[var(--color-border)] rounded-full py-3.5 hover:border-[var(--color-primary)]/60 transition-colors"
        >
          Upload
        </button>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-black border-[var(--color-primary)]"
          : "bg-black text-white border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
