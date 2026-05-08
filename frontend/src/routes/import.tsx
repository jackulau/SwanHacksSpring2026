import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { ingestNote } from "../lib/knowledge/ingest";
import { toast } from "../lib/toasts";
import type { NoteBlock, NotePage } from "../lib/types";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large", "Markdown imports cap at 4 MB.");
      return;
    }
    const text = await file.text();
    setBody(text);
    if (!title) setTitle(file.name.replace(/\.md$/i, ""));
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Allow normal paste; but if the body is empty and the user pastes
    // a fenced markdown block, infer a title from the first heading.
    const text = e.clipboardData.getData("text/plain");
    if (!body && text) {
      const head = /^#\s+(.+)$/m.exec(text);
      if (head && !title) setTitle(head[1]);
    }
  };

  const importIt = async () => {
    if (!user || !body.trim() || busy) return;
    setBusy(true);
    try {
      const blocks = markdownToBlocks(body);
      const finalTitle =
        title.trim() ||
        (blocks[0] && blocks[0].type === "heading"
          ? blocks[0].text || "Untitled"
          : "Imported note");
      const created = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title: finalTitle,
        icon: "",
        parent: "",
        course: "",
        lecture: "",
        blocks,
        properties: { tags: ["imported"] },
        archived: false,
      });
      toast.success("Imported", finalTitle, undefined);
      void ingestNote(user.id, created).catch(() => undefined);
      navigate({ to: "/notes/$pageId", params: { pageId: created.id } });
    } catch {
      toast.error("Import failed", "Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Import"
        subtitle={
          body.trim().length > 0
            ? `${body.split(/\s+/).filter(Boolean).length} words ready to import.`
            : "Paste markdown or drop a .md file to land it as a note page."
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-4">
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <Sparkles
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            Headings (#, ##, ###), bullets, numbered lists, todo-list
            checkboxes, code fences, and quotes round-trip into block
            types. Other markdown lands as a paragraph block.
          </div>
        </div>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Title (optional)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the first heading"
            className="w-full bg-transparent border border-[var(--color-border)] rounded px-3 h-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Markdown body
            <span>
              <input
                type="file"
                accept=".md,text/markdown,text/plain"
                onChange={onFile}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="inline-flex items-center gap-1 cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <Upload className="w-3 h-3" aria-hidden="true" />
                Open .md
              </label>
            </span>
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={onPaste}
            rows={16}
            placeholder="# My note&#10;&#10;Paragraph text...&#10;&#10;- A bullet&#10;- Another bullet"
            className="w-full font-mono bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={importIt}
            disabled={busy || !body.trim()}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="w-4 h-4" aria-hidden="true" />
            )}
            Create note
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {body.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </div>
    </AppShell>
  );
}

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Walk a markdown string and emit a NoteBlock[] that the existing
 * editor can render and round-trip. Block-recognition rules:
 *   - "# H", "## H", "### H"  -> heading 1/2/3
 *   - "- text" / "* text"     -> bullet_item
 *   - "1. text"               -> numbered_item
 *   - "- [ ] text" / "- [x]"  -> todo
 *   - "> text"                -> quote
 *   - "```lang ... ```"        -> code block
 *   - "---" or "***"           -> divider
 *   - blank line              -> paragraph break
 */
function markdownToBlocks(md: string): NoteBlock[] {
  const out: NoteBlock[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let paragraph: string[] = [];
  const flushPara = () => {
    if (paragraph.length === 0) return;
    out.push({ id: rid(), type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushPara();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push({
        id: rid(),
        type: "code",
        language: lang,
        code: codeLines.join("\n"),
      });
      i++;
      continue;
    }
    const headingM = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingM) {
      flushPara();
      out.push({
        id: rid(),
        type: "heading",
        level: headingM[1].length as 1 | 2 | 3,
        text: headingM[2],
      });
      i++;
      continue;
    }
    const todoM = /^[-*]\s+\[(.)\]\s+(.+)$/.exec(line);
    if (todoM) {
      flushPara();
      out.push({
        id: rid(),
        type: "todo",
        text: todoM[2],
        checked: todoM[1].toLowerCase() === "x",
      });
      i++;
      continue;
    }
    const bulletM = /^[-*]\s+(.+)$/.exec(line);
    if (bulletM) {
      flushPara();
      out.push({ id: rid(), type: "bullet_item", text: bulletM[1] });
      i++;
      continue;
    }
    const numberM = /^\d+\.\s+(.+)$/.exec(line);
    if (numberM) {
      flushPara();
      out.push({ id: rid(), type: "numbered_item", text: numberM[1] });
      i++;
      continue;
    }
    if (/^>\s+(.*)/.test(line)) {
      flushPara();
      const text = line.replace(/^>\s+/, "");
      out.push({ id: rid(), type: "quote", text });
      i++;
      continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(line)) {
      flushPara();
      out.push({ id: rid(), type: "divider" });
      i++;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flushPara();
  if (out.length === 0)
    out.push({ id: rid(), type: "paragraph", text: md });
  return out;
}
