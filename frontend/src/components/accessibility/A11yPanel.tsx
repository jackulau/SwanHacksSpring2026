import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { usePreferences, type Preferences } from '../../lib/preferences';

interface A11yPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Slide-out accessibility panel — quick access to the same preferences
 * the full /settings page exposes, but available from anywhere.
 *
 * Visual chrome is intentionally minimal: hairline rows, no inner cards,
 * no inner section headers. Settings live at /settings; this panel is
 * a shortcut, not a replacement.
 */
export function A11yPanel({ isOpen, onClose }: A11yPanelProps) {
  const { prefs, update } = usePreferences();
  const liveRef = useRef<HTMLDivElement | null>(null);

  function announce(msg: string) {
    if (liveRef.current) liveRef.current.textContent = msg;
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-panel-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm h-full bg-[var(--color-bg)] border-l border-[var(--color-border)] overflow-y-auto">
        <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />

        <header className="sticky top-0 bg-[var(--color-bg)] flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] z-10">
          <h2 id="a11y-panel-title" className="text-base font-semibold text-[var(--color-text)]">
            Accessibility
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Close accessibility panel"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-6">
          <PanelToggle
            label="High contrast"
            checked={prefs.theme === 'high-contrast'}
            onChange={(v) => {
              update({ theme: v ? 'high-contrast' : 'dark' });
              announce(v ? 'High contrast on' : 'High contrast off');
            }}
          />
          <PanelToggle
            label="Dyslexia-friendly font"
            checked={prefs.font === 'opendyslexic'}
            onChange={(v) => {
              update({ font: v ? 'opendyslexic' : 'system' });
              announce(v ? 'Dyslexia font on' : 'Dyslexia font off');
            }}
          />
          <PanelToggle
            label="Reduced motion"
            checked={prefs.reducedMotion}
            onChange={(v) => {
              update({ reducedMotion: v });
              announce(v ? 'Reduced motion on' : 'Reduced motion off');
            }}
          />

          <PanelSlider
            label="Font size"
            value={prefs.fontSize}
            min={14}
            max={24}
            unit="px"
            onChange={(v) => update({ fontSize: v })}
          />
          <PanelSlider
            label="Line spacing"
            value={prefs.lineSpacing}
            min={1.2}
            max={2.0}
            step={0.1}
            onChange={(v) => update({ lineSpacing: Math.round(v * 10) / 10 })}
          />

          <PanelSelect
            label="Reading ruler"
            value={prefs.readingRuler}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'bar', label: 'Bar' },
              { value: 'window', label: 'Window' },
            ]}
            onChange={(v) =>
              update({ readingRuler: v as Preferences['readingRuler'] })
            }
          />
          <PanelSelect
            label="Focus mode"
            value={prefs.focusMode}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'paragraph', label: 'Paragraph' },
              { value: 'sentence', label: 'Sentence' },
            ]}
            onChange={(v) =>
              update({ focusMode: v as Preferences['focusMode'] })
            }
          />
          <PanelSelect
            label="Reading level"
            value={prefs.readingLevel}
            options={[
              { value: 'original', label: 'Original' },
              { value: 'simplified', label: 'Simplified' },
              { value: 'basic', label: 'Basic' },
            ]}
            onChange={(v) =>
              update({ readingLevel: v as Preferences['readingLevel'] })
            }
          />

          <PanelToggle
            label="Text-to-speech"
            checked={prefs.ttsEnabled}
            onChange={(v) => {
              update({ ttsEnabled: v });
              announce(v ? 'Text to speech on' : 'Text to speech off');
            }}
          />

          <p className="py-4 text-xs text-[var(--color-text-subtle)]">
            More options in Settings → Accessibility.
          </p>
        </div>
      </div>
    </div>
  );
}

function PanelRow({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-border)]">
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      {control}
    </div>
  );
}

function PanelToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <PanelRow
      label={label}
      control={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
            checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-input)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      }
    />
  );
}

function PanelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <PanelRow
      label={label}
      control={
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[var(--color-input)] border border-[var(--color-border)] text-[var(--color-text)] rounded-md px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-primary)]"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      }
    />
  );
}

function PanelSlider({
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
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-3 border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--color-text)]">{label}</span>
        <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
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
        aria-label={label}
        aria-valuetext={`${value}${unit}`}
        className="w-full accent-[var(--color-primary)]"
      />
    </div>
  );
}
