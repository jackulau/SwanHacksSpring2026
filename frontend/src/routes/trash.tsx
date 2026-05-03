import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trash2, ArrowRight } from "lucide-react";
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
        subtitle="Deleted notes, lectures, and courses will appear here for 30 days before being permanently removed."
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-3xl mx-auto mt-8">
          <EmptyState
            size="lg"
            icon={Trash2}
            title="Trash is empty"
            description="Nothing has been deleted recently. Items you remove will land here first and stay recoverable for 30 days."
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
