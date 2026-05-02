import { useEffect, useRef, useState } from "react";
import { usePreferences } from "../../lib/preferences";

const PARAGRAPH_SELECTOR = "p, li, blockquote, pre, h1, h2, h3, h4, h5, h6";
const FOCUS_ZONE_SELECTOR = "[data-focus-zone]";
const SENTENCE_PATTERN = /\S[^.!?…]*[.!?…]+|\S[^.!?…]*$/g;

interface SentenceRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function clearAllHighlights() {
  document
    .querySelectorAll(".focus-highlight")
    .forEach((el) => el.classList.remove("focus-highlight"));
  document
    .querySelectorAll(".focus-zone-active")
    .forEach((el) => el.classList.remove("focus-zone-active"));
}

function highlightParagraph(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const zone = target.closest(FOCUS_ZONE_SELECTOR);
  if (!zone) return null;

  const paragraph = target.closest(PARAGRAPH_SELECTOR) as HTMLElement | null;
  if (!paragraph || !zone.contains(paragraph)) return null;

  zone
    .querySelectorAll(".focus-highlight")
    .forEach((el) => el.classList.remove("focus-highlight"));
  paragraph.classList.add("focus-highlight");

  document
    .querySelectorAll(".focus-zone-active")
    .forEach((el) => el.classList.remove("focus-zone-active"));
  zone.classList.add("focus-zone-active");

  return paragraph;
}

interface CaretRangeDocument {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

function getCaretRange(doc: Document, x: number, y: number): Range | null {
  const webkit = doc as Document & CaretRangeDocument;
  if (typeof webkit.caretRangeFromPoint === "function") {
    return webkit.caretRangeFromPoint(x, y);
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = doc.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
    return range;
  }
  return null;
}

function getSentenceRects(
  paragraph: Element,
  clientX: number,
  clientY: number,
): SentenceRect[] {
  const doc = paragraph.ownerDocument;
  const caret = getCaretRange(doc, clientX, clientY);
  if (!caret || !paragraph.contains(caret.startContainer)) return [];

  // Walk text nodes inside paragraph and build a global offset map.
  const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; length: number }[] = [];
  let acc = 0;
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    const t = cur as Text;
    const len = t.length;
    nodes.push({ node: t, start: acc, length: len });
    acc += len;
  }
  if (nodes.length === 0) return [];

  const total = acc;
  const fullText = nodes.map((n) => n.node.data).join("");

  // Caret's global offset.
  const caretEntry = nodes.find((n) => n.node === caret.startContainer);
  if (!caretEntry) return [];
  const caretGlobal = Math.min(
    caretEntry.start + caret.startOffset,
    caretEntry.start + caretEntry.length,
  );

  // Find the sentence span containing caretGlobal — use a fresh RegExp so module
  // state never leaks between calls.
  const sentencePattern = new RegExp(SENTENCE_PATTERN.source, "g");
  let sentStart = 0;
  let sentEnd = total;
  let m: RegExpExecArray | null;
  while ((m = sentencePattern.exec(fullText)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (start <= caretGlobal && caretGlobal <= end) {
      sentStart = start;
      sentEnd = end;
      break;
    }
    if (m[0].length === 0) break;
  }

  // Convert global offsets back to (text node, offset within node). When `g` falls
  // exactly on a node boundary, prefer the start of the next node so Range setters
  // get a position that matches the visual edge.
  const locate = (g: number, preferNext: boolean): { node: Text; offset: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const entry = nodes[i];
      const entryEnd = entry.start + entry.length;
      if (g < entryEnd || (g === entryEnd && (i === nodes.length - 1 || !preferNext))) {
        return { node: entry.node, offset: Math.max(0, g - entry.start) };
      }
      if (g === entryEnd && preferNext) {
        return { node: nodes[i + 1].node, offset: 0 };
      }
    }
    const last = nodes[nodes.length - 1];
    return { node: last.node, offset: last.length };
  };

  const startPos = locate(sentStart, true);
  const endPos = locate(sentEnd, false);
  if (!startPos || !endPos) return [];

  const range = doc.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  return Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ top: r.top, left: r.left, width: r.width, height: r.height }));
}

export function FocusMode() {
  const { prefs } = usePreferences();
  const { focusMode: mode } = prefs;
  const pinnedRef = useRef(false);
  const [sentenceRects, setSentenceRects] = useState<SentenceRect[]>([]);

  useEffect(() => {
    pinnedRef.current = false;
    setSentenceRects([]);

    if (mode === "off") {
      clearAllHighlights();
      return;
    }

    let pendingFrame: number | null = null;
    let lastEvent: { x: number; y: number; paragraph: HTMLElement } | null = null;

    const flushSentence = () => {
      pendingFrame = null;
      const e = lastEvent;
      lastEvent = null;
      if (!e || mode !== "sentence" || pinnedRef.current) return;
      setSentenceRects(getSentenceRects(e.paragraph, e.x, e.y));
    };

    const queueSentence = (clientX: number, clientY: number, paragraph: HTMLElement) => {
      if (mode !== "sentence") {
        setSentenceRects([]);
        return;
      }
      lastEvent = { x: clientX, y: clientY, paragraph };
      if (pendingFrame === null) {
        pendingFrame = requestAnimationFrame(flushSentence);
      }
    };

    const onPointerOver = (e: PointerEvent) => {
      if (pinnedRef.current) return;
      const paragraph = highlightParagraph(e.target);
      if (paragraph) queueSentence(e.clientX, e.clientY, paragraph);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pinnedRef.current || mode !== "sentence") return;
      if (!(e.target instanceof Element)) return;
      const paragraph = e.target.closest(PARAGRAPH_SELECTOR) as HTMLElement | null;
      if (!paragraph) return;
      queueSentence(e.clientX, e.clientY, paragraph);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (pinnedRef.current) return;
      const paragraph = highlightParagraph(e.target);
      if (!paragraph) return;
      // For keyboard focus we don't have pointer coords; highlight whole paragraph only.
      setSentenceRects([]);
    };

    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const inZone = e.target.closest(FOCUS_ZONE_SELECTOR);
      if (!inZone) return;
      pinnedRef.current = !pinnedRef.current;
      if (pinnedRef.current) {
        const paragraph = highlightParagraph(e.target);
        if (paragraph && mode === "sentence") {
          // Compute synchronously when pinning so the user gets immediate visual confirmation.
          setSentenceRects(getSentenceRects(paragraph, e.clientX, e.clientY));
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pinnedRef.current) {
        pinnedRef.current = false;
        clearAllHighlights();
        setSentenceRects([]);
      }
    };

    const onScrollOrResize = () => {
      // Sentence rects are viewport-relative; ANY scroll detaches them from the
      // text underneath, so always clear regardless of pinned state.
      if (mode === "sentence") setSentenceRects([]);
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      clearAllHighlights();
      setSentenceRects([]);
    };
  }, [mode]);

  if (mode !== "sentence" || sentenceRects.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30">
      {sentenceRects.map((r, i) => (
        <div
          key={i}
          className="focus-sentence-overlay absolute"
          style={{
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          }}
        />
      ))}
    </div>
  );
}
