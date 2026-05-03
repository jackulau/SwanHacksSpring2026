import {
  createFileRoute,
  useNavigate,
  Outlet,
  useMatch,
  Link as RouterLink,
} from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { usePreferences } from "../lib/preferences";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { CanvasConnect } from "../components/canvas/CanvasConnect";
import { useCanvasSync } from "../hooks/useCanvasSync";
import {
  Accessibility,
  User,
  Shield,
  Palette,
  ChevronRight,
  LogOut,
  Mail,
  Calendar,
  Moon,
  Check,
  Pencil,
  Download,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { pb } from "../lib/pocketbase";

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

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState<string>(
    user?.display_name || user?.email?.split("@")[0] || "",
  );
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name || user?.email?.split("@")[0] || "");
  }, [user]);

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    try {
      await pb.collection("users").update(user.id, { display_name: displayName });
      setEditingName(false);
    } catch {
      // PB error surfaces in the UI as a quiet revert; not worth a toast layer
      // for this iteration.
    } finally {
      setSavingName(false);
    }
  }

  const memberSince = user?.created
    ? new Date(user.created).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, integrations, and preferences"
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-12 -mt-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile */}
          <Section title="Profile" subtitle="Your Converge account">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow overflow-hidden">
              <div className="flex items-center gap-4 p-5 border-b border-[var(--color-border)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-black text-lg font-semibold shrink-0">
                  {displayName.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <form
                      onSubmit={handleSaveName}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 bg-[var(--color-input)] border border-[var(--color-border)] text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)]/60"
                      />
                      <button
                        type="submit"
                        disabled={savingName || !displayName.trim()}
                        className="inline-flex items-center justify-center bg-[var(--color-primary)] text-black rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(false);
                          setDisplayName(
                            user?.display_name || user?.email?.split("@")[0] || "",
                          );
                        }}
                        className="text-sm text-[var(--color-text-muted)] hover:text-white px-2 py-1.5"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate">
                        {displayName || "—"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingName(true)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-strong)] transition-colors p-1 rounded"
                        aria-label="Edit display name"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3" />
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
                <div className="p-4 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                      Member since
                    </p>
                    <p className="text-sm text-white">{memberSince}</p>
                  </div>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <Moon className="w-4 h-4 text-[var(--color-primary-strong)]" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                      Theme
                    </p>
                    <p className="text-sm text-white">
                      {prefs.theme === "high-contrast"
                        ? "Dark · High Contrast"
                        : "Dark · Aurora"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-end">
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-record)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--color-record)]/10"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </Section>

          {/* Appearance — dark only */}
          <Section
            title="Appearance"
            subtitle="Converge is dark-only by design — pick the contrast that suits you"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ThemeChoice
                active={prefs.theme === "dark"}
                onClick={() => update({ theme: "dark" })}
                label="Aurora Dark"
                description="The default. Soft green glow on a deep canvas."
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
            <p className="mt-3 text-xs text-[var(--color-text-subtle)] flex items-center gap-1.5">
              <Moon className="w-3 h-3" />
              Light mode is intentionally not offered — Converge is tuned for
              long study sessions in low-light environments.
            </p>
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
                title="Accessibility"
                description="Fonts, focus mode, reading rulers, text-to-speech"
              />
              <PrefRow
                icon={User}
                title="Account"
                description="Change email or password"
                comingSoon
              />
            </div>
          </Section>

          {/* Data */}
          <Section title="Data" subtitle="Export or remove your data">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] soft-shadow">
              <DataRow
                icon={Download}
                title="Export your data"
                description="Download all your notes, lectures, and study history as JSON"
                actionLabel="Export"
                onClick={() => exportUserData(userId)}
              />
            </div>
          </Section>

          {/* Danger zone */}
          <Section title="Danger zone" subtitle="Irreversible account actions">
            <div className="rounded-2xl border border-[var(--color-record)]/30 bg-[var(--color-record)]/5 soft-shadow overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-record)]/15 text-[var(--color-record)] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">Delete account</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Permanently remove your account and all associated data.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--color-record)] border border-[var(--color-record)]/40 hover:bg-[var(--color-record)]/10 rounded-full px-4 py-2 transition-colors"
                  onClick={() =>
                    alert(
                      "Account deletion will be available once email confirmation is wired up.",
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
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
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

interface PrefRowProps {
  to?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  comingSoon?: boolean;
}

function PrefRow({ to, icon: Icon, title, description, comingSoon = false }: PrefRowProps) {
  const inner = (
    <>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
      </div>
      {comingSoon ? (
        <span className="text-[10px] text-[var(--color-text-subtle)] bg-white/5 px-2 py-1 rounded-md uppercase tracking-wider">
          Soon
        </span>
      ) : (
        <ChevronRight className="w-4 h-4 text-[var(--color-text-subtle)]" />
      )}
    </>
  );

  const className = `flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
    comingSoon
      ? "bg-[var(--color-surface)]/60 border-[var(--color-border)]/60 opacity-60 cursor-not-allowed"
      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
  }`;

  if (comingSoon || !to) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <RouterLink to={to as string} className={className}>
      {inner}
    </RouterLink>
  );
}

interface DataRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}

function DataRow({ icon: Icon, title, description, actionLabel, onClick }: DataRowProps) {
  return (
    <div className="flex items-center gap-4 p-5">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-sm font-semibold text-black bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-full px-4 py-2 transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}

interface ThemeChoiceProps {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  preview: string;
}

function ThemeChoice({ active, onClick, label, description, preview }: ThemeChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        active
          ? "border-[var(--color-primary)]/60 bg-[var(--color-primary-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      <div
        className={`h-16 w-full rounded-xl mb-3 border border-white/10 ${preview}`}
        aria-hidden="true"
      />
      <p className="font-semibold text-white flex items-center gap-2">
        {label}
        {active && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-primary-strong)]">
            Active
          </span>
        )}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
    </button>
  );
}

async function exportUserData(userId: string) {
  try {
    const [lectures, notes, flashcards, courses] = await Promise.all([
      pb.collection("lectures").getFullList({ filter: `user = "${userId}"` }).catch(() => []),
      pb.collection("notes").getFullList({ filter: `user = "${userId}"` }).catch(() => []),
      pb.collection("flashcards").getFullList({ filter: `user = "${userId}"` }).catch(() => []),
      pb.collection("courses").getFullList({ filter: `user = "${userId}"` }).catch(() => []),
    ]);
    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), lectures, notes, flashcards, courses }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converge-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Export failed. Try again or check your network connection.");
  }
}
