import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Assignment } from "../lib/types";

export const Route = createFileRoute("/assignments")({
  component: AssignmentsIndexPage,
});

type Filter = "all" | "upcoming" | "submitted" | "graded" | "missing";

function AssignmentsIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("assignments")
      .getFullList<Assignment>({
        filter: `user = "${user.id}"`,
        sort: "due_at",
        requestKey: "asg-index",
      })
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Assignments"
        subtitle="Everything Canvas (or you) marked due."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "upcoming", "submitted", "graded", "missing"] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2.5 h-7 rounded-full border ${
                  filter === f
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                {f}
              </button>
            ),
          )}
        </div>

        {filtered === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading assignments…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">
            {filter === "all"
              ? "No assignments yet. Connect Canvas in /settings or add tasks from the planner."
              : `No assignments with status "${filter}".`}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((a) => (
              <li key={a.id}>
                <Link
                  to="/assignments/$assignmentId"
                  params={{ assignmentId: a.id }}
                  className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
                >
                  {iconFor(a.status)}
                  <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                    {a.title}
                  </span>
                  {a.due_at && (
                    <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                      {new Date(a.due_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                    {a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function iconFor(status: Assignment["status"]) {
  switch (status) {
    case "submitted":
    case "graded":
      return (
        <CheckCircle2
          className="w-4 h-4 text-[var(--color-success)] flex-shrink-0"
          aria-hidden="true"
        />
      );
    case "missing":
      return (
        <XCircle
          className="w-4 h-4 text-[var(--color-error)] flex-shrink-0"
          aria-hidden="true"
        />
      );
    default:
      return (
        <Circle
          className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0"
          aria-hidden="true"
        />
      );
  }
}
