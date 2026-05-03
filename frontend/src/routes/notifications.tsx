import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";

export const Route = createFileRoute("/notifications")({
  component: Notifications,
});

function Notifications() {
  return (
    <AppShell>
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-3xl bg-white border border-slate-200/70 p-8 soft-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
              <p className="text-sm text-slate-500">
                Stay on top of reminders, deadlines, and class updates.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Your inbox is calm for now. When alerts arrive, they will show up here with quick actions.
          </div>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
