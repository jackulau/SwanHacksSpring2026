import {
  createFileRoute,
  useNavigate,
  Outlet,
  useMatch,
  Link as RouterLink,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { usePreferences } from "../lib/preferences";
import { AppShell } from "../components/layout/AppShell";
import { CanvasConnect } from "../components/canvas/CanvasConnect";
import { useCanvasSync } from "../hooks/useCanvasSync";
import {
  Accessibility,
  User,
  Bell,
  Shield,
  Palette,
  ChevronRight,
  LogOut,
  Mail,
  Calendar,
  Moon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const childMatch = useMatch({
    from: "/settings/accessibility",
    shouldThrow: false,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {childMatch ? <Outlet /> : <SettingsIndex userId={user.id} />}
    </AppShell>
  );
}

interface SettingsIndexProps {
  userId: string;
}

function SettingsIndex({ userId }: SettingsIndexProps) {
  const { user, logout } = useAuth();
  const { prefs, update } = usePreferences();
  const canvas = useCanvasSync(userId);

  const memberSince = user?.created
    ? new Date(user.created).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="vibe-aurora rounded-3xl p-6 sm:p-8 soft-shadow">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Settings
          </h1>
          <p className="text-zinc-300/80 text-sm mt-1.5">
            Manage your account, integrations, and preferences
          </p>
        </div>
      </div>

      {/* Profile */}
      <Section title="Profile" subtitle="Your HackStack account">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 soft-shadow overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-b border-zinc-800/80">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-lg font-semibold shrink-0">
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100 truncate">
                {user?.email?.split("@")[0] ?? "—"}
              </p>
              <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                {user?.email}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80">
            <div className="p-4 flex items-center gap-3">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Member since
                </p>
                <p className="text-sm text-zinc-200">{memberSince}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <Moon className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Theme
                </p>
                <p className="text-sm text-zinc-200">
                  {prefs.theme === "high-contrast"
                    ? "Dark · High contrast"
                    : "Dark · Aurora"}
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-zinc-800/80 flex items-center justify-end">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </Section>

      {/* Appearance — quick theme toggle (dark vs high-contrast). Light is gone. */}
      <Section
        title="Appearance"
        subtitle="HackStack is dark-only — pick your contrast"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ThemeChoice
            active={prefs.theme === "dark"}
            onClick={() => update({ theme: "dark" })}
            label="Aurora Dark"
            description="The default. Soft gradient atmosphere."
            preview="vibe-aurora"
          />
          <ThemeChoice
            active={prefs.theme === "high-contrast"}
            onClick={() => update({ theme: "high-contrast" })}
            label="High Contrast"
            description="Maximum legibility — pure black with bright accents."
            preview="bg-black border-white/40"
          />
        </div>
      </Section>

      {/* Integrations */}
      <Section
        title="Integrations"
        subtitle="Connect external tools to import data automatically"
      >
        <CanvasConnect
          connected={canvas.connected}
          syncing={canvas.syncing}
          lastSync={canvas.lastSync}
          error={canvas.error}
          canvasUser={canvas.canvasUser}
          onImport={canvas.importData}
          onDisconnect={canvas.disconnect}
        />
      </Section>

      {/* Preferences */}
      <Section title="Preferences" subtitle="Tune the app to how you study">
        <div className="space-y-2">
          <PrefRow
            to="/settings/accessibility"
            icon={Accessibility}
            iconColor="text-indigo-300"
            iconBg="bg-indigo-500/15"
            title="Accessibility"
            description="Fonts, focus mode, reading rulers, TTS"
          />
          <PrefRow
            icon={User}
            iconColor="text-emerald-300"
            iconBg="bg-emerald-500/15"
            title="Account"
            description="Email and password (coming soon)"
            comingSoon
          />
          <PrefRow
            icon={Bell}
            iconColor="text-amber-300"
            iconBg="bg-amber-500/15"
            title="Notifications"
            description="Study reminders and break alerts"
            comingSoon
          />
          <PrefRow
            icon={Shield}
            iconColor="text-rose-300"
            iconBg="bg-rose-500/15"
            title="Privacy & data"
            description="Export your data, delete your account"
            comingSoon
          />
          <PrefRow
            icon={Palette}
            iconColor="text-fuchsia-300"
            iconBg="bg-fuchsia-500/15"
            title="Color preferences"
            description="Adjust accent and contrast (coming soon)"
            comingSoon
          />
        </div>
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {subtitle && (
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

interface PrefRowProps {
  to?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  comingSoon?: boolean;
}

function PrefRow({
  to,
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  comingSoon = false,
}: PrefRowProps) {
  const inner = (
    <>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-100">{title}</p>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      {comingSoon ? (
        <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-2 py-1 rounded-md uppercase tracking-wider">
          Soon
        </span>
      ) : (
        <ChevronRight className="w-4 h-4 text-zinc-600" />
      )}
    </>
  );

  const className = `flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
    comingSoon
      ? "bg-zinc-900/40 border-zinc-800/60 opacity-60 cursor-not-allowed"
      : "bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-900/80"
  }`;

  if (comingSoon || !to) {
    return <div className={className}>{inner}</div>;
  }

  return (
    // @ts-expect-error — `to` is statically typed by the route tree; we accept the generic string here.
    <RouterLink to={to} className={className}>
      {inner}
    </RouterLink>
  );
}

interface ThemeChoiceProps {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  preview: string;
}

function ThemeChoice({
  active,
  onClick,
  label,
  description,
  preview,
}: ThemeChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        active
          ? "border-indigo-500/60 bg-indigo-500/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div
        className={`h-16 w-full rounded-xl mb-3 border border-white/10 ${preview}`}
        aria-hidden="true"
      />
      <p className="font-semibold text-zinc-100 flex items-center gap-2">
        {label}
        {active && (
          <span className="text-[10px] uppercase tracking-wider text-indigo-300">
            Active
          </span>
        )}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{description}</p>
    </button>
  );
}
