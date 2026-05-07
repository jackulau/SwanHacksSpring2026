import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  Lightbulb,
  Star,
} from "lucide-react";
import type {
  NoteBlock,
  HeadingBlock,
  ParagraphBlock,
  BulletItemBlock,
  NumberedItemBlock,
  TodoBlock,
  ToggleBlock,
  QuoteBlock,
  CalloutBlock,
  CodeBlock,
  DividerBlock,
  ImageBlock,
  TableBlock,
  MathBlock,
  EmbedBlock,
  PageRefBlock,
} from "../../lib/types";
import { SlashMenu } from "./SlashMenu";
import {
  BLOCK_SPECS,
  filterSpecs,
  newId,
  type BlockTypeSpec,
} from "./blockTypes";

interface PageEditorProps {
  blocks: NoteBlock[];
  onChange: (next: NoteBlock[]) => void;
  /** Read-only when true (reading mode). */
  readOnly?: boolean;
  /** Called when the user clicks an internal page reference. */
  onNavigatePage?: (pageId: string) => void;
}

interface SlashState {
  blockId: string;
  query: string;
  anchor: { x: number; y: number };
  selectedIndex: number;
}

/**
 * Block-based, contentEditable, Notion-style editor.
 *
 * Mental model:
 *   - Each block is its own contentEditable surface (or non-editable widget
 *     for divider / image / etc). The editor never owns a single huge
 *     contentEditable — that lets us do precise per-block transforms
 *     (turn-into, drag, slash menu) without parsing flattened HTML.
 *   - State is the canonical NoteBlock[] in props.blocks. We mirror the
 *     text into the DOM via dangerouslySetInnerHTML *only* on initial
 *     mount; thereafter the DOM is the source of truth for what the user
 *     is typing, and we read it on input via textContent. This avoids
 *     the cursor-jump that comes from React re-rendering text into an
 *     element the user is actively editing.
 *   - Markdown shortcuts ("# ", "- ", etc.) intercept input events at
 *     line start and transform the block in-place.
 */
