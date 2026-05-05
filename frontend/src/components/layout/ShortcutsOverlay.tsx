import { X } from "lucide-react";
import { useEffect } from "react";

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  rows: { keys: string[]; label: string }[];
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const Mod = isMac ? "⌘" : "Ctrl";

const GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    rows: [
      { keys: [Mod, "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this overlay" },
      { keys: ["G", "H"], label: "Go to Home" },
      { keys: ["G", "O"], label: "Go to Courses" },
      { keys: ["G", "C"], label: "Go to Calendar" },
      { keys: ["G", "S"], label: "Go to Study" },
      { keys: ["G", "T"], label: "Go to To-do / planner" },
      { keys: ["G", "R"], label: "Start a recording" },
      { keys: ["Esc"], label: "Close dialog / clear focus" },
    ],
  },
  {
    title: "Reading aids",
    rows: [
      { keys: ["Alt", "R"], label: "Cycle reading ruler" },
      { keys: ["Alt", "F"], label: "Cycle focus mode" },
    ],
  },
  {
    title: "Calendar",
    rows: [
      { keys: ["T"], label: "Jump to today" },
      { keys: ["←", "→"], label: "Previous / next range" },
      { keys: ["1", "2", "3", "4"], label: "Day / school week / week / month" },
      { keys: ["N"], label: "New event at current hour" },
    ],
  },
  {
    title: "Lecture page",
    rows: [
      { keys: ["1"], label: "Transcript tab" },
      { keys: ["2"], label: "Notes tab" },
      { keys: ["3"], label: "Flashcards tab" },
      { keys: ["4"], label: "Quiz tab" },
    ],
  },
  {
    title: "Recording",
    rows: [
      { keys: ["Space"], label: "Start / stop recording" },
      { keys: ["Esc"], label: "Cancel sign-language detector" },
    ],
  },
];

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 px-5 py-5 max-h-[70vh] overflow-y-auto">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-subtle)] mb-2">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.rows.map((row, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--color-text-muted)]">
                      {row.label}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-[11px] font-mono rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="px-5 h-9 flex items-center text-[11px] text-[var(--color-text-subtle)] border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          Tip: shortcuts are disabled while typing. Press
          <kbd className="mx-1 px-1 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[10px]">
            Esc
          </kbd>
          to clear focus first.
        </div>
      </div>
    </div>
  );
}
