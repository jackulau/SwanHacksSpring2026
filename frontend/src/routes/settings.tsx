import { createFileRoute, useNavigate, Outlet, useMatch, Link as RouterLink } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { CanvasConnect } from "../components/canvas/CanvasConnect";
import { useCanvasSync } from "../hooks/useCanvasSync";
import { Accessibility, User, Bell, Shield } from "lucide-react";

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
        <SettingsIndex userId={user.id} />
      )}
    </AppShell>
  );
}

function SettingsIndex({ userId }: { userId: string }) {
  const canvas = useCanvasSync(userId);

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your preferences</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Integrations</h2>
        <CanvasConnect
          connected={canvas.connected}
          syncing={canvas.syncing}
          lastSync={canvas.lastSync}
          error={canvas.error}
          canvasUser={canvas.canvasUser}
          onConnect={canvas.connect}
          onDisconnect={canvas.disconnect}
          onSync={canvas.sync}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Preferences</h2>
        <div className="space-y-2">
          <RouterLink
            to="/settings/accessibility"
            className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center shrink-0">
              <Accessibility className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Accessibility</p>
              <p className="text-sm text-zinc-500">Fonts, themes, reading tools, TTS</p>
            </div>
          </RouterLink>

          <div className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl opacity-50 cursor-not-allowed">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Account</p>
              <p className="text-sm text-zinc-500">Email, password, profile</p>
            </div>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-md">Soon</span>
          </div>

          <div className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl opacity-50 cursor-not-allowed">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Notifications</p>
              <p className="text-sm text-zinc-500">Study reminders, break alerts</p>
            </div>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-md">Soon</span>
          </div>

          <div className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl opacity-50 cursor-not-allowed">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Privacy</p>
              <p className="text-sm text-zinc-500">Data, export, delete account</p>
            </div>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-md">Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
