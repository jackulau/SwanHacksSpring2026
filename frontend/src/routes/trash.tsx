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

  return (
    <AppShell>
      <PageHeader
        title="Trash"
        subtitle="Items you delete will appear here for 30 days before being permanently removed."
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] soft-shadow p-6">
          <EmptyState
            size="lg"
            icon={Trash2}
            title="Trash is empty"
            description="When you delete a note, course, or recording it lands here first — recoverable for 30 days."
            action={
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
              >
                Back to dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
