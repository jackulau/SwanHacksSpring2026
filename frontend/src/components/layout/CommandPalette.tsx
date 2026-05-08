import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Home,
  Mic,
  BookOpen,
  Calendar,
  Glasses,
  ListTodo,
  Settings,
  Trash2,
  Accessibility,
  FileText,
  Plus,
  Sparkles,
  Keyboard,
  Brain,
  Hand,
  Users,
  Download,
  History,
  Activity,
  TestTube,
  Tag as TagIcon,
} from "lucide-react";
import { pb } from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import type { Lecture, Course, Assignment } from "../../lib/types";

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Home;
  group: "Go" | "Action" | "Lecture" | "Course" | "Assignment";
  /** Searchable keywords. Concatenated with label for matching. */
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onShowShortcuts?: () => void;
  onOpenQuickCapture?: () => void;
}

/**
 * Global command palette. Opens on Cmd/Ctrl+K. Single search box, fuzzy
 * substring match, keyboard-first. The first non-trivial keystroke wins
 * focus; arrow keys navigate; Enter executes.
 */
export function CommandPalette({
  open,
  onClose,
  onShowShortcuts,
  onOpenQuickCapture,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Reset state and focus input each time the palette opens. On close,
  // restore focus to whatever the user was on so keyboard navigation isn't
  // dumped at the body.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // Lazy-load searchable records when the palette opens.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    Promise.allSettled([
      pb
        .collection("lectures")
        .getFullList<Lecture>({ filter: `user = "${user.id}"`, sort: "-recorded_at", requestKey: "cmdk-lec" }),
      pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${user.id}"`, requestKey: "cmdk-courses" }),
      pb
        .collection("assignments")
        .getFullList<Assignment>({ filter: `user = "${user.id}"`, sort: "due_at", requestKey: "cmdk-asg" }),
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setLectures(res[0].value);
      if (res[1].status === "fulfilled") setCourses(res[1].value);
      if (res[2].status === "fulfilled") setAssignments(res[2].value);
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation — always available
      { id: "go-home", label: "Go to Home", icon: Home, group: "Go", run: () => navigate({ to: "/" }) },
      { id: "go-record", label: "Start a recording", keywords: "record capture audio mic", icon: Mic, group: "Action", run: () => navigate({ to: "/capture" }) },
      { id: "go-courses", label: "Go to Courses", icon: BookOpen, group: "Go", run: () => navigate({ to: "/courses" }) },
      { id: "go-notes", label: "Go to Notes", keywords: "pages docs writing", icon: FileText, group: "Go", run: () => navigate({ to: "/notes" }) },
      { id: "act-new-note", label: "New note page", keywords: "page create blank", icon: Plus, group: "Action", run: () => navigate({ to: "/notes" }) },
      { id: "act-quick-capture", label: "Quick capture", hint: isMacPlatform() ? "⌘J" : "Ctrl J", keywords: "inbox thought scratch jot stash idea fast", icon: Sparkles, group: "Action", run: () => onOpenQuickCapture?.() },
      { id: "go-calendar", label: "Go to Calendar", icon: Calendar, group: "Go", run: () => navigate({ to: "/calendar" }) },
      { id: "go-study", label: "Go to Study", keywords: "flashcards quiz", icon: Glasses, group: "Go", run: () => navigate({ to: "/study" }) },
      { id: "go-due", label: "Review due today", keywords: "due cards spaced repetition every deck unified queue", icon: Glasses, group: "Action", run: () => navigate({ to: "/study/due" }) },
      { id: "go-flashcards", label: "Review flashcards", keywords: "due cards spaced repetition", icon: Glasses, group: "Action", run: () => navigate({ to: "/study/flashcards" }) },
      { id: "go-planner", label: "To-do / planner", keywords: "tasks assignments", icon: ListTodo, group: "Go", run: () => navigate({ to: "/study/planner" }) },
      { id: "go-knowledge", label: "Search knowledge", keywords: "find chunks library", icon: Brain, group: "Go", run: () => navigate({ to: "/knowledge" }) },
      { id: "go-knowledge-ask", label: "Ask your knowledge", keywords: "ask qa rag question chat", icon: Sparkles, group: "Action", run: () => navigate({ to: "/knowledge/ask" }) },
      { id: "go-asl", label: "ASL chat", keywords: "sign language webcam", icon: Hand, group: "Go", run: () => navigate({ to: "/asl" }) },
      { id: "go-play", label: "Join a multiplayer game", keywords: "code multiplayer party", icon: Users, group: "Action", run: () => navigate({ to: "/play" }) },
      { id: "go-sessions", label: "Multiplayer sessions", keywords: "history hosted joined games rounds", icon: History, group: "Go", run: () => navigate({ to: "/sessions" }) },
      { id: "go-export", label: "Export decks and courses", keywords: "download anki json bundle markdown", icon: Download, group: "Action", run: () => navigate({ to: "/export" }) },
      { id: "go-activity", label: "Activity feed", keywords: "recent everything notes lectures", icon: Activity, group: "Go", run: () => navigate({ to: "/activity" }) },
      { id: "go-lab", label: "Lab — system status", keywords: "providers diagnostics counts collections", icon: TestTube, group: "Go", run: () => navigate({ to: "/lab" }) },
      { id: "go-tags", label: "Browse tags", keywords: "label categorize filter", icon: TagIcon, group: "Go", run: () => navigate({ to: "/tags" }) },
      { id: "go-templates", label: "Note templates", keywords: "scaffold skeleton starter", icon: FileText, group: "Go", run: () => navigate({ to: "/templates" }) },
      { id: "go-today", label: "Today", keywords: "dashboard daily focus today", icon: Sparkles, group: "Go", run: () => navigate({ to: "/today" }) },
      { id: "go-decks", label: "Decks", keywords: "flashcard library deck stats", icon: Glasses, group: "Go", run: () => navigate({ to: "/decks" }) },
      { id: "go-trash", label: "Trash", icon: Trash2, group: "Go", run: () => navigate({ to: "/trash" }) },
      { id: "go-settings", label: "Settings", icon: Settings, group: "Go", run: () => navigate({ to: "/settings" }) },
      { id: "go-a11y", label: "Accessibility settings", keywords: "ruler focus mode contrast tts", icon: Accessibility, group: "Go", run: () => navigate({ to: "/settings/accessibility" }) },
      // Quick actions
      { id: "act-new-event", label: "New calendar event", keywords: "schedule appointment", icon: Plus, group: "Action", run: () => navigate({ to: "/calendar" }) },
      { id: "act-shortcuts", label: "Keyboard shortcuts", keywords: "help hotkeys keys", icon: Keyboard, group: "Action", run: () => onShowShortcuts?.() },
    ];

    for (const l of lectures.slice(0, 50)) {
      list.push({
        id: `lec-${l.id}`,
        label: l.title || "Untitled lecture",
        hint: l.recorded_at ? new Date(l.recorded_at).toLocaleDateString() : undefined,
        keywords: l.title ?? "",
        icon: FileText,
        group: "Lecture",
        run: () => navigate({ to: "/lectures/$lectureId", params: { lectureId: l.id } }),
      });
    }
    for (const c of courses.slice(0, 30)) {
      list.push({
        id: `course-${c.id}`,
        label: `${c.code ?? ""} ${c.name ?? ""}`.trim(),
        hint: c.semester,
        keywords: `${c.code ?? ""} ${c.name ?? ""}`,
        icon: BookOpen,
        group: "Course",
        run: () => navigate({ to: "/courses/$courseId", params: { courseId: c.id } }),
      });
    }
    for (const a of assignments.slice(0, 30)) {
      list.push({
        id: `asg-${a.id}`,
        label: a.title || "Untitled assignment",
        hint: a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : undefined,
        keywords: a.title ?? "",
        icon: Sparkles,
        group: "Assignment",
        run: () => {
          if (a.canvas_url) window.open(a.canvas_url, "_blank", "noopener,noreferrer");
          else navigate({ to: "/study/planner" });
        },
      });
    }
    return list;
  }, [lectures, courses, assignments, navigate, onShowShortcuts, onOpenQuickCapture]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const tokens = q.split(/\s+/).filter(Boolean);
    return items
      .map((it) => {
        const hay = `${it.label} ${it.keywords ?? ""} ${it.group}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          const idx = hay.indexOf(t);
          if (idx === -1) return null;
          // Earlier match = higher score; whole-word boundary boosts.
          score += 100 - Math.min(idx, 50);
          if (hay.startsWith(t)) score += 30;
        }
        return { it, score };
      })
      .filter((x): x is { it: CommandItem; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  }, [items, query]);

  // Reset selection when filter changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the active item scrolled into view as the user navigates.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) {
        target.run();
        onClose();
      }
    }
  };

  // Group items in the rendered order, preserving the score order from `filtered`.
  const grouped: { group: string; items: { item: CommandItem; idx: number }[] }[] = [];
  filtered.forEach((item, idx) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === item.group) last.items.push({ item, idx });
    else grouped.push({ group: item.group, items: [{ item, idx }] });
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--color-border)]">
          <Search className="w-4 h-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, course, lecture, or page…"
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
            aria-label="Search commands"
            aria-controls="cmdk-list"
            aria-activedescendant={filtered[activeIndex] ? `cmdk-${filtered[activeIndex].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="px-1.5 py-0.5 text-[10px] uppercase rounded border border-[var(--color-border)] text-[var(--color-text-subtle)] bg-[var(--color-surface-raised)]">esc</kbd>
        </div>
        <ul
          id="cmdk-list"
          ref={listRef}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto py-1.5"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[var(--color-text-subtle)]">
              No matches. Try a different keyword.
            </li>
          )}
          {grouped.map((g) => (
            <li key={g.group}>
              <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-subtle)]">
                {g.group}
              </div>
              <ul>
                {g.items.map(({ item: it, idx }) => {
                  const Icon = it.icon;
                  const active = idx === activeIndex;
                  return (
                    <li
                      key={it.id}
                      id={`cmdk-${it.id}`}
                      role="option"
                      aria-selected={active}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        it.run();
                        onClose();
                      }}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer text-sm ${
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
                          : "text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[var(--color-text-subtle)] shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && (
                        <span className="text-xs text-[var(--color-text-subtle)] shrink-0">{it.hint}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between px-4 h-8 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[10px] text-[var(--color-text-subtle)]">
          <span className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
          </span>
          <span><kbd className="font-mono">{isMacPlatform() ? "⌘K" : "Ctrl K"}</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
