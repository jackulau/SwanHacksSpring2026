/**
 * Shared page header band — the grey gradient strip that runs across the
 * top of non-dashboard pages. Mirrors the dashboard's `<HeroHeader>` band
 * so the whole app reads as one design language.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot for actions (search, filters, "Add" button, etc). */
  actions?: ReactNode;
  /** Optional eyebrow line above the title (e.g. course code). */
  eyebrow?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: PageHeaderProps) {
  return (
    <section className="vibe-aurora px-4 sm:px-6 lg:px-8 pt-10 pb-8">
      <div className="max-w-6xl mx-auto relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1.5 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
