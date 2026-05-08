/**
 * /achievements — auto-earned badges, computed from existing activity.
 *
 * Pure read: we load a `UserStats` snapshot once on mount and run every
 * badge's `progress` function against it. Locked badges render greyed
 * out, earned badges in the primary color. Each card shows a tiny bar
 * filled by progress (e.g. 12 / 50 for "Library builder"), so the page
 * doubles as a guide for what to do next.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, Lock } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/layout/Skeleton";
import { useAuth } from "../lib/auth";
import {
  evaluateBadges,
  loadUserStats,
  type BadgeStatus,
  type UserStats,
} from "../lib/achievements";

export const Route = createFileRoute("/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    loadUserStats(user.id)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const evaluated = useMemo<BadgeStatus[]>(
    () => (stats ? evaluateBadges(stats) : []),
    [stats],
  );

  const earnedCount = evaluated.filter((b) => b.earned).length;
  const total = evaluated.length;

  if (authLoading || !user) return null;

  const subtitle =
    loading || !stats
      ? "Computing your badges from existing activity…"
      : `${earnedCount} of ${total} unlocked — keep going.`;

  return (
    <AppShell>
      <PageHeader title="Achievements" subtitle={subtitle} />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
              >
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluated.map((b) => (
              <BadgeCard key={b.badge.id} status={b} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BadgeCard({ status }: { status: BadgeStatus }) {
  const { badge, earned, current, target } = status;
  const Icon = badge.icon;
  // Clamp to keep the bar's width sane even if progress overshoots target.
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));

  return (
    <article
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
        earned
          ? "border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] opacity-75"
      }`}
      aria-label={`${badge.title}${earned ? " (unlocked)" : " (locked)"}`}
    >
      <header className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
            earned
              ? "bg-[var(--color-primary)] text-white border-transparent"
              : "bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] border-[var(--color-border)]"
          }`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`text-sm font-semibold truncate ${
                earned
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {badge.title}
            </h2>
            {earned ? (
              <Award
                className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Lock
                className="w-3.5 h-3.5 text-[var(--color-text-subtle)] shrink-0"
                aria-hidden="true"
              />
            )}
          </div>
          <p className="text-xs text-[var(--color-text-subtle)] mt-1 leading-relaxed">
            {badge.description}
          </p>
        </div>
      </header>
      <div>
        <div className="h-1.5 rounded-full bg-[var(--color-surface-raised)] overflow-hidden">
          <div
            className={`h-full ${
              earned
                ? "bg-[var(--color-primary)]"
                : "bg-[var(--color-text-subtle)]/60"
            }`}
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] tabular-nums text-[var(--color-text-subtle)]">
          <span>
            {current} / {target}
          </span>
          <span>{earned ? "Unlocked" : `${pct}%`}</span>
        </div>
      </div>
    </article>
  );
}
