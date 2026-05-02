import { createFileRoute, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const childMatch = useMatch({ from: "/settings/accessibility", shouldThrow: false });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {childMatch ? (
        <Outlet />
      ) : (
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-500 text-sm">Coming soon</p>
        </div>
      )}
    </AppShell>
  );
}
