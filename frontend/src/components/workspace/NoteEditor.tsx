import { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { NoteBlock } from './NoteBlock';
import { EmptyState } from '../layout/EmptyState';
import { AIChip } from '../layout/AIChip';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteEditorProps {
  /** AI-generated / saved blocks rendered as the read-only document body. */
  blocks: NoteBlockType[];
  /** Document title shown above the body. */
  title?: string;
  /** User's free-form personal notes (plain text). */
  personalNotes?: string;
  /** Persist personal notes back up. Called on blur / debounced changes. */
  onPersonalNotesChange?: (next: string) => void;
  /** Disables the personal-notes textarea while a save is in flight. */
  saving?: boolean;
  /** When true, shows an AI chip next to the document title. */
  aiGenerated?: boolean;
}

/**
 * Document-style note surface. Renders generated blocks as flowing prose and
 * gives the student a single calm textarea for their own notes — no boxes,
 * no card chrome, just typography on the canvas.
 */
export function NoteEditor({
  blocks,
  title,
  personalNotes,
  onPersonalNotesChange,
  saving = false,
  aiGenerated = false,
}: NoteEditorProps) {
  const [draft, setDraft] = useState(personalNotes ?? '');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep local draft in sync if the parent reloads notes from PocketBase.
  useEffect(() => {
    setDraft(personalNotes ?? '');
  }, [personalNotes]);

  // Auto-grow the textarea so it feels like writing on a page.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft]);

  const handleBlur = () => {
    if (onPersonalNotesChange && draft !== (personalNotes ?? '')) {
      onPersonalNotesChange(draft);
    }
  };

  const hasGenerated = blocks.length > 0;

  return (
    <article
      className="max-w-3xl mx-auto"
      data-focus-zone
      aria-label="Lecture notes"
    >
      {title && (
        <header className="mb-6 flex items-center gap-3 flex-wrap">
          <h2 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight">
            {title}
          </h2>
          {aiGenerated && <AIChip />}
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

      {/* Personal notes — single calm writing surface. No card. */}
      {onPersonalNotesChange && (
        <section className="mt-10 pt-6 border-t border-[var(--color-border)]">
          <label
            htmlFor="personal-notes"
            className="block text-xs uppercase tracking-wider text-[var(--color-text-subtle)] font-medium mb-2"
          >
            Your notes
          </label>
          <textarea
            id="personal-notes"
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            placeholder="Jot down your own thoughts, questions, or reminders…"
            disabled={saving}
            aria-describedby="personal-notes-hint"
            className="w-full min-h-32 resize-none bg-transparent border-0 outline-none text-[var(--color-text-muted)] leading-7 placeholder:text-[var(--color-text-subtle)] focus:ring-0 focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-4 rounded-sm"
          />
          <p
            id="personal-notes-hint"
            className="text-xs text-[var(--color-text-subtle)] mt-2"
          >
            {saving ? 'Saving…' : 'Saved when you click away.'}
          </p>
        </section>
      )}
    </article>
  );
}
