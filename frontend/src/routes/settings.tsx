import {
  createFileRoute,
  useNavigate,
  Outlet,
  useMatch,
} from "@tanstack/react-router";
import {
  useEffect,
  useState,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "../lib/auth";
import { usePreferences, type Preferences } from "../lib/preferences";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { CanvasConnect } from "../components/canvas/CanvasConnect";
import { useCanvasSync } from "../hooks/useCanvasSync";
import { pb } from "../lib/pocketbase";
import {
  getLLMConfig,
  setLLMConfig,
  testLLMConnection,
  PROVIDER_PRESETS,
  type LLMProvider,
  type LLMConfig,
} from "../lib/ai-pipeline";

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
      {childMatch ? <Outlet /> : <SettingsShell userId={user.id} initialSection="profile" />}
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell — two-column settings layout. Reused by /settings and
// /settings/accessibility (which mounts with initialSection="accessibility").
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsSection =
  | "profile"
  | "preferences"
  | "accessibility"
  | "account"
  | "data";

const SECTION_TITLES: Record<SettingsSection, { title: string; subtitle: string }> = {
  profile: {
    title: "Profile",
    subtitle: "Your name, email, and how Converge identifies you.",
  },
  preferences: {
    title: "Preferences",
    subtitle: "Appearance and integrations for your study workflow.",
  },
  accessibility: {
    title: "Accessibility",
    subtitle:
      "Customize reading, motion, and focus aids. Changes apply immediately.",
  },
  account: {
    title: "Account",
    subtitle: "Sign out or permanently delete your account.",
  },
  data: {
    title: "Data",
    subtitle: "Export everything you've stored in Converge.",
  },
};

const SECTIONS: SettingsSection[] = [
  "profile",
  "preferences",
  "accessibility",
  "account",
  "data",
];

interface SettingsShellProps {
  userId: string;
  initialSection: SettingsSection;
}

export function SettingsShell({ userId, initialSection }: SettingsShellProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const meta = SECTION_TITLES[section];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your Converge account and preferences." />

      <div className="px-4 sm:px-6 lg:px-8 pb-16 pt-4 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
          {/* Sub-nav */}
          <nav aria-label="Settings sections" className="md:sticky md:top-8 md:self-start">
            <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {SECTIONS.map((id) => {
                const active = section === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSection(id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]"
                      }`}
                    >
                      {SECTION_TITLES[id].title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content pane */}
          <main aria-labelledby="settings-section-heading" className="min-w-0">
            <header className="mb-6 pb-4 border-b border-[var(--color-border)]">
              <h2
                id="settings-section-heading"
                className="text-lg font-semibold text-[var(--color-text)] tracking-tight"
              >
                {meta.title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {meta.subtitle}
              </p>
            </header>

            {section === "profile" && <ProfileSection />}
            {section === "preferences" && <PreferencesSection userId={userId} />}
            {section === "accessibility" && <AccessibilitySection />}
            {section === "account" && <AccountSection />}
            {section === "data" && <DataSection userId={userId} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form row primitives — label / control / hint, hairline-separated.
// ─────────────────────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  /** When true, control sits below the label (e.g. for sliders). */
  stacked?: boolean;
}

function Row({ label, hint, htmlFor, children, stacked = false }: RowProps) {
  return (
    <div className="py-4 border-b border-[var(--color-border)] last:border-b-0">
      {stacked ? (
        <div>
          <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--color-text)]">
            {label}
          </label>
          {hint && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{hint}</p>
          )}
          <div className="mt-3">{children}</div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--color-text)]">
              {label}
            </label>
            {hint && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{hint}</p>
            )}
          </div>
          <div className="shrink-0">{children}</div>
        </div>
      )}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] ${
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-input)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

interface SelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}

function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  ariaLabel,
}: SelectProps<T>) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-[var(--color-input)] border border-[var(--color-border)] text-[var(--color-text)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)] min-w-44"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface SliderProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
  ariaLabel: string;
}

function Slider({
  id,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  ariaLabel,
}: SliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuetext={`${value}${unit}`}
        className="w-48 accent-[var(--color-primary)]"
      />
      <span
        className="text-xs tabular-nums text-[var(--color-text-muted)] min-w-12 text-right"
        aria-hidden="true"
      >
        {value}
        {unit}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const baseName = user?.display_name || user?.email?.split("@")[0] || "";
  const [displayName, setDisplayName] = useState(baseName);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    setDisplayName(baseName);
  }, [baseName]);

  const dirty = displayName.trim() !== baseName && displayName.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      await pb
        .collection("users")
        .update(user.id, { display_name: displayName.trim() });
      setSavedAt(Date.now());
    } catch {
      setSaveError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const memberSince = user?.created
    ? new Date(user.created).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <form onSubmit={handleSubmit}>
      <Row label="Display name" hint="Shown in the sidebar and on shared notes." htmlFor={inputId}>
        <input
          id={inputId}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="bg-[var(--color-input)] border border-[var(--color-border)] text-[var(--color-text)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)] w-64"
        />
      </Row>
      <Row label="Email">
        <span className="text-sm text-[var(--color-text-muted)]">{user?.email}</span>
      </Row>
      <Row label="Member since">
        <span className="text-sm text-[var(--color-text-muted)]">{memberSince}</span>
      </Row>

      <div className="mt-6 flex items-center gap-3" aria-live="polite">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="bg-[var(--color-primary)] text-white rounded-md px-4 py-1.5 text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt && !dirty && !saving && !saveError && (
          <span className="text-xs text-[var(--color-text-muted)]">Saved.</span>
        )}
        {saveError && (
          <span role="alert" className="text-xs text-[var(--color-record)]">
            {saveError}
          </span>
        )}
      </div>
    </form>
  );
}

function PreferencesSection({ userId }: { userId: string }) {
  const { prefs, update } = usePreferences();
  const canvas = useCanvasSync(userId);

  return (
    <div>
      <Row
        label="Theme"
        hint="Choose the visual style that suits long study sessions."
      >
        <Select<Preferences["theme"]>
          ariaLabel="Theme"
          value={prefs.theme}
          onChange={(v) => update({ theme: v })}
          options={[
            { value: "dark", label: "Converge Light" },
            { value: "high-contrast", label: "High Contrast" },
          ]}
        />
      </Row>

      <Row label="Font" hint="Body and reading typography across the app.">
        <Select<Preferences["font"]>
          ariaLabel="Font"
          value={prefs.font}
          onChange={(v) => update({ font: v })}
          options={[
            { value: "system", label: "System default" },
            { value: "atkinson", label: "Atkinson Hyperlegible" },
            { value: "opendyslexic", label: "OpenDyslexic" },
          ]}
        />
      </Row>

      <Row
        label="Reading level"
        hint="Default rewriting level for AI-summarized lecture notes."
      >
        <Select<Preferences["readingLevel"]>
          ariaLabel="Reading level"
          value={prefs.readingLevel}
          onChange={(v) => update({ readingLevel: v })}
          options={[
            { value: "original", label: "Original" },
            { value: "simplified", label: "Simplified" },
            { value: "basic", label: "Basic" },
          ]}
        />
      </Row>

      <div className="pt-8">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Canvas integration</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Import your courses, assignments, and announcements from Canvas.
        </p>
        <CanvasConnect
          connected={canvas.connected}
          syncing={canvas.syncing}
          lastSync={canvas.lastSync}
          error={canvas.error}
          canvasUser={canvas.canvasUser}
          onImport={canvas.importData}
          onDisconnect={canvas.disconnect}
        />
      </div>

      <AIModelSection />
    </div>
  );
}

function AIModelSection() {
  const [config, setConfig] = useState<LLMConfig>(getLLMConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function updateConfig(patch: Partial<LLMConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    setLLMConfig(next);
    setTestResult(null);
  }

  function switchProvider(provider: LLMProvider) {
    const preset = PROVIDER_PRESETS[provider];
    updateConfig({
      provider,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      apiKey: provider === config.provider ? config.apiKey : '',
    });
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await testLLMConnection();
    setTestResult(result);
    setTesting(false);
  }

  const preset = PROVIDER_PRESETS[config.provider];

  return (
    <div className="pt-8">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">AI model</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Powers note generation, flashcards, and quizzes. Any OpenAI-compatible endpoint works.
      </p>

      <div className="space-y-4">
        <Row label="Provider" hint="Ollama runs locally with no API key needed.">
          <select
            value={config.provider}
            onChange={(e) => switchProvider(e.target.value as LLMProvider)}
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
          >
            {(Object.entries(PROVIDER_PRESETS) as [LLMProvider, typeof preset][]).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </Row>

        {(config.provider === 'custom' || config.baseUrl !== preset.baseUrl) && (
          <Row label="Base URL" hint="OpenAI-compatible /v1 endpoint.">
            <input
              type="url"
              value={config.baseUrl}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              placeholder="http://localhost:11434/v1"
              className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </Row>
        )}

        {preset.needsKey && (
          <Row label="API key" hint="Stored in your browser only.">
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </Row>
        )}

        <Row label="Model" hint="Exact model ID your provider expects.">
          <input
            type="text"
            value={config.model}
            onChange={(e) => updateConfig({ model: e.target.value })}
            placeholder={preset.defaultModel || 'model-name'}
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </Row>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !config.model}
            className="text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] px-3 py-1.5 rounded-md border border-[var(--color-border)] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {testResult.ok ? `Connected — ${config.model}` : testResult.error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccessibilitySection() {
  const { prefs, update } = usePreferences();
  const liveRef = useRef<HTMLDivElement | null>(null);

  function announce(msg: string) {
    if (liveRef.current) {
      liveRef.current.textContent = msg;
    }
  }

  return (
    <div>
      <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />

      {/* Display group */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
        Display
      </h3>

      <Row
        label="High contrast mode"
        hint="Maximum legibility — pure black with bright accents."
      >
        <Toggle
          label="High contrast mode"
          checked={prefs.theme === "high-contrast"}
          onChange={(v) => {
            update({ theme: v ? "high-contrast" : "dark" });
            announce(v ? "High contrast on" : "High contrast off");
          }}
        />
      </Row>

      <Row
        label="Dyslexia-friendly font"
        hint="Use OpenDyslexic everywhere instead of the default."
      >
        <Toggle
          label="Dyslexia-friendly font"
          checked={prefs.font === "opendyslexic"}
          onChange={(v) => {
            update({ font: v ? "opendyslexic" : "system" });
            announce(v ? "Dyslexia font on" : "Dyslexia font off");
          }}
        />
      </Row>

      <Row
        label="Font size"
        hint={`Currently ${prefs.fontSize}px.`}
        stacked
      >
        <Slider
          ariaLabel="Font size"
          value={prefs.fontSize}
          min={14}
          max={24}
          unit="px"
          onChange={(v) => update({ fontSize: v })}
        />
      </Row>

      <Row label="Line spacing" hint={`Currently ${prefs.lineSpacing.toFixed(1)}.`} stacked>
        <Slider
          ariaLabel="Line spacing"
          value={prefs.lineSpacing}
          min={1.2}
          max={2.0}
          step={0.1}
          onChange={(v) => update({ lineSpacing: Math.round(v * 10) / 10 })}
        />
      </Row>

      <Row
        label="Reduced motion"
        hint="Disable transitions and animations across the app."
      >
        <Toggle
          label="Reduced motion"
          checked={prefs.reducedMotion}
          onChange={(v) => {
            update({ reducedMotion: v });
            announce(v ? "Reduced motion on" : "Reduced motion off");
          }}
        />
      </Row>

      {/* Reading aids group */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)] mt-8 mb-2">
        Reading aids
      </h3>

      <Row
        label="Reading ruler"
        hint="A horizontal guide that follows your cursor. Toggle anywhere with Alt+R."
      >
        <Select<Preferences["readingRuler"]>
          ariaLabel="Reading ruler"
          value={prefs.readingRuler}
          onChange={(v) => {
            update({ readingRuler: v });
            announce(`Reading ruler ${v}`);
          }}
          options={[
            { value: "off", label: "Off" },
            { value: "bar", label: "Bar" },
            { value: "window", label: "Window" },
          ]}
        />
      </Row>

      {prefs.readingRuler !== "off" && (
        <>
          <Row label="Ruler height" hint={`${prefs.readingRulerHeight}px tall.`} stacked>
            <Slider
              ariaLabel="Ruler height"
              value={prefs.readingRulerHeight}
              min={16}
              max={80}
              step={2}
              unit="px"
              onChange={(v) => update({ readingRulerHeight: v })}
            />
          </Row>

          <Row label="Ruler tint">
            <Select<Preferences["readingRulerTint"]>
              ariaLabel="Ruler tint"
              value={prefs.readingRulerTint}
              onChange={(v) => update({ readingRulerTint: v })}
              options={[
                { value: "none", label: "None" },
                { value: "yellow", label: "Yellow" },
                { value: "peach", label: "Peach" },
                { value: "blue", label: "Blue" },
                { value: "lavender", label: "Lavender" },
                { value: "mint", label: "Mint" },
              ]}
            />
          </Row>

          {prefs.readingRuler === "window" && (
            <Row label="Surrounding dim" hint={`Dim the rest by ${prefs.readingRulerOpacity}%.`} stacked>
              <Slider
                ariaLabel="Surrounding dim"
                value={prefs.readingRulerOpacity}
                min={0}
                max={90}
                step={5}
                unit="%"
                onChange={(v) => update({ readingRulerOpacity: v })}
              />
            </Row>
          )}
        </>
      )}

      <Row
        label="Focus mode"
        hint="Spotlight one paragraph or sentence at a time. Toggle with Alt+F."
      >
        <Select<Preferences["focusMode"]>
          ariaLabel="Focus mode"
          value={prefs.focusMode}
          onChange={(v) => {
            update({ focusMode: v });
            announce(`Focus mode ${v}`);
          }}
          options={[
            { value: "off", label: "Off" },
            { value: "paragraph", label: "Paragraph" },
            { value: "sentence", label: "Sentence" },
          ]}
        />
      </Row>

      {prefs.focusMode !== "off" && (
        <Row label="Surrounding dim" hint={`Dim other text by ${prefs.focusModeDim}%.`} stacked>
          <Slider
            ariaLabel="Focus dim"
            value={prefs.focusModeDim}
            min={30}
            max={95}
            step={5}
            unit="%"
            onChange={(v) => update({ focusModeDim: v })}
          />
        </Row>
      )}

      {/* Speech */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)] mt-8 mb-2">
        Speech
      </h3>

      <Row
        label="Text-to-speech"
        hint="Enable read-aloud controls on lectures and notes."
      >
        <Toggle
          label="Text-to-speech"
          checked={prefs.ttsEnabled}
          onChange={(v) => {
            update({ ttsEnabled: v });
            announce(v ? "Text to speech on" : "Text to speech off");
          }}
        />
      </Row>

      {prefs.ttsEnabled && (
        <Row label="Speech speed" hint={`${prefs.ttsSpeed.toFixed(1)}× playback.`} stacked>
          <Slider
            ariaLabel="Speech speed"
            value={prefs.ttsSpeed}
            min={0.5}
            max={2.0}
            step={0.1}
            unit="x"
            onChange={(v) => update({ ttsSpeed: Math.round(v * 10) / 10 })}
          />
        </Row>
      )}
    </div>
  );
}

function AccountSection() {
  const { logout } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  return (
    <div>
      <Row
        label="Sign out"
        hint="End this session on this device."
      >
        <button
          type="button"
          onClick={logout}
          className="text-sm text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[var(--color-primary-soft)] rounded-md px-4 py-1.5 transition-colors"
        >
          Sign out
        </button>
      </Row>

      <Row
        label="Delete account"
        hint="Permanently remove your account and all associated data. This cannot be undone."
      >
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-1.5 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteNotice(
                  "Account deletion will be available once email confirmation is wired up. Email champpacifiquemukiza@gmail.com to delete in the meantime.",
                );
                setConfirmDelete(false);
              }}
              className="text-sm font-semibold text-white bg-[var(--color-record)] hover:opacity-90 rounded-md px-4 py-1.5 transition-opacity"
            >
              Confirm delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-semibold text-[var(--color-record)] border border-[var(--color-record)]/40 hover:bg-[var(--color-record)]/10 rounded-md px-4 py-1.5 transition-colors"
          >
            Delete…
          </button>
        )}
      </Row>
      {deleteNotice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-md px-3 py-2 bg-[var(--color-surface-raised)]"
        >
          {deleteNotice}
        </p>
      )}
    </div>
  );
}

function DataSection({ userId }: { userId: string }) {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  async function handleExport() {
    setExporting(true);
    setStatus(null);
    try {
      const filename = await exportUserData(userId);
      setStatus({ kind: "success", msg: `Exported as ${filename}.` });
    } catch {
      setStatus({
        kind: "error",
        msg: "Export failed. Check your connection and try again.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Row
        label="Export your data"
        hint="Download all your notes, lectures, flashcards, and courses as a single JSON file."
      >
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 rounded-md px-4 py-1.5 transition-colors"
        >
          {exporting ? "Exporting…" : "Export"}
        </button>
      </Row>
      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-xs ${
            status.kind === "error"
              ? "text-[var(--color-record)]"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

async function exportUserData(userId: string): Promise<string> {
  const [lectures, notes, flashcards, courses] = await Promise.all([
    pb.collection("lectures").getFullList({ filter: `user = "${userId}"`, requestKey: "exp-lectures" }).catch(() => []),
    pb.collection("notes").getFullList({ filter: `user = "${userId}"`, requestKey: "exp-notes" }).catch(() => []),
    pb.collection("flashcards").getFullList({ filter: `user = "${userId}"`, requestKey: "exp-flashcards" }).catch(() => []),
    pb.collection("courses").getFullList({ filter: `user = "${userId}"`, requestKey: "exp-courses" }).catch(() => []),
  ]);
  const blob = new Blob(
    [
      JSON.stringify(
        { exported_at: new Date().toISOString(), lectures, notes, flashcards, courses },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const filename = `converge-export-${new Date().toISOString().slice(0, 10)}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
