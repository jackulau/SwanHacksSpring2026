import { useEffect, useRef } from "react";
import { FileText, Mic, BookOpen } from "lucide-react";

export type MentionKind = "page" | "lecture" | "course";

export interface Mentionable {
  id: string;
  kind: MentionKind;
  title: string;
  /** Optional secondary line shown faded under the title. */
  subtitle?: string;
}

interface MentionMenuProps {
  query: string;
  items: Mentionable[];
  selectedIndex: number;
  anchor: { x: number; y: number };
  onSelect: (m: Mentionable) => void;
  onHover: (idx: number) => void;
  onClose: () => void;
}

const ICONS: Record<MentionKind, typeof FileText> = {
  page: FileText,
  lecture: Mic,
  course: BookOpen,
};

/**
 * @-mention popover. Shape mirrors the slash menu for visual consistency
 * but the items come from real records (pages, lectures, courses) — so
 * the parent does the fetch and the menu just renders / filters.
 */
export function MentionMenu({
  query,
  items,
  selectedIndex,
  anchor,
  onSelect,
  onHover,
  onClose,
}: MentionMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [onClose]);

  const filtered = items.filter((m) =>
    query ? m.title.toLowerCase().includes(query.toLowerCase()) : true,
  );

  if (filtered.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ left: anchor.x, top: anchor.y }}
        className="fixed z-50 w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] px-3 py-3 text-xs text-[var(--color-text-subtle)]"
      >
        No matches for &ldquo;{query}&rdquo;
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Mention picker"
      style={{ left: anchor.x, top: anchor.y }}
      className="fixed z-50 w-72 max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] py-1"
    >
      {filtered.map((m, idx) => {
        const Icon = ICONS[m.kind];
        const active = idx === selectedIndex;
        return (
          <button
            key={`${m.kind}-${m.id}`}
            type="button"
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(m);
            }}
            onMouseEnter={() => onHover(idx)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
              active
                ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]/60"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[var(--color-text)] truncate font-medium">
                {m.title || "Untitled"}
              </span>
              {m.subtitle && (
                <span className="block text-[10px] text-[var(--color-text-subtle)] truncate">
                  {m.subtitle}
                </span>
              )}
            </span>
            <span className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
              {m.kind}
            </span>
          </button>
        );
      })}
    </div>
  );
}
