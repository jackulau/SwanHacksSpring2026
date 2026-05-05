import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trash2, ArrowRight, Info } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";

export const Route = createFileRoute("/trash")({
  component: TrashPage,
});

function TrashPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  // The PocketBase schema (see `src/lib/types.ts`) does not have a
  // `deleted_at` / `archived` field on Lecture, Note, Course, etc.
  // Until soft-delete is added server-side, Trash is always empty —
  // we render an honest empty state instead of fabricating rows.

  return (
    <AppShell>
      <PageHeader
        title="Trash"
        subtitle="Deleted items recover here before they're permanently removed."
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-3xl mx-auto mt-6 space-y-6">
          <div
            role="note"
            className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-sm"
          >
            <Info
              className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-subtle)]"
              aria-hidden="true"
            />
            <p className="text-[var(--color-text-muted)]">
              Soft-delete recovery is coming with the next release. Today,
              deleting a course, lecture, or note removes it immediately.
              Use <span className="font-medium text-[var(--color-text)]">Settings → Data → Export</span>{" "}
              to keep a local backup of everything you've stored.
            </p>
          </div>

          <EmptyState
            size="lg"
            icon={Trash2}
            title="Trash is empty"
            description="Nothing has been deleted recently."
            action={
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
              >
                Back to dashboard
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
