// QuickCapture — global "thoughts inbox" composer.
//
// Press Cmd/Ctrl+J anywhere to open a small floating modal that creates
// a fresh note_pages row from the typed body. Each non-empty line of
// the body becomes a paragraph block; if a title is provided we prepend
// a heading block. After save we kick off best-effort knowledge-chunk
// ingestion so the new note shows up in /knowledge/ask without a full
// page reload, then surface a toast whose title links to the new page.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { pb } from "../../lib/pocketbase";
import { toast } from "../../lib/toasts";
import { ingestNote } from "../../lib/knowledge/ingest";
import type { NoteBlock, NotePage } from "../../lib/types";

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
}

/**
 * Build the canonical block array for a captured thought. A heading
 * block at the top mirrors the title (when present); each non-empty
 * body line becomes its own paragraph block so users can immediately
 * promote them into bullets/headings inside the page editor.
 */
function buildBlocks(title: string, body: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const trimmedTitle = title.trim();
  if (trimmedTitle) {
    blocks.push({ id: rid(), type: "heading", level: 1, text: trimmedTitle });
  }
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    blocks.push({ id: rid(), type: "paragraph", text: line });
  }
  if (blocks.length === 0) {
    blocks.push({ id: rid(), type: "paragraph", text: "" });
  }
  return blocks;
}

export function QuickCapture({ open, onClose, userId }: QuickCaptureProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Reset on open and focus the title. We restore focus to whatever was
  // previously focused on close so keyboard navigation isn't dumped.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    setTitle("");
    setBody("");
    setSaving(false);
    const t = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // Esc closes from anywhere inside the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const canSave = !saving && (title.trim().length > 0 || body.trim().length > 0);

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const created = await pb.collection("note_pages").create<NotePage>({
        user: userId,
        title: title.trim(),
        icon: "file-text",
        parent: "",
        course: "",
        lecture: "",
        blocks: buildBlocks(title, body),
        properties: {},
        archived: false,
      });
      // Best-effort ingest — never block the toast / close on failure.
      void ingestNote(userId, created).catch(() => undefined);
      onClose();
      toast.success("Captured", {
        description: created.title || "Untitled note",
        action: {
          label: "Open",
          onClick: () => {
            navigate({
              to: "/notes/$pageId",
              params: { pageId: created.id },
            });
          },
        },
      });
    } catch (err) {
      setSaving(false);
      toast.error(
        "Couldn't capture note",
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-11 border-b border-[var(--color-border)]">
          <Sparkles
            className="w-4 h-4 text-[var(--color-text-subtle)]"
            aria-hidden="true"
          />
          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-subtle)]">
            Quick capture
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick capture"
            className="w-7 h-7 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            placeholder="Title (optional)"
            className="w-full bg-transparent border-0 outline-none text-lg font-semibold text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
            aria-label="Note title"
            spellCheck
            autoComplete="off"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter submits from the body textarea so users can
              // keep newline-on-Enter for normal typing.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            placeholder="What's on your mind? Each line becomes a block."
            rows={5}
            className="w-full bg-transparent border-0 outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-none leading-relaxed"
            aria-label="Note body"
            spellCheck
          />
        </div>

        <div className="flex items-center justify-between px-4 h-10 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[11px] text-[var(--color-text-subtle)]">
          <span className="flex items-center gap-3">
            <span>
              <kbd className="font-mono">Esc</kbd> close
            </span>
            <span>
              <kbd className="font-mono">
                {isMacPlatform() ? "⌘↵" : "Ctrl ↵"}
              </kbd>{" "}
              save
            </span>
          </span>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 h-7 rounded-md transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
