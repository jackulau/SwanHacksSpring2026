/**
 * Consistent empty-state component.
 *
 * The old codebase repeated the same "icon-tile + title + helper text +
 * optional CTA" pattern in seven different routes. This consolidates it so
 * every "No X here yet" state looks the same.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Helper text shown beneath the title. */
  description?: string;
  /** A single primary action — usually a `<Link>` or `<button>`. */
  action?: ReactNode;
  /** Visual size. `sm` is for inside cards, `md` is the default centered hero, `lg` for whole-page empty pages. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_TOKENS = {
  sm: {
    wrap: "py-8",
    iconWrap: "w-10 h-10 mb-3",
    icon: "w-5 h-5",
    title: "text-sm",
    description: "text-xs mt-1",
  },
  md: {
    wrap: "py-12",
    iconWrap: "w-14 h-14 mb-4",
    icon: "w-7 h-7",
    title: "text-base",
    description: "text-sm mt-1.5",
  },
  lg: {
    wrap: "py-20",
    iconWrap: "w-16 h-16 mb-5",
    icon: "w-8 h-8",
    title: "text-lg",
    description: "text-sm mt-2",
  },
} as const;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  className = "",
}: EmptyStateProps) {
  const tokens = SIZE_TOKENS[size];
  return (
    <div className={`text-center ${tokens.wrap} ${className}`}>
      <div
        className={`${tokens.iconWrap} mx-auto rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-center text-zinc-500`}
      >
        <Icon className={tokens.icon} aria-hidden="true" />
      </div>
      <p className={`font-medium text-zinc-200 ${tokens.title}`}>{title}</p>
      {description && (
        <p className={`text-zinc-500 ${tokens.description}`}>{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
