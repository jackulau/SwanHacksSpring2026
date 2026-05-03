import { useEffect } from 'react';
import { X, Volume2, Type, Eye, Brain, BookOpen } from 'lucide-react';
import { usePreferences } from '../../lib/preferences';

interface A11yPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function A11yPanel({ isOpen, onClose }: A11yPanelProps) {
  const { prefs: preferences, update } = usePreferences();
  const updatePreference = <K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) => {
    update({ [key]: value } as Partial<typeof preferences>);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-zinc-900 border-l border-zinc-700 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Accessibility</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          <Section icon={<Eye className="w-4 h-4" />} title="Display">
            <SelectOption
              label="Theme"
              value={preferences.theme}
              options={[
                { value: 'dark', label: 'Dark (default)' },
                { value: 'high-contrast', label: 'High Contrast' },
              ]}
              onChange={(v) => updatePreference('theme', v as typeof preferences.theme)}
            />
            <SelectOption
              label="Font"
              value={preferences.font}
              options={[
                { value: 'system', label: 'System Default' },
                { value: 'atkinson', label: 'Atkinson Hyperlegible' },
                { value: 'opendyslexic', label: 'OpenDyslexic' },
              ]}
              onChange={(v) => updatePreference('font', v as typeof preferences.font)}
            />
            <SliderOption
              label="Font Size"
              value={preferences.fontSize}
              min={14}
              max={24}
              unit="px"
              onChange={(v) => updatePreference('fontSize', v)}
            />
            <SliderOption
              label="Line Spacing"
              value={preferences.lineSpacing}
              min={1.2}
              max={2.0}
              step={0.1}
              onChange={(v) => updatePreference('lineSpacing', v)}
            />
            <ToggleOption
              label="Reduced Motion"
              checked={preferences.reducedMotion}
              onChange={(v) => updatePreference('reducedMotion', v)}
            />
          </Section>

          <Section icon={<Type className="w-4 h-4" />} title="Reading">
            <SelectOption
              label="Reading Level"
              value={preferences.readingLevel}
              options={[
                { value: 'original', label: 'Original' },
                { value: 'simplified', label: 'Simplified' },
                { value: 'basic', label: 'Basic' },
              ]}
              onChange={(v) => updatePreference('readingLevel', v as typeof preferences.readingLevel)}
            />
          </Section>

          <Section icon={<BookOpen className="w-4 h-4" />} title="Reading Aids">
            <SelectOption
              label="Reading Ruler (Alt+R)"
              value={preferences.readingRuler}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'bar', label: 'Bar' },
                { value: 'window', label: 'Window' },
              ]}
              onChange={(v) => updatePreference('readingRuler', v as typeof preferences.readingRuler)}
            />
            {preferences.readingRuler !== 'off' && (
              <>
                <SliderOption
                  label="Ruler Height"
                  value={preferences.readingRulerHeight}
                  min={16}
                  max={80}
                  step={2}
                  unit="px"
                  onChange={(v) => updatePreference('readingRulerHeight', v)}
                />
                <SelectOption
                  label="Ruler Tint"
                  value={preferences.readingRulerTint}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'yellow', label: 'Yellow' },
                    { value: 'peach', label: 'Peach' },
                    { value: 'blue', label: 'Blue' },
                    { value: 'lavender', label: 'Lavender' },
                    { value: 'mint', label: 'Mint' },
                  ]}
                  onChange={(v) =>
                    updatePreference('readingRulerTint', v as typeof preferences.readingRulerTint)
                  }
                />
                {preferences.readingRuler === 'window' && (
                  <SliderOption
                    label="Dim Opacity"
                    value={preferences.readingRulerOpacity}
                    min={0}
                    max={90}
                    step={5}
                    unit="%"
                    onChange={(v) => updatePreference('readingRulerOpacity', v)}
                  />
                )}
              </>
            )}
            <SelectOption
              label="Focus Mode (Alt+F)"
              value={preferences.focusMode}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'paragraph', label: 'Paragraph' },
                { value: 'sentence', label: 'Sentence' },
              ]}
              onChange={(v) => updatePreference('focusMode', v as typeof preferences.focusMode)}
            />
            {preferences.focusMode !== 'off' && (
              <SliderOption
                label="Surrounding Text Dim"
                value={preferences.focusModeDim}
                min={30}
                max={95}
                step={5}
                unit="%"
                onChange={(v) => updatePreference('focusModeDim', v)}
              />
            )}
          </Section>

          <Section icon={<Volume2 className="w-4 h-4" />} title="Text-to-Speech">
            <ToggleOption
              label="Enable TTS"
              checked={preferences.ttsEnabled}
              onChange={(v) => updatePreference('ttsEnabled', v)}
            />
            {preferences.ttsEnabled && (
              <SliderOption
                label="TTS Speed"
                value={preferences.ttsSpeed}
                min={0.5}
                max={2.0}
                step={0.1}
                unit="x"
                onChange={(v) => updatePreference('ttsSpeed', v)}
              />
            )}
          </Section>

          <Section icon={<Brain className="w-4 h-4" />} title="Study">
            <SliderOption
              label="Cards per Session"
              value={preferences.cardsPerSession}
              min={5}
              max={50}
              step={5}
              onChange={(v) => updatePreference('cardsPerSession', v)}
            />
            <SliderOption
              label="Pomodoro Length"
              value={preferences.pomodoroLength}
              min={10}
              max={60}
              step={5}
              unit=" min"
              onChange={(v) => updatePreference('pomodoroLength', v)}
            />
            <ToggleOption
              label="Break Reminders"
              checked={preferences.breakReminders}
              onChange={(v) => updatePreference('breakReminders', v)}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-indigo-400">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SelectOption({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-zinc-300 text-sm">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderOption({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-zinc-300 text-sm">{label}</label>
        <span className="text-zinc-400 text-sm">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </div>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-zinc-300 text-sm">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-indigo-600' : 'bg-zinc-700'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
