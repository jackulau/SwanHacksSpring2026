import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  ChevronRight,
  Quote,
  Lightbulb,
  Code,
  Minus,
  Image as ImageIcon,
  Table as TableIcon,
  Sigma,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import type { NoteBlock } from "../../lib/types";

/**
 * Slash-menu / block-picker entries. Each entry knows how to mint a fresh
 * block of its type so the editor never has to know payload shapes.
 *
 * The order here is the order the menu is shown in. Keep most-used near
 * the top — paragraph, headings, lists, todo, callout, quote, code.
 */

export interface BlockTypeSpec {
  /** Stable identifier; matches NoteBlock.type for type-changing actions. */
  id: NoteBlock["type"];
  label: string;
  description: string;
  /** Single-word category for grouping in the picker. */
  group: "basic" | "list" | "media" | "advanced";
  icon: typeof Type;
  /** Markdown-style hint shown on the right side of the slash menu. */
  shortcut?: string;
  /** Aliases for fuzzy filtering. */
  keywords: string[];
  /** Mint a fresh block of this type. */
  factory: (id: string) => NoteBlock;
}

export const BLOCK_SPECS: BlockTypeSpec[] = [
  {
    id: "paragraph",
    label: "Text",
    description: "Plain paragraph. Just start writing.",
    group: "basic",
    icon: Type,
    keywords: ["text", "paragraph", "body"],
    factory: (id) => ({ id, type: "paragraph", text: "" }),
  },
  {
    id: "heading",
    label: "Heading 1",
    description: "Top-level section title.",
    group: "basic",
    icon: Heading1,
    shortcut: "# ",
    keywords: ["h1", "title", "heading"],
    factory: (id) => ({ id, type: "heading", level: 1, text: "" }),
  },
  {
    id: "heading",
    label: "Heading 2",
    description: "Section subtitle.",
    group: "basic",
    icon: Heading2,
    shortcut: "## ",
    keywords: ["h2", "subtitle", "heading"],
    factory: (id) => ({ id, type: "heading", level: 2, text: "" }),
  },
  {
    id: "heading",
    label: "Heading 3",
    description: "Smaller section heading.",
    group: "basic",
    icon: Heading3,
    shortcut: "### ",
    keywords: ["h3", "heading"],
    factory: (id) => ({ id, type: "heading", level: 3, text: "" }),
  },
  {
    id: "bullet_item",
    label: "Bulleted list",
    description: "Unordered list. Tab to indent.",
    group: "list",
    icon: List,
    shortcut: "- ",
    keywords: ["bullet", "list", "ul"],
    factory: (id) => ({ id, type: "bullet_item", text: "" }),
  },
  {
    id: "numbered_item",
    label: "Numbered list",
    description: "Ordered list with auto-renumbering.",
    group: "list",
    icon: ListOrdered,
    shortcut: "1. ",
    keywords: ["numbered", "ordered", "ol"],
    factory: (id) => ({ id, type: "numbered_item", text: "" }),
  },
  {
    id: "todo",
    label: "To-do",
    description: "Checklist item with checkbox.",
    group: "list",
    icon: ListChecks,
    shortcut: "[] ",
    keywords: ["todo", "task", "checkbox", "check"],
    factory: (id) => ({ id, type: "todo", text: "", checked: false }),
  },
  {
    id: "toggle",
    label: "Toggle",
    description: "Collapsible block. Hide details inside.",
    group: "list",
    icon: ChevronRight,
    shortcut: "> ",
    keywords: ["toggle", "collapse", "details"],
    factory: (id) => ({ id, type: "toggle", text: "", open: true, children: [] }),
  },
  {
    id: "quote",
    label: "Quote",
    description: "Pull quote with side rule.",
    group: "basic",
    icon: Quote,
    shortcut: "> ",
    keywords: ["quote", "blockquote"],
    factory: (id) => ({ id, type: "quote", text: "" }),
  },
  {
    id: "callout",
    label: "Callout",
    description: "Highlighted note: tip, important, or confusion.",
    group: "basic",
    icon: Lightbulb,
    keywords: ["callout", "note", "tip", "important", "warning"],
    factory: (id) => ({ id, type: "callout", variant: "tip", text: "" }),
  },
  {
    id: "code",
    label: "Code",
    description: "Monospaced code block with language picker.",
    group: "basic",
    icon: Code,
    shortcut: "```",
    keywords: ["code", "snippet", "monospace"],
    factory: (id) => ({ id, type: "code", language: "plaintext", code: "" }),
  },
  {
    id: "divider",
    label: "Divider",
    description: "Horizontal rule between sections.",
    group: "basic",
    icon: Minus,
    shortcut: "---",
    keywords: ["divider", "rule", "hr", "separator"],
    factory: (id) => ({ id, type: "divider" }),
  },
  {
    id: "table",
    label: "Table",
    description: "2x2 grid you can grow with Tab.",
    group: "advanced",
    icon: TableIcon,
    keywords: ["table", "grid", "rows"],
    factory: (id) => ({
      id,
      type: "table",
      hasHeader: true,
      rows: [
        ["Column", "Column"],
        ["", ""],
      ],
    }),
  },
  {
    id: "math",
    label: "Math",
    description: "LaTeX expression rendered as math.",
    group: "advanced",
    icon: Sigma,
    keywords: ["math", "latex", "equation", "formula"],
    factory: (id) => ({ id, type: "math", expression: "" }),
  },
  {
    id: "image",
    label: "Image",
    description: "Embed an image by URL.",
    group: "media",
    icon: ImageIcon,
    keywords: ["image", "picture", "photo"],
    factory: (id) => ({ id, type: "image", url: "" }),
  },
  {
    id: "embed",
    label: "Embed",
    description: "Embed a URL — auto unfurls.",
    group: "media",
    icon: LinkIcon,
    keywords: ["embed", "url", "link", "unfurl"],
    factory: (id) => ({ id, type: "embed", url: "" }),
  },
  {
    id: "page_ref",
    label: "Link to page",
    description: "Reference another note page.",
    group: "advanced",
    icon: FileText,
    keywords: ["page", "link", "reference", "mention"],
    factory: (id) => ({ id, type: "page_ref", pageId: "", title: "" }),
  },
];

/** Lookup map by block-spec label so editor menus can find a spec fast. */
export const BLOCK_SPECS_BY_LABEL: Record<string, BlockTypeSpec> = Object.fromEntries(
  BLOCK_SPECS.map((s) => [s.label, s]),
);

/** Generate a short, sortable id without pulling in a uuid dep. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Lazy-create the default starting page for a fresh note. */
export function freshBlocks(): NoteBlock[] {
  return [{ id: newId(), type: "paragraph", text: "" }];
}

/**
 * Filter specs by a free-text query against label + keywords. Lowercase
 * substring is fine — the menu is small enough that fuzzy isn't needed.
 */
export function filterSpecs(query: string): BlockTypeSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCK_SPECS;
  return BLOCK_SPECS.filter((s) => {
    if (s.label.toLowerCase().includes(q)) return true;
    return s.keywords.some((k) => k.includes(q));
  });
}
