import { useEffect, useMemo, useRef, useState } from 'react';
import { NotebookPen, Eye, Pencil, Check } from 'lucide-react';
import { NoteBlock } from './NoteBlock';
import { EmptyState } from '../layout/EmptyState';
import { renderInlineMarkdown, renderMarkdownBlock } from './markdown';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteEditorProps {
  /** AI-generated / saved blocks rendered as the read-only document body. */
  blocks: NoteBlockType[];
  /** Document title shown above the body. */
  title?: string;
  /** User's free-form personal notes (plain text / markdown). */
  personalNotes?: string;
  /** Persist personal notes back up. Called debounced + on blur. */
  onPersonalNotesChange?: (next: string) => void;
  /** Disables the personal-notes textarea while a save is in flight. */
  saving?: boolean;
}

type SaveState = "idle" | "dirty" | "saving" | "saved";

const AUTOSAVE_MS = 700;

/**
 * Document-style note surface. Renders generated blocks as flowing prose and
 * gives the student a markdown-aware writing surface for their own notes.
 *
 * The personal-notes editor supports two modes — Write (textarea) and Read
 * (rendered markdown). Markdown shortcuts are kept intentionally small: #,
 * ##, ###, lists with -/*, > blockquote, **bold**, *italic*, `code`, ---
 * divider. We do NOT try to be a full slash-command rich editor — the
 * upstream blocks render that surface; this is the calm second column.
 */
export function NoteEditor({
  blocks,
  title,
  personalNotes,
  onPersonalNotesChange,
  saving = false,
}: NoteEditorProps) {
  const [draft, setDraft] = useState(personalNotes ?? '');
  const [mode, setMode] = useState<"write" | "read">("write");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // Keep local draft in sync if the parent reloads notes from PocketBase.
  useEffect(() => {
    setDraft(personalNotes ?? '');
    setSaveState("idle");
  }, [personalNotes]);

  // Auto-grow the textarea so it feels like writing on a page.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft, mode]);

  // Debounced autosave — fires AUTOSAVE_MS after the last keystroke.
  useEffect(() => {
    if (!onPersonalNotesChange) return;
    if (draft === (personalNotes ?? "")) return;
    setSaveState("dirty");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setSaveState("saving");
      onPersonalNotesChange(draft);
      // Optimistic — assume the parent will reflect the value back.
      window.setTimeout(() => setSaveState("saved"), 200);
      // Fade the "Saved" pill back to the default hint after a beat so the
      // status row doesn't permanently read "Saved" once you stop typing.
      window.setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "idle" : s));
      }, 2200);
    }, AUTOSAVE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [draft, personalNotes, onPersonalNotesChange]);

  const handleBlur = () => {
    if (!onPersonalNotesChange) return;
    if (draft === (personalNotes ?? "")) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSaveState("saving");
    onPersonalNotesChange(draft);
    window.setTimeout(() => setSaveState("saved"), 200);
  };

  // Lightweight markdown shortcuts on Enter — promotes "- " into a fresh
  // bullet on the next line, "1. " into a numbered list, and matches the
  // indentation of the previous line for easier nesting.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) return;
    const before = ta.value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.slice(lineStart);

    // Empty bullet — Enter exits the list rather than creating an empty bullet.
    const emptyBullet = currentLine.match(/^(\s*)([-*]|\d+\.)\s+$/);
    if (emptyBullet) {
      e.preventDefault();
      const next = ta.value.slice(0, lineStart) + ta.value.slice(start);
      setDraft(next);
      window.requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = lineStart;
      });
      return;
    }

    const bullet = currentLine.match(/^(\s*)([-*])\s+/);
    if (bullet) {
      e.preventDefault();
      const insertion = `\n${bullet[1]}${bullet[2]} `;
      const next = ta.value.slice(0, start) + insertion + ta.value.slice(end);
      setDraft(next);
      window.requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insertion.length;
      });
      return;
    }

    const numbered = currentLine.match(/^(\s*)(\d+)\.\s+/);
    if (numbered) {
      e.preventDefault();
      const next2 = parseInt(numbered[2], 10) + 1;
      const insertion = `\n${numbered[1]}${next2}. `;
      const next = ta.value.slice(0, start) + insertion + ta.value.slice(end);
      setDraft(next);
      window.requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insertion.length;
      });
    }
  };

  const hasGenerated = blocks.length > 0;
  const wordCount = useMemo(() => draft.trim().split(/\s+/).filter(Boolean).length, [draft]);
  const showSaveLabel = onPersonalNotesChange && saveState !== "idle";
  const saveLabel: Record<SaveState, string> = {
    idle: "",
    dirty: "Editing…",
    saving: "Saving…",
    saved: "Saved",
  };

  return (
    <article
      className="max-w-3xl mx-auto"
      data-focus-zone
      aria-label="Lecture notes"
    >
      {title && (
        <header className="mb-6">
          <h2 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight">
            {title}
          </h2>
        </header>
      )}

      {hasGenerated ? (
        <div className="space-y-4">
          {blocks.map((block, i) => (
            <NoteBlock key={block.id || i} block={block} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title="No generated notes yet"
          description="Notes will appear here once this lecture finishes processing."
          size="sm"
        />
      )}

      {/* Personal notes — single calm writing surface. */}
      {onPersonalNotesChange && (
        <section className="mt-10 pt-6 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="personal-notes"
              className="block text-xs uppercase tracking-wider text-[var(--color-text-subtle)] font-medium"
            >
              Your notes
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode("write")}
                aria-pressed={mode === "write"}
                className={`flex items-center gap-1 px-2 h-7 rounded-md text-[11px] transition-colors ${
                  mode === "write"
                    ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                    : "text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
                }`}
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setMode("read")}
                aria-pressed={mode === "read"}
                className={`flex items-center gap-1 px-2 h-7 rounded-md text-[11px] transition-colors ${
                  mode === "read"
                    ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                    : "text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
                }`}
                disabled={!draft.trim()}
              >
                <Eye className="w-3 h-3" aria-hidden="true" />
                Read
              </button>
            </div>
          </div>

          {mode === "write" ? (
            <textarea
              id="personal-notes"
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Type freely. Markdown shortcuts work — # heading, **bold**, - bullet, > quote."
              disabled={saving}
              aria-describedby="personal-notes-hint"
              className="w-full min-h-32 resize-none bg-transparent border-0 outline-none text-[var(--color-text-muted)] leading-7 placeholder:text-[var(--color-text-subtle)] focus:ring-0 focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-4 rounded-sm"
            />
          ) : (
            <div className="leading-7 text-[var(--color-text-muted)] markdown-rendered min-h-[8rem]">
              {renderMarkdownBlocks(draft)}
            </div>
          )}

          <div
            id="personal-notes-hint"
            className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-subtle)]"
          >
            <span>
              {showSaveLabel ? (
                <span className="inline-flex items-center gap-1">
                  {saveState === "saved" && <Check className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" />}
                  {saveLabel[saveState]}
                </span>
              ) : (
                "Autosaves as you type."
              )}
            </span>
            <span className="tabular-nums">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          </div>
        </section>
      )}
    </article>
  );
}