export function PageEditor({
  blocks,
  onChange,
  readOnly = false,
  onNavigatePage,
}: PageEditorProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Track which block id should grab focus on the next render. Used after
  // insert/transform/merge so the caret follows the user's intent.
  const pendingFocusRef = useRef<{ id: string; caret?: "start" | "end" } | null>(null);

  // Map block id -> editable element for direct DOM access (focus, caret).
  const refsRef = useRef<Map<string, HTMLElement>>(new Map());

  const setBlockRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) refsRef.current.set(id, el);
    else refsRef.current.delete(id);
  }, []);

  // Apply pending focus after each render.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = refsRef.current.get(pending.id);
    if (!el) return;
    el.focus();
    if (pending.caret === "end") placeCaretAtEnd(el);
    else if (pending.caret === "start") placeCaretAtStart(el);
    pendingFocusRef.current = null;
  });

  /* ───── block mutations ───── */

  const updateBlock = useCallback(
    (id: string, patch: Partial<NoteBlock>) => {
      onChange(
        blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as NoteBlock) : b)),
      );
    },
    [blocks, onChange],
  );

  const replaceBlock = useCallback(
    (id: string, next: NoteBlock, focusEnd = true) => {
      onChange(blocks.map((b) => (b.id === id ? next : b)));
      pendingFocusRef.current = { id: next.id, caret: focusEnd ? "end" : "start" };
    },
    [blocks, onChange],
  );

  const insertBlockAfter = useCallback(
    (id: string, factory: (id: string) => NoteBlock) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const fresh = factory(newId());
      const next = [...blocks];
      next.splice(idx + 1, 0, fresh);
      onChange(next);
      pendingFocusRef.current = { id: fresh.id, caret: "start" };
    },
    [blocks, onChange],
  );

  const removeBlock = useCallback(
    (id: string, focusPrev = true) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const next = blocks.filter((b) => b.id !== id);
      if (next.length === 0) {
        const fresh: NoteBlock = { id: newId(), type: "paragraph", text: "" };
        onChange([fresh]);
        pendingFocusRef.current = { id: fresh.id };
        return;
      }
      onChange(next);
      if (focusPrev) {
        const target = next[Math.max(0, idx - 1)];
        pendingFocusRef.current = { id: target.id, caret: "end" };
      }
    },
    [blocks, onChange],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const original = blocks[idx];
      const copy = { ...original, id: newId() } as NoteBlock;
      const next = [...blocks];
      next.splice(idx + 1, 0, copy);
      onChange(next);
      pendingFocusRef.current = { id: copy.id, caret: "end" };
    },
    [blocks, onChange],
  );

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const target = idx + dir;
      if (target < 0 || target >= blocks.length) return;
      const next = [...blocks];
      const [b] = next.splice(idx, 1);
      next.splice(target, 0, b);
      onChange(next);
      pendingFocusRef.current = { id, caret: "end" };
    },
    [blocks, onChange],
  );

  const moveBlockTo = useCallback(
    (id: string, targetId: string) => {
      if (id === targetId) return;
      const fromIdx = blocks.findIndex((b) => b.id === id);
      const toIdx = blocks.findIndex((b) => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      const next = [...blocks];
      const [b] = next.splice(fromIdx, 1);
      const adjustedTo = fromIdx < toIdx ? toIdx : toIdx + 1;
      // Insert at adjustedTo so dropping above target lands directly
      // before it; dropping below moves below it.
      next.splice(Math.min(adjustedTo, next.length), 0, b);
      onChange(next);
    },
    [blocks, onChange],
  );

  /* ───── slash menu helpers ───── */

  const openSlashMenu = useCallback((blockId: string) => {
    const sel = window.getSelection();
    let x = 200;
    let y = 200;
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        x = r.left;
        y = r.bottom + 6;
      }
    } else {
      const el = refsRef.current.get(blockId);
      if (el) {
        const r = el.getBoundingClientRect();
        x = r.left;
        y = r.bottom + 6;
      }
    }
    setSlash({ blockId, query: "", anchor: { x, y }, selectedIndex: 0 });
  }, []);

  const closeSlashMenu = useCallback(() => setSlash(null), []);

  const runSlashSelect = useCallback(
    (spec: BlockTypeSpec) => {
      if (!slash) return;
      const targetId = slash.blockId;
      const block = blocks.find((b) => b.id === targetId);
      if (!block) {
        setSlash(null);
        return;
      }
      // Strip the trailing "/query" the user typed before the menu opened
      // out of the current text payload.
      const stripped = stripSlashQuery(block, slash.query);
      const fresh = spec.factory(newId());
      // If the source block is empty (just had "/"), replace it with the
      // chosen block. Otherwise keep its content and insert after.
      const sourceEmpty = blockText(stripped).trim() === "";
      if (sourceEmpty) {
        replaceBlock(targetId, { ...fresh, id: targetId } as NoteBlock, false);
      } else {
        // Persist stripped, then insert after.
        onChange(
          blocks.map((b) => (b.id === targetId ? stripped : b)),
        );
        insertBlockAfter(targetId, (id) => ({ ...fresh, id }));
      }
      setSlash(null);
    },
    [slash, blocks, replaceBlock, insertBlockAfter, onChange],
  );

  const insertBlocksAfter = useCallback(
    (id: string, fresh: NoteBlock[]) => {
      if (fresh.length === 0) return;
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const next = [...blocks];
      next.splice(idx + 1, 0, ...fresh);
      onChange(next);
      pendingFocusRef.current = { id: fresh[fresh.length - 1].id, caret: "end" };
    },
    [blocks, onChange],
  );

  /* ───── paste handler ─────
   * Handles three cases:
   *   1. The clipboard is a single URL on its own line and the current
   *      block is an empty paragraph → swap it for an embed block.
   *   2. The clipboard contains multi-line markdown (with at least one
   *      header / list / code marker) → parse and insert as blocks.
   *   3. Otherwise let the browser handle the paste as plain text. */
  const handlePaste = useCallback(
    (block: NoteBlock, e: React.ClipboardEvent<HTMLElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;
      const trimmed = text.trim();
      const isUrl = /^https?:\/\/\S+$/.test(trimmed);
      const blockIsEmpty = blockText(block).trim() === "";
      if (isUrl && blockIsEmpty && block.type === "paragraph") {
        e.preventDefault();
        replaceBlock(
          block.id,
          { id: block.id, type: "embed", url: trimmed } as NoteBlock,
          false,
        );
        return;
      }
      if (looksLikeMarkdown(text)) {
        e.preventDefault();
        const parsed = parseMarkdownToBlocks(text);
        if (parsed.length === 0) return;
        if (blockIsEmpty) {
          // Replace this block with the first parsed and append the rest.
          const [first, ...rest] = parsed;
          onChange([
            ...blocks.slice(0, blocks.findIndex((b) => b.id === block.id)),
            { ...first, id: block.id } as NoteBlock,
            ...rest,
            ...blocks.slice(blocks.findIndex((b) => b.id === block.id) + 1),
          ]);
          pendingFocusRef.current = {
            id: rest.length > 0 ? rest[rest.length - 1].id : block.id,
            caret: "end",
          };
        } else {
          insertBlocksAfter(block.id, parsed);
        }
      }
    },
    [blocks, onChange, replaceBlock, insertBlocksAfter],
  );

  /* ───── input + key handlers ───── */

  const handleInput = (block: NoteBlock, e: React.FormEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const text = el.textContent ?? "";

    // Markdown shortcut detection — only at line start, only on text-bearing blocks.
    const md = detectMarkdownShortcut(text);
    if (md && (block.type === "paragraph" || block.type === "heading")) {
      const fresh = md.spec.factory(newId());
      const carriedText = text.slice(md.consumed);
      const next: NoteBlock = applyText({ ...fresh, id: block.id } as NoteBlock, carriedText);
      onChange(blocks.map((b) => (b.id === block.id ? next : b)));
      pendingFocusRef.current = { id: block.id, caret: "end" };
      return;
    }

    // Slash menu: open when the user types "/" and keep filtered query in sync.
    if (slash && slash.blockId === block.id) {
      const slashIdx = text.lastIndexOf("/");
      if (slashIdx === -1) {
        setSlash(null);
      } else {
        const query = text.slice(slashIdx + 1);
        const filtered = filterSpecs(query);
        setSlash({
          ...slash,
          query,
          selectedIndex: Math.min(slash.selectedIndex, Math.max(0, filtered.length - 1)),
        });
      }
    } else if (text.endsWith("/")) {
      openSlashMenu(block.id);
    }

    // Persist text into the canonical block model.
    if (
      block.type === "paragraph" ||
      block.type === "heading" ||
      block.type === "bullet_item" ||
      block.type === "numbered_item" ||
      block.type === "todo" ||
      block.type === "toggle" ||
      block.type === "quote"
    ) {
      // Avoid round-tripping React-controlled text into the DOM (which
      // would yank the caret). Just update the model with the raw value.
      updateBlock(block.id, { text } as Partial<NoteBlock>);
    }
  };

  const handleKeyDown = (block: NoteBlock, e: React.KeyboardEvent<HTMLElement>) => {
    // Slash menu navigation has priority over editor keys.
    if (slash && slash.blockId === block.id) {
      const filtered = filterSpecs(slash.query);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash({
          ...slash,
          selectedIndex: Math.min(filtered.length - 1, slash.selectedIndex + 1),
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash({ ...slash, selectedIndex: Math.max(0, slash.selectedIndex - 1) });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const spec = filtered[slash.selectedIndex];
        if (spec) runSlashSelect(spec);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    // Cmd/Ctrl+D — duplicate
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateBlock(block.id);
      return;
    }
    // Inline formatting — only meaningful inside contenteditable blocks.
    // We rely on document.execCommand which still ships in every browser
    // for our usage (bold/italic/underline). We do NOT use it for text
    // input mutation; the input handler still owns that.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u") {
        const cmd = k === "b" ? "bold" : k === "i" ? "italic" : "underline";
        e.preventDefault();
        document.execCommand(cmd, false);
        // Mirror back into model so re-render preserves formatting.
        const el = e.currentTarget;
        // Persist innerHTML into the text payload — wrapping markdown-style
        // markers around the formatted run so the text round-trips even if
        // it later renders through the markdown reader. For now we just
        // store textContent; rich inline persistence is opt-in next pass.
        if (block.type === "paragraph" || block.type === "heading") {
          updateBlock(block.id, { text: el.textContent ?? "" } as Partial<NoteBlock>);
        }
        return;
      }
      if (k === "e") {
        e.preventDefault();
        // Inline code — wrap selection with backticks.
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const r = sel.getRangeAt(0);
          const text = r.toString();
          r.deleteContents();
          r.insertNode(document.createTextNode("`" + text + "`"));
        }
        return;
      }
    }
    // Cmd/Ctrl+Shift+ArrowUp/Down — move
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBlock(block.id, e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // For text-bearing blocks: Enter creates a same-type continuation.
      if (
        block.type === "bullet_item" ||
        block.type === "numbered_item" ||
        block.type === "todo"
      ) {
        const text = (e.currentTarget.textContent ?? "").trim();
        if (text === "") {
          // Empty list item — exit the list with a paragraph.
          e.preventDefault();
          replaceBlock(block.id, { id: block.id, type: "paragraph", text: "" } as ParagraphBlock);
          return;
        }
        e.preventDefault();
        if (block.type === "todo") {
          insertBlockAfter(block.id, (id) => ({ id, type: "todo", text: "", checked: false }));
        } else if (block.type === "bullet_item") {
          insertBlockAfter(block.id, (id) => ({ id, type: "bullet_item", text: "" }));
        } else {
          insertBlockAfter(block.id, (id) => ({ id, type: "numbered_item", text: "" }));
        }
        return;
      }
      // For headings, Enter drops to a paragraph.
      if (block.type === "heading") {
        e.preventDefault();
        insertBlockAfter(block.id, (id) => ({ id, type: "paragraph", text: "" }));
        return;
      }
      if (block.type === "paragraph" || block.type === "quote") {
        e.preventDefault();
        insertBlockAfter(block.id, (id) => ({ id, type: "paragraph", text: "" }));
        return;
      }
    }

    if (e.key === "Backspace") {
      const el = e.currentTarget;
      const empty = (el.textContent ?? "").length === 0;
      const atStart = isCaretAtStart(el);
      if (empty) {
        e.preventDefault();
        removeBlock(block.id);
        return;
      }
      if (atStart && (block.type === "heading" || block.type === "quote" || block.type === "callout")) {
        // Convert exotic blocks back to plain paragraph rather than deleting.
        e.preventDefault();
        replaceBlock(block.id, {
          id: block.id,
          type: "paragraph",
          text: blockText(block),
        } as ParagraphBlock);
        return;
      }
    }

    if (e.key === "ArrowUp" && isCaretAtStart(e.currentTarget)) {
      const idx = blocks.findIndex((b) => b.id === block.id);
      const prev = blocks[idx - 1];
      if (prev) {
        const el = refsRef.current.get(prev.id);
        if (el) {
          e.preventDefault();
          el.focus();
          placeCaretAtEnd(el);
        }
      }
    }
    if (e.key === "ArrowDown" && isCaretAtEnd(e.currentTarget)) {
      const idx = blocks.findIndex((b) => b.id === block.id);
      const next = blocks[idx + 1];
      if (next) {
        const el = refsRef.current.get(next.id);
        if (el) {
          e.preventDefault();
          el.focus();
          placeCaretAtStart(el);
        }
      }
    }
  };

  /* ───── drag handlers ───── */

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId(id);
  };
  const handleDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = e.dataTransfer.getData("text/plain") || draggedId;
    if (src && src !== id) moveBlockTo(src, id);
    setDraggedId(null);
    setDropTargetId(null);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  /* ───── render ───── */

  // Numbered-list rendering needs running counters.
  const numberByIndex = useMemo(() => computeNumbering(blocks), [blocks]);

  return (
    <div className="relative" data-page-editor>
      {blocks.map((block, i) => (
        <BlockRow
          key={block.id}
          block={block}
          index={i}
          number={numberByIndex[i]}
          readOnly={readOnly}
          isFocused={focusedId === block.id}
          isHovered={hoveredId === block.id}
          isDragOver={dropTargetId === block.id}
          isDragging={draggedId === block.id}
          setRef={setBlockRef}
          onFocus={() => setFocusedId(block.id)}
          onBlur={() => setFocusedId((id) => (id === block.id ? null : id))}
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId((id) => (id === block.id ? null : id))}
          onInput={(e) => handleInput(block, e)}
          onKeyDown={(e) => handleKeyDown(block, e)}
          onPaste={(e) => handlePaste(block, e)}
          onUpdate={(patch) => updateBlock(block.id, patch)}
          onInsertAfter={(factory) => insertBlockAfter(block.id, factory)}
          onRemove={() => removeBlock(block.id)}
          onDuplicate={() => duplicateBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
          onTransformTo={(spec) =>
            replaceBlock(block.id, { ...spec.factory(newId()), id: block.id } as NoteBlock)
          }
          onOpenSlash={() => openSlashMenu(block.id)}
          onNavigatePage={onNavigatePage}
          onDragStart={handleDragStart(block.id)}
          onDragOver={handleDragOver(block.id)}
          onDrop={handleDrop(block.id)}
          onDragEnd={handleDragEnd}
        />
      ))}

      {slash && (
        <SlashMenu
          query={slash.query}
          anchor={slash.anchor}
          selectedIndex={slash.selectedIndex}
          onSelect={runSlashSelect}
          onHover={(idx) => setSlash((s) => (s ? { ...s, selectedIndex: idx } : s))}
          onClose={closeSlashMenu}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Per-block row — wraps the block surface with handle + drop target.
   ═══════════════════════════════════════════════════════════════════ */

interface BlockRowProps {
  block: NoteBlock;
  index: number;
  number?: number;
  readOnly: boolean;
  isFocused: boolean;
  isHovered: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  setRef: (id: string, el: HTMLElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onInput: (e: React.FormEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLElement>) => void;
  onUpdate: (patch: Partial<NoteBlock>) => void;
  onInsertAfter: (factory: (id: string) => NoteBlock) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTransformTo: (spec: BlockTypeSpec) => void;
  onOpenSlash: () => void;
  onNavigatePage?: (pageId: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

function BlockRow(props: BlockRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    block,
    readOnly,
    isHovered,
    isDragOver,
    isDragging,
    setRef,
    onFocus,
    onBlur,
    onMouseEnter,
    onMouseLeave,
    onInput,
    onKeyDown,
    onPaste,
    onUpdate,
    onInsertAfter,
    onRemove,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onTransformTo,
    onOpenSlash,
    onNavigatePage,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = props;

  return (
    <div
      className={`group/row relative flex items-start gap-1 -mx-12 pl-12 pr-2 py-px transition-colors ${
        isDragOver ? "bg-[var(--color-primary-soft)]" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-block-id={block.id}
    >
      {!readOnly && (
        <div
          className={`absolute left-0 top-1 flex items-center gap-0.5 transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            aria-label="Add block below"
            onClick={() => onInsertAfter((id) => ({ id, type: "paragraph", text: "" }))}
            className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Block menu"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => setMenuOpen((v) => !v)}
            className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {menuOpen && (
            <BlockContextMenu
              currentType={block.type}
              onClose={() => setMenuOpen(false)}
              onTransform={onTransformTo}
              onDuplicate={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
              onMoveUp={() => {
                onMoveUp();
                setMenuOpen(false);
              }}
              onMoveDown={() => {
                onMoveDown();
                setMenuOpen(false);
              }}
              onRemove={() => {
                onRemove();
                setMenuOpen(false);
              }}
            />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0" data-block-content>
        <BlockSurface
          block={block}
          number={props.number}
          readOnly={readOnly}
          setRef={setRef}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onUpdate={onUpdate}
          onOpenSlash={onOpenSlash}
          onNavigatePage={onNavigatePage}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Context menu — turn into / move / duplicate / delete.
   ═══════════════════════════════════════════════════════════════════ */

interface BlockContextMenuProps {
  currentType: NoteBlock["type"];
  onClose: () => void;
  onTransform: (spec: BlockTypeSpec) => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function BlockContextMenu({
  currentType,
  onClose,
  onTransform,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onRemove,
}: BlockContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute left-0 top-7 z-30 w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] py-1 text-sm"
    >
      <MenuItem onClick={onDuplicate} icon={Copy} label="Duplicate" hint="Cmd+D" />
      <MenuItem onClick={onMoveUp} icon={ArrowUp} label="Move up" hint="Cmd+Shift+Up" />
      <MenuItem onClick={onMoveDown} icon={ArrowDown} label="Move down" hint="Cmd+Shift+Down" />
      <MenuItem onClick={onRemove} icon={Trash2} label="Delete" danger />

      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] font-medium border-t border-[var(--color-border)] mt-1">
        Turn into
      </div>
      <div className="max-h-56 overflow-y-auto">
        {BLOCK_SPECS.filter((s) => s.id !== currentType).map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={`${s.label}`}
              type="button"
              onClick={() => onTransform(s)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            >
              <Icon className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  icon: typeof Plus;
  label: string;
  hint?: string;
  danger?: boolean;
}

function MenuItem({ onClick, icon: Icon, label, hint, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-surface-raised)] ${
        danger ? "text-[var(--color-error)]" : "text-[var(--color-text-muted)]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="text-[10px] font-mono text-[var(--color-text-subtle)]">{hint}</kbd>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Per-type rendering surface — the actual editable element / widget.
   ═══════════════════════════════════════════════════════════════════ */

interface BlockSurfaceProps {
  block: NoteBlock;
  number?: number;
  readOnly: boolean;
  setRef: (id: string, el: HTMLElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onInput: (e: React.FormEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLElement>) => void;
  onUpdate: (patch: Partial<NoteBlock>) => void;
  onOpenSlash: () => void;
  onNavigatePage?: (pageId: string) => void;
}

function BlockSurface({
  block,
  number,
  readOnly,
  setRef,
  onFocus,
  onBlur,
  onInput,
  onKeyDown,
  onPaste,
  onUpdate,
  onNavigatePage,
}: BlockSurfaceProps) {
  switch (block.type) {
    case "paragraph":
      return (
        <Editable
          block={block}
          tag="p"
          className="text-[var(--color-text)] leading-7 min-h-[1.75rem]"
          placeholder="Type or press / for commands"
          readOnly={readOnly}
          setRef={setRef}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      );

    case "heading": {
      const h = block as HeadingBlock;
      const cls =
        h.level === 1
          ? "text-3xl font-semibold text-[var(--color-text)] tracking-tight mt-6 mb-1"
          : h.level === 2
            ? "text-2xl font-semibold text-[var(--color-text)] tracking-tight mt-5 mb-1"
            : "text-xl font-semibold text-[var(--color-text)] tracking-tight mt-4 mb-1";
      return (
        <Editable
          block={block}
          tag={`h${h.level + 1}`}
          className={cls}
          placeholder={`Heading ${h.level}`}
          readOnly={readOnly}
          setRef={setRef}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      );
    }

    case "bullet_item":
      return (
        <div className="flex items-start gap-2">
          <span className="mt-3 w-1.5 h-1.5 rounded-full bg-[var(--color-text)] shrink-0" aria-hidden="true" />
          <Editable
            block={block}
            tag="div"
            className="flex-1 text-[var(--color-text)] leading-7 min-h-[1.75rem]"
            placeholder="List item"
            readOnly={readOnly}
            setRef={setRef}
            onFocus={onFocus}
            onBlur={onBlur}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </div>
      );

    case "numbered_item":
      return (
        <div className="flex items-start gap-2">
          <span className="mt-1 text-[var(--color-text-subtle)] tabular-nums leading-7 select-none w-5 text-right">
            {number ?? 1}.
          </span>
          <Editable
            block={block}
            tag="div"
            className="flex-1 text-[var(--color-text)] leading-7 min-h-[1.75rem]"
            placeholder="List item"
            readOnly={readOnly}
            setRef={setRef}
            onFocus={onFocus}
            onBlur={onBlur}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </div>
      );

    case "todo": {
      const t = block as TodoBlock;
      return (
        <div className="flex items-start gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={t.checked}
            aria-label={t.checked ? "Mark incomplete" : "Mark complete"}
            onClick={() => onUpdate({ checked: !t.checked } as Partial<NoteBlock>)}
            className={`mt-1.5 w-4 h-4 rounded border grid place-items-center transition-colors shrink-0 ${
              t.checked
                ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
            }`}
          >
            {t.checked && <Check className="w-3 h-3" aria-hidden="true" />}
          </button>
          <Editable
            block={block}
            tag="div"
            className={`flex-1 text-[var(--color-text)] leading-7 min-h-[1.75rem] ${
              t.checked ? "line-through text-[var(--color-text-subtle)]" : ""
            }`}
            placeholder="To-do"
            readOnly={readOnly}
            setRef={setRef}
            onFocus={onFocus}
            onBlur={onBlur}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </div>
      );
    }

    case "toggle": {
      const t = block as ToggleBlock;
      return (
        <div>
          <div className="flex items-start gap-1">
            <button
              type="button"
              aria-label={t.open ? "Collapse toggle" : "Expand toggle"}
              onClick={() => onUpdate({ open: !t.open } as Partial<NoteBlock>)}
              className="mt-1 w-5 h-5 grid place-items-center rounded text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] shrink-0"
            >
              {t.open ? (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            <Editable
              block={block}
              tag="div"
              className="flex-1 text-[var(--color-text)] leading-7 min-h-[1.75rem] font-medium"
              placeholder="Toggle"
              readOnly={readOnly}
              setRef={setRef}
              onFocus={onFocus}
              onBlur={onBlur}
              onInput={onInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
          </div>
          {t.open && t.children.length > 0 && (
            <div className="ml-7 border-l border-[var(--color-border)] pl-4 my-1 text-[var(--color-text-muted)]">
              {t.children.map((c) => (
                <div key={c.id} className="my-1">
                  {blockText(c) || "Empty"}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "quote": {
      const q = block as QuoteBlock;
      return (
        <Editable
          block={q}
          tag="blockquote"
          className="border-l-2 border-[var(--color-text)] pl-4 italic text-[var(--color-text-muted)] leading-7 min-h-[1.75rem]"
          placeholder="Quote"
          readOnly={readOnly}
          setRef={setRef}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      );
    }

    case "callout": {
      const c = block as CalloutBlock;
      const icons = {
        important: <Star className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-1.5" aria-hidden="true" />,
        confusion: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-1.5" aria-hidden="true" />,
        tip: <Lightbulb className="w-4 h-4 text-[var(--color-primary-strong)] shrink-0 mt-1.5" aria-hidden="true" />,
      };
      return (
        <div className="flex items-start gap-3 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)]/40 p-3">
          {icons[c.variant]}
          <div className="flex-1 min-w-0">
            <select
              value={c.variant}
              onChange={(e) => onUpdate({ variant: e.target.value } as Partial<NoteBlock>)}
              className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] bg-transparent border-0 outline-none mb-1 cursor-pointer"
              disabled={readOnly}
            >
              <option value="tip">Tip</option>
              <option value="important">Important</option>
              <option value="confusion">Watch out</option>
            </select>
            <Editable
              block={c}
              tag="div"
              className="text-[var(--color-text)] leading-7 min-h-[1.5rem]"
              placeholder="Callout text"
              readOnly={readOnly}
              setRef={setRef}
              onFocus={onFocus}
              onBlur={onBlur}
              onInput={onInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
          </div>
        </div>
      );
    }

    case "code": {
      const cb = block as CodeBlock;
      return (
        <CodeBlockSurface
          block={cb}
          readOnly={readOnly}
          onUpdate={onUpdate}
          onKeyDown={onKeyDown}
          setRef={setRef}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    }

    case "divider": {
      const _d = block as DividerBlock;
      void _d;
      return (
        <div
          className="py-3"
          tabIndex={0}
          ref={(el) => setRef(block.id, el)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        >
          <hr className="border-0 border-t border-[var(--color-border-strong)]" />
        </div>
      );
    }

    case "image": {
      const im = block as ImageBlock;
      return <ImageBlockSurface block={im} readOnly={readOnly} onUpdate={onUpdate} />;
    }

    case "table": {
      const tb = block as TableBlock;
      return <TableBlockSurface block={tb} readOnly={readOnly} onUpdate={onUpdate} />;
    }

    case "math": {
      const mb = block as MathBlock;
      return <MathBlockSurface block={mb} readOnly={readOnly} onUpdate={onUpdate} />;
    }

    case "embed": {
      const eb = block as EmbedBlock;
      return <EmbedBlockSurface block={eb} readOnly={readOnly} onUpdate={onUpdate} />;
    }

    case "page_ref": {
      const pr = block as PageRefBlock;
      return (
        <button
          type="button"
          onClick={() => pr.pageId && onNavigatePage?.(pr.pageId)}
          className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline"
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="font-medium">{pr.title || "Untitled"}</span>
        </button>
      );
    }

    default:
      return <div className="text-[var(--color-text-subtle)] text-sm">Unknown block</div>;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Editable — the contentEditable primitive for text-bearing blocks.
   ═══════════════════════════════════════════════════════════════════ */

interface EditableProps {
  block: NoteBlock;
  tag: string;
  className?: string;
  placeholder?: string;
  readOnly: boolean;
  setRef: (id: string, el: HTMLElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onInput: (e: React.FormEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLElement>) => void;
  style?: CSSProperties;
}

function Editable({
  block,
  tag,
  className,
  placeholder,
  readOnly,
  setRef,
  onFocus,
  onBlur,
  onInput,
  onKeyDown,
  onPaste,
  style,
}: EditableProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const initialText = useRef(blockText(block));

  // Mount with initial text. Subsequent text changes flow DOM->state, not
  // the other way around, so React doesn't yank the caret while typing.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (el.textContent !== initialText.current) {
      el.textContent = initialText.current;
    }
    setRef(block.id, el);
    return () => setRef(block.id, null);
    // intentionally only on mount — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External text mutations (e.g. block transform back to paragraph) need
  // to be reflected. Detect by comparing prop text vs current DOM text;
  // if they diverge AND the element isn't currently focused, repaint.
  const textNow = blockText(block);
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== textNow) el.textContent = textNow;
  }, [textNow]);

  const showPlaceholder = textNow === "" && !readOnly;
  return React.createElement(tag as string, {
    ref: (el: HTMLElement | null) => {
      elRef.current = el;
    },
    contentEditable: !readOnly,
    suppressContentEditableWarning: true,
    "data-placeholder": showPlaceholder ? placeholder : undefined,
    className: `${className ?? ""} outline-none focus:outline-none editable-block`,
    style,
    onFocus,
    onBlur,
    onInput,
    onKeyDown,
    onPaste,
    spellCheck: true,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Specialised block surfaces.
   ═══════════════════════════════════════════════════════════════════ */

function CodeBlockSurface({
  block,
  readOnly,
  onUpdate,
  onKeyDown,
  setRef,
  onFocus,
  onBlur,
}: {
  block: CodeBlock;
  readOnly: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  setRef: (id: string, el: HTMLElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [block.code]);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
        <select
          value={block.language}
          onChange={(e) => onUpdate({ language: e.target.value } as Partial<NoteBlock>)}
          disabled={readOnly}
          className="text-[11px] bg-transparent text-[var(--color-text-muted)] outline-none cursor-pointer"
        >
          {[
            "plaintext",
            "javascript",
            "typescript",
            "python",
            "go",
            "rust",
            "java",
            "c",
            "cpp",
            "html",
            "css",
            "json",
            "yaml",
            "bash",
            "sql",
            "markdown",
          ].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(block.code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            });
          }}
          className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        ref={(el) => {
          taRef.current = el;
          setRef(block.id, el);
        }}
        value={block.code}
        readOnly={readOnly}
        onChange={(e) => onUpdate({ code: e.target.value } as Partial<NoteBlock>)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          // Tab inserts two spaces in code blocks instead of jumping focus.
          if (e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const next = ta.value.slice(0, start) + "  " + ta.value.slice(end);
            onUpdate({ code: next } as Partial<NoteBlock>);
            window.requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 2;
            });
            return;
          }
          onKeyDown(e as unknown as React.KeyboardEvent<HTMLElement>);
        }}
        spellCheck={false}
        placeholder="// code"
        className="w-full bg-transparent text-sm font-mono text-[var(--color-primary-strong)] leading-6 px-3 py-2 outline-none resize-none border-0"
      />
    </div>
  );
}

function ImageBlockSurface({
  block,
  readOnly,
  onUpdate,
}: {
  block: ImageBlock;
  readOnly: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
}) {
  if (!block.url && !readOnly) {
    return (
      <div className="border border-dashed border-[var(--color-border)] rounded-md p-4 bg-[var(--color-surface-raised)]/40">
        <input
          type="url"
          placeholder="Paste an image URL"
          autoFocus
          className="w-full bg-transparent text-sm outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
          onBlur={(e) => onUpdate({ url: e.target.value } as Partial<NoteBlock>)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onUpdate({ url: (e.target as HTMLInputElement).value } as Partial<NoteBlock>);
            }
          }}
        />
      </div>
    );
  }
  return (
    <figure className="my-1">
      <img
        src={block.url}
        alt={block.alt ?? ""}
        loading="lazy"
        decoding="async"
        className="rounded-md max-w-full"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0.4";
        }}
      />
      {!readOnly && (
        <input
          type="text"
          defaultValue={block.caption ?? ""}
          placeholder="Caption (optional)"
          onBlur={(e) => onUpdate({ caption: e.target.value } as Partial<NoteBlock>)}
          className="w-full mt-2 bg-transparent text-xs outline-none text-[var(--color-text-subtle)] placeholder:text-[var(--color-text-subtle)] text-center"
        />
      )}
      {readOnly && block.caption && (
        <figcaption className="text-xs text-[var(--color-text-subtle)] mt-2 text-center">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function TableBlockSurface({
  block,
  readOnly,
  onUpdate,
}: {
  block: TableBlock;
  readOnly: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
}) {
  const updateCell = (r: number, c: number, value: string) => {
    const rows = block.rows.map((row) => [...row]);
    rows[r][c] = value;
    onUpdate({ rows } as Partial<NoteBlock>);
  };
  const addRow = () => {
    const cols = block.rows[0]?.length ?? 1;
    onUpdate({ rows: [...block.rows, Array(cols).fill("")] } as Partial<NoteBlock>);
  };
  const addCol = () => {
    onUpdate({ rows: block.rows.map((r) => [...r, ""]) } as Partial<NoteBlock>);
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const isHeader = block.hasHeader && ri === 0;
                const Tag = isHeader ? "th" : "td";
                return (
                  <Tag
                    key={ci}
                    className={`border border-[var(--color-border)] px-3 py-1.5 text-sm align-top min-w-[120px] ${
                      isHeader ? "bg-[var(--color-surface-raised)] font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    <div
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      onBlur={(e) => updateCell(ri, ci, e.currentTarget.textContent ?? "")}
                      className="outline-none min-w-[60px]"
                    >
                      {cell}
                    </div>
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={addRow}
            className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] inline-flex items-center gap-1 px-2 py-1 border border-[var(--color-border)] rounded"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> Row
          </button>
          <button
            type="button"
            onClick={addCol}
            className="text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] inline-flex items-center gap-1 px-2 py-1 border border-[var(--color-border)] rounded"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> Column
          </button>
        </div>
      )}
    </div>
  );
}

function MathBlockSurface({
  block,
  readOnly,
  onUpdate,
}: {
  block: MathBlock;
  readOnly: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
}) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 rounded-md px-4 py-3 font-mono text-center text-[var(--color-text)]">
      {readOnly ? (
        <span>{block.expression || "(empty math)"}</span>
      ) : (
        <input
          type="text"
          defaultValue={block.expression}
          placeholder="\frac{a}{b} = c"
          onBlur={(e) => onUpdate({ expression: e.target.value } as Partial<NoteBlock>)}
          className="w-full bg-transparent text-center outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
        />
      )}
    </div>
  );
}

function EmbedBlockSurface({
  block,
  readOnly,
  onUpdate,
}: {
  block: EmbedBlock;
  readOnly: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
}) {
  if (!block.url && !readOnly) {
    return (
      <div className="border border-dashed border-[var(--color-border)] rounded-md p-4 bg-[var(--color-surface-raised)]/40">
        <input
          type="url"
          autoFocus
          placeholder="Paste a URL to embed"
          onBlur={(e) => onUpdate({ url: e.target.value } as Partial<NoteBlock>)}
          className="w-full bg-transparent text-sm outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
        />
      </div>
    );
  }
  return (
    <a
      href={block.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-[var(--color-border)] rounded-md px-3 py-2 bg-[var(--color-surface-raised)]/40 hover:border-[var(--color-primary)] transition-colors"
    >
      <div className="text-xs text-[var(--color-text-subtle)] uppercase tracking-wider mb-0.5">
        Embed
      </div>
      <div className="text-sm text-[var(--color-text)] truncate">{block.title || block.url}</div>
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers — text accessors, caret math, markdown shortcuts.
   ═══════════════════════════════════════════════════════════════════ */

function blockText(block: NoteBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
    case "callout":
    case "bullet_item":
    case "numbered_item":
    case "todo":
    case "toggle":
    case "example":
      return (block as { text: string }).text ?? "";
    default:
      return "";
  }
}

function applyText(block: NoteBlock, text: string): NoteBlock {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
    case "callout":
    case "bullet_item":
    case "numbered_item":
    case "todo":
    case "toggle":
    case "example":
      return { ...(block as object), text } as NoteBlock;
    default:
      return block;
  }
}

function stripSlashQuery(block: NoteBlock, query: string): NoteBlock {
  const t = blockText(block);
  const slashAt = t.lastIndexOf("/" + query);
  if (slashAt === -1) return block;
  return applyText(block, t.slice(0, slashAt));
}

interface MarkdownShortcut {
  consumed: number;
  spec: BlockTypeSpec;
}

function detectMarkdownShortcut(text: string): MarkdownShortcut | null {
  // Headings — matched at line start.
  if (text.startsWith("# ")) return shortcut(2, "Heading 1");
  if (text.startsWith("## ")) return shortcut(3, "Heading 2");
  if (text.startsWith("### ")) return shortcut(4, "Heading 3");
  if (text.startsWith("- ") || text.startsWith("* ")) return shortcut(2, "Bulleted list");
  if (/^\d+\.\s/.test(text)) {
    const m = text.match(/^\d+\.\s/);
    if (m) return shortcut(m[0].length, "Numbered list");
  }
  if (text.startsWith("[] ") || text.startsWith("[ ] ")) {
    return shortcut(text.startsWith("[] ") ? 3 : 4, "To-do");
  }
  if (text.startsWith("[x] ") || text.startsWith("[X] ")) return shortcut(4, "To-do");
  if (text.startsWith("> ")) return shortcut(2, "Quote");
  if (text === "```" || text.startsWith("``` ")) return shortcut(text.length, "Code");
  if (text === "---") return shortcut(3, "Divider");
  return null;
}

function shortcut(consumed: number, label: string): MarkdownShortcut | null {
  const spec = BLOCK_SPECS.find((s) => s.label === label);
  if (!spec) return null;
  return { consumed, spec };
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function placeCaretAtStart(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function isCaretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const test = document.createRange();
  test.selectNodeContents(el);
  test.setEnd(r.startContainer, r.startOffset);
  return test.toString().length === 0;
}

function isCaretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const test = document.createRange();
  test.selectNodeContents(el);
  test.setStart(r.endContainer, r.endOffset);
  return test.toString().length === 0;
}

/**
 * Cheap heuristic — if a string contains any of the obvious markdown
 * markers and at least one newline, treat it as markdown for paste
 * purposes. We don't try to be a full CommonMark parser; we only need
 * to do better than a wall-of-text paste.
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text.includes("\n")) return false;
  return /^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|>\s|```|---)/m.test(text);
}

/**
 * Markdown-to-block parser used by paste. Supports the same shortcut
 * vocabulary as the at-line-start markdown shortcuts: headings, bullet
 * lists, numbered lists, todos, blockquotes, code fences, and dividers.
 * Anything else is treated as a paragraph block (one block per blank-
 * line-separated section).
 */
function parseMarkdownToBlocks(src: string): NoteBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: NoteBlock[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length === 0) return;
    out.push({ id: newId(), type: "paragraph", text: para.join(" ") });
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      flushPara();
      const lang = line.slice(3).trim() || "plaintext";
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      out.push({ id: newId(), type: "code", language: lang, code: code.join("\n") });
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushPara();
      out.push({ id: newId(), type: "divider" });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      out.push({
        id: newId(),
        type: "heading",
        level: h[1].length as 1 | 2 | 3,
        text: h[2],
      });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      out.push({ id: newId(), type: "bullet_item", text: line.replace(/^\s*[-*]\s+/, "") });
      i++;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      out.push({
        id: newId(),
        type: "numbered_item",
        text: line.replace(/^\s*\d+\.\s+/, ""),
      });
      i++;
      continue;
    }
    if (/^\s*\[[\sxX]\]\s+/.test(line)) {
      flushPara();
      const checked = /^\s*\[[xX]\]/.test(line);
      out.push({
        id: newId(),
        type: "todo",
        text: line.replace(/^\s*\[[\sxX]\]\s+/, ""),
        checked,
      });
      i++;
      continue;
    }
    if (/^>\s/.test(line)) {
      flushPara();
      out.push({ id: newId(), type: "quote", text: line.replace(/^>\s/, "") });
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return out;
}

function computeNumbering(blocks: NoteBlock[]): Record<number, number> {
  const out: Record<number, number> = {};
  let counter = 0;
  blocks.forEach((b, i) => {
    if (b.type === "numbered_item") {
      counter += 1;
      out[i] = counter;
    } else {
      counter = 0;
    }
  });
  return out;
}
