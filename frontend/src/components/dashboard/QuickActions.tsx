/**
 * Dashboard quick-action grid.
 *
 * Each "tab" is a destination card matching the `quickaction-*` Figma frames:
 * Record (live capture), Upload (audio file), Notes (recent lectures), Cards
 * (due flashcards). Cards use a tinted gradient surface so they read as a
 * single visual family while keeping each action's accent distinct.
 *
 * The tile uses a `<Link>` — clicking anywhere on the card navigates to the
 * destination. This is the standard "click anywhere" pattern; the `<Link>`
 * fully owns hit-testing and we don't fight it with stop-propagation.
 */

import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowUpRight, Mic, Upload, FileText, Brain } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

type Variant = "indigo" | "amber" | "emerald" | "rose";

interface VariantTokens {
  /** Gradient surface used as the card background. */
  surface: string;
  /** Border color (default + hover). */
  border: string;
  /** Solid pill behind the icon. */
  iconBg: string;
  /** Hover arrow color. */
  arrow: string;
}

const VARIANT_TOKENS: Record<Variant, VariantTokens> = {
  indigo: {
    surface:
      "bg-gradient-to-br from-indigo-600/25 via-indigo-600/10 to-transparent",
    border: "border-indigo-500/25 hover:border-indigo-500/55",
    iconBg: "bg-indigo-500/90",
    arrow: "group-hover:text-indigo-300",
  },
  amber: {
    surface:
      "bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-transparent",
    border: "border-amber-500/25 hover:border-amber-500/55",
    iconBg: "bg-amber-500/90",
    arrow: "group-hover:text-amber-300",
  },
  emerald: {
    surface:
      "bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent",
    border: "border-emerald-500/25 hover:border-emerald-500/55",
    iconBg: "bg-emerald-500/90",
    arrow: "group-hover:text-emerald-300",
  },
  rose: {
    surface:
      "bg-gradient-to-br from-rose-500/25 via-rose-500/10 to-transparent",
    border: "border-rose-500/25 hover:border-rose-500/55",
    iconBg: "bg-rose-500/90",
    arrow: "group-hover:text-rose-300",
  },
};

interface QuickActionCardProps<T extends LinkProps["to"]> {
  to: T;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  variant: Variant;
}

function QuickActionCard<T extends LinkProps["to"]>({
  to,
  icon: Icon,
  title,
  description,
  badge,
  variant,
}: QuickActionCardProps<T>) {
  const tokens = VARIANT_TOKENS[variant];
  return (
    // @ts-expect-error — `to` is a valid LinkProps["to"]; TS struggles with the generic narrowing.
    <Link
      to={to}
      className={`group relative overflow-hidden flex items-center gap-4 p-5 rounded-2xl border transition-all soft-shadow ${tokens.surface} ${tokens.border}`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-black/30 ${tokens.iconBg}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-100 truncate">{title}</p>
        <p className="text-sm text-zinc-400 truncate">{description}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {badge && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-200">
            {badge}
          </span>
        )}
        <ArrowUpRight
          className={`h-4 w-4 text-zinc-500 transition-colors ${tokens.arrow}`}
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

interface QuickActionsProps {
  /** Number of flashcards due now — drives the Cards badge. */
  dueCount: number | null;
  /** Whether the parent is still loading data. */
  loading: boolean;
}

export function QuickActions({ dueCount, loading }: QuickActionsProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      style={{ "--qa-shadow": "0 8px 30px rgba(0,0,0,.35)" } as CSSProperties}
    >
      <QuickActionCard
        to="/capture"
        icon={Mic}
        title="Record"
        description="Live capture with captions"
        variant="rose"
      />
      <QuickActionCard
        to="/capture/upload"
        icon={Upload}
        title="Upload"
        description="Import audio or video"
        variant="amber"
      />
      <QuickActionCard
        to="/courses"
        icon={FileText}
        title="Notes"
        description="Browse your lectures"
        variant="indigo"
      />
      <QuickActionCard
        to="/study/flashcards"
        icon={Brain}
        title="Cards"
        description={
          loading
            ? "Loading..."
            : dueCount === null
              ? "Open deck"
              : dueCount > 0
                ? `${dueCount} due now`
                : "All caught up"
        }
        badge={
          !loading && dueCount !== null && dueCount > 0
            ? `${dueCount}`
            : undefined
        }
        variant="emerald"
      />
    </div>
  );
}