/**
 * Tiny markdown -> JSX renderer. Block-level: headings, bullet lists,
 * numbered lists, blockquotes, dividers, paragraphs. Inline handled in
 * `renderInlineMarkdown` (bold, italic, code).
 */
function renderMarkdownBlocks(src: string) {
  const out: React.ReactNode[] = [];
  const lines = src.split(/\r?\n/);
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = renderInlineMarkdown(h[2]);
      if (level === 1) out.push(<h2 key={key++} className="text-2xl font-semibold text-[var(--color-text)] mt-6 mb-2">{content}</h2>);
      else if (level === 2) out.push(<h3 key={key++} className="text-lg font-semibold text-[var(--color-text)] mt-5 mb-2">{content}</h3>);
      else out.push(<h4 key={key++} className="text-base font-semibold text-[var(--color-text)] mt-4 mb-2">{content}</h4>);
      i++;
      continue;
    }
    // Divider
    if (/^---+\s*$/.test(line)) {
      out.push(<hr key={key++} className="border-0 border-t border-[var(--color-border)] my-4" />);
      i++;
      continue;
    }
    // Blockquote
    if (line.startsWith("> ")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        block.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          className="border-l-2 border-[var(--color-border-strong)] pl-4 italic text-[var(--color-text-muted)] my-2"
        >
          {block.map((b, idx) => (
            <p key={idx}>{renderInlineMarkdown(b)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-6 marker:text-[var(--color-text-subtle)] my-2 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInlineMarkdown(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="list-decimal pl-6 marker:text-[var(--color-text-subtle)] my-2 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInlineMarkdown(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    // Paragraph
    out.push(
      <p key={key++} className="my-2 text-[var(--color-text-muted)] leading-7">
        {renderInlineMarkdown(line)}
      </p>,
    );
    i++;
  }
  return out;
}

// Re-export so consumers that want the helpers can import them from here too.
export { renderInlineMarkdown, renderMarkdownBlock };
