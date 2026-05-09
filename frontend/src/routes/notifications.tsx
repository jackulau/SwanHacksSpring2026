import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ArrowRight } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";

export const Route = createFileRoute("/notifications")({
  component: Notifications,
});

function Notifications() {
  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        subtitle="Stay on top of reminders, deadlines, and class updates."
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 sm:p-8">
            <EmptyState
              size="md"
              icon={Bell}
              title="Your inbox is calm for now"
              description="When alerts arrive, they will show up here with quick actions."
              action={
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold px-5 py-2.5 rounded-full text-sm transition-colors"
                >
                  Back to dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
