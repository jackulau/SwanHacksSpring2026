import { useEffect, useRef } from "react";
import { filterSpecs, type BlockTypeSpec } from "./blockTypes";

interface SlashMenuProps {
  query: string;
  /** Page coordinates the popup should anchor to. */
  anchor: { x: number; y: number };
  selectedIndex: number;
  onSelect: (spec: BlockTypeSpec) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}

/**
 * Keyboard-driven block picker. Selection state lives in the parent so the
 * editor's keydown handler can drive Up/Down/Enter without the menu having
 * its own focus context (which would steal caret away from the editor).
 */
export function SlashMenu({
  query,
  anchor,
  selectedIndex,
  onSelect,
  onHover,
  onClose,
}: SlashMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = filterSpecs(query);

  // Close on outside click.
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [onClose]);

  // Scroll selection into view as user arrows through.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Block type picker"
        style={{ left: anchor.x, top: anchor.y }}
        className="fixed z-50 w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] px-3 py-3 text-xs text-[var(--color-text-subtle)]"
      >
        No blocks match &ldquo;{query}&rdquo;
      </div>
    );
  }

  // Group into the canonical buckets the spec list defines.
  const groups: Record<string, BlockTypeSpec[]> = {};
  for (const spec of items) {
    if (!groups[spec.group]) groups[spec.group] = [];
    groups[spec.group].push(spec);
  }
  const groupLabels: Record<string, string> = {
    basic: "Basic",
    list: "Lists",
    media: "Media",
    advanced: "Advanced",
  };
  const groupOrder = ["basic", "list", "media", "advanced"];

  let runningIndex = 0;
  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Block type picker"
      style={{ left: anchor.x, top: anchor.y }}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] py-1"
    >
      {groupOrder.map((g) => {
        const list = groups[g];
        if (!list || list.length === 0) return null;
        return (
          <div key={g} className="py-1">
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] font-medium">
              {groupLabels[g]}
            </div>
            {list.map((spec) => {
              const idx = runningIndex++;
              const Icon = spec.icon;
              const active = idx === selectedIndex;
              return (
                <button
                  key={`${spec.label}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-idx={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(spec);
                  }}
                  onMouseEnter={() => onHover(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]/60"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-subtle)]" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-[var(--color-text)] truncate">
                      {spec.label}
                    </span>
                    <span className="block text-[11px] text-[var(--color-text-subtle)] truncate">
                      {spec.description}
                    </span>
                  </span>
                  {spec.shortcut && (
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-subtle)] bg-[var(--color-surface-raised)]">
                      {spec.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
