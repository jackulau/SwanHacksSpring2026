// Inline AI menu — selection-driven action popover that floats above the
// note editor. When the user has a non-empty selection inside the editor
// container, a small floating bar appears with actions:
//
//   Improve writing | Summarize | Convert to bullets | Extract questions
//
// Each action runs the selection through the configured LLM provider and
// either replaces the selection in place (Improve, Bullets) or inserts a
// new block under the source (Summarize, Extract questions). The action
// is best-effort: when the LLM provider is unavailable, the StubProvider
// returns deterministic placeholder text so the surface still shows
// something useful instead of an error.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ListChecks,
  ListTree,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { resolveProvider } from "../../lib/llm/providers";
import type { LlmProvider } from "../../lib/llm/providers";

type InlineAction = "improve" | "summarize" | "bullets" | "questions";

interface SelectionInfo {
  text: string;
  rect: DOMRect;
  range: Range;
}

interface InlineAiMenuProps {
  /** A ref to the container element that wraps the editor. The menu only
   *  fires when the selection is fully inside this element. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Optional: override the inferred replacement (e.g. for read-only). */
  readOnly?: boolean;
}

const ACTION_LABELS: Record<InlineAction, string> = {
  improve: "Improve writing",
  summarize: "Summarize",
  bullets: "Convert to bullets",
  questions: "Extract questions",
};

const ACTION_ICONS: Record<InlineAction, typeof Wand2> = {
  improve: Wand2,
  summarize: Sparkles,
  bullets: ListTree,
  questions: ListChecks,
};

const PROMPTS: Record<InlineAction, (input: string) => string> = {
  improve: (input) =>
    `Rewrite the following passage so it reads better — clearer, more concise, no filler. Output only the rewritten passage, no preamble.\n\n${input}`,
  summarize: (input) =>
    `Summarize the following passage in one tight paragraph. Output only the summary.\n\n${input}`,
  bullets: (input) =>
    `Convert the following passage into a bulleted list. One bullet per idea. Use '-' as the bullet marker. Output only the list.\n\n${input}`,
  questions: (input) =>
    `Read the following passage and extract 3-6 study questions covering the key points. One question per line, no numbering. Output only the questions.\n\n${input}`,
};

export function InlineAiMenu({ containerRef, readOnly }: InlineAiMenuProps) {
  const [info, setInfo] = useState<SelectionInfo | null>(null);
  const [pending, setPending] = useState<InlineAction | null>(null);
  const [provider, setProvider] = useState<LlmProvider | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Lazy-resolve the provider on first selection so the page render
  // doesn't pay for a network probe.
  useEffect(() => {
    if (!info || provider) return;
    void resolveProvider("anthropic").then(setProvider);
  }, [info, provider]);

  // Track the selection inside the container. We update on selectionchange
  // because mouseup / keyup miss programmatic selections.
  useEffect(() => {
    if (readOnly) return;
    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setInfo(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container) {
        setInfo(null);
        return;
      }
      const inside =
        container.contains(range.startContainer) &&
        container.contains(range.endContainer);
      if (!inside) {
        setInfo(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 10) {
        setInfo(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setInfo(null);
        return;
      }
      setInfo({ text, rect, range });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [containerRef, readOnly]);

  // Hide the popover when clicking outside it (without losing the
  // selection range — selection persists for a moment).
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!info) return;
      const target = e.target as Node | null;
      if (popoverRef.current?.contains(target)) return;
      // We only hide if the click is also outside the editor, otherwise the
      // user is just clicking another word.
      const container = containerRef.current;
      if (target && container?.contains(target)) return;
      setInfo(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [info, containerRef]);

  const runAction = useCallback(
    async (action: InlineAction) => {
      if (!info || pending) return;
      const p = provider ?? (await resolveProvider("anthropic"));
      if (!provider) setProvider(p);
      setPending(action);
      try {
        const completion = await p.complete(
          [
            {
              role: "system",
              content:
                "You are a focused writing assistant inside a study notes app. Keep replies tight, no preamble.",
            },
            { role: "user", content: PROMPTS[action](info.text) },
          ],
          { maxTokens: 400, temperature: 0.4 },
        );
        const out = (completion.text || "").trim();
        if (!out) return;
        // Strategy:
        //   - improve / bullets   → replace selection with output
        //   - summarize / questions → insert output AFTER selection
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        if (action === "improve" || action === "bullets") {
          info.range.deleteContents();
          info.range.insertNode(document.createTextNode(out));
        } else {
          const after = info.range.cloneRange();
          after.collapse(false);
          const node = document.createTextNode("\n\n" + out + "\n\n");
          after.insertNode(node);
        }
        // Fire input event on the contenteditable so the editor's
        // onChange picks up the mutation. PageEditor reacts to input
        // events on its blocks, so we dispatch one bubbling event.
        const target = info.range.startContainer.parentElement;
        target?.dispatchEvent(new InputEvent("input", { bubbles: true }));
        setInfo(null);
      } finally {
        setPending(null);
      }
    },
    [info, pending, provider],
  );

  if (!info || readOnly) return null;

  // Position above the selection. If the selection sits at the top of the
  // viewport, flip below.
  const top = info.rect.top + window.scrollY;
  const flipBelow = top - 56 < window.scrollY + 8;
  const popoverTop = flipBelow ? info.rect.bottom + window.scrollY + 8 : top - 44;
  const left = info.rect.left + window.scrollX + info.rect.width / 2;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: popoverTop,
        left,
        transform: "translateX(-50%)",
        zIndex: 40,
      }}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] p-1 flex items-center gap-0.5 text-xs"
      role="toolbar"
      aria-label="Inline AI actions"
    >
      {(Object.keys(ACTION_LABELS) as InlineAction[]).map((a) => {
        const Icon = ACTION_ICONS[a];
        return (
          <button
            key={a}
            type="button"
            disabled={pending !== null}
            onClick={() => void runAction(a)}
            className="inline-flex items-center gap-1 px-2 h-7 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
          >
            {pending === a ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {ACTION_LABELS[a]}
          </button>
        );
      })}
      <span className="ml-1 mr-1 px-1 text-[10px] text-[var(--color-text-subtle)]">
        {provider?.id ?? "…"}
      </span>
    </div>
  );
}
