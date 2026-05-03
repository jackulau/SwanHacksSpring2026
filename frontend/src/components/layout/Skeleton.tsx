/**
 * Reusable skeleton primitives.
 *
 * The app already had ad-hoc `<div className="… animate-pulse" />` skeletons
 * in several places. We keep that contract for backwards compatibility but
 * route the styling through a consistent shimmer (defined as `.skeleton` in
 * `app.css`) so loading states feel coherent across pages.
 *
 * `prefers-reduced-motion` is handled at the CSS level — these components
 * don't need to know about it.
 */

import type { CSSProperties, ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** When provided, the skeleton wraps children but renders them invisibly so layout is preserved. */
  children?: ReactNode;
  /** Aria-label exposed to assistive tech. Defaults to "Loading". */
  ariaLabel?: string;
}

export function Skeleton({
  className = "",
  style,
  children,
  ariaLabel = "Loading",
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={`skeleton rounded-xl ${className}`}
      style={style}
    >
      {children !== undefined && (
        <span className="invisible" aria-hidden="true">
          {children}
        </span>
      )}
    </div>
  );
}

/** Convenience: a stacked list of skeleton rows. */
interface SkeletonListProps {
  count?: number;
  rowClassName?: string;
  className?: string;
}

export function SkeletonList({
  count = 3,
  rowClassName = "h-14",
  className = "space-y-2",
}: SkeletonListProps) {
  return (
    <div className={className} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}

/** Convenience: a single text-line skeleton (used inline in headers). */
export function SkeletonText({
  width = "8rem",
  className = "",
}: {
  width?: string;
  className?: string;
}) {
  return (
    <Skeleton
      className={`h-4 inline-block align-middle ${className}`}
      style={{ width }}
    />
  );
}
