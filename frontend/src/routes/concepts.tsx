import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookmarkPlus,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { ingestNote } from "../lib/knowledge/ingest";
import {
  appendConceptsToPage,
  buildConceptBlocks,
  conceptsFromText,
  type ConceptCard,
} from "../lib/generate";
import type { NotePage } from "../lib/types";
import { toast } from "../lib/toasts";

export const Route = createFileRoute("/concepts")({
  component: ConceptsPage,
});

type Tab = "text" | "note";

/**
 * Concept extraction surface. Two input modes:
 *   - "From text": paste an arbitrary passage into a textarea.
 *   - "From note": pick one of the user's recent NotePages as the input.
 *
 * Run pulls 3–7 ConceptCards via the LLM provider chain (falls back to
 * the deterministic stub when no provider is reachable). The extracted
 * cards render below the input. Two outputs:
 *   - "Append to a note" appends a "Key concepts" section (heading +
 *      key_term blocks, important callouts for high-importance entries)
 *      to a destination page.
 *   - "Save as new note" creates a fresh NotePage seeded with the same
 *      concept blocks plus a short header.
 */
function ConceptsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<NotePage[]>([]);
  const [sourcePageId, setSourcePageId] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState("");

  const [busy, setBusy] = useState(false);
  const [appending, setAppending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [concepts, setConcepts] = useState<ConceptCard[]>([]);

  const [destFilter, setDestFilter] = useState("");
  const [destPageId, setDestPageId] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Lazy-load the user's recent pages once. Used by both the source picker
  // (when tab === "note") and the "Append to a note" destination picker.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("note_pages")
      .getList<NotePage>(1, 50, {
        filter: `user = "${user.id}" && archived = false`,
        sort: "-updated",
        requestKey: "concepts-pages",
      })
      .then((res) => {
        if (!cancelled) setNotes(res.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredSourceNotes = useMemo(() => {
    const q = sourceFilter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((p) => (p.title || "").toLowerCase().includes(q));
  }, [notes, sourceFilter]);

  const filteredDestNotes = useMemo(() => {
    const q = destFilter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((p) => (p.title || "").toLowerCase().includes(q));
  }, [notes, destFilter]);

  const inputReady = useMemo(() => {
    if (tab === "text") return text.trim().length > 0;
    return Boolean(sourcePageId);
  }, [tab, text, sourcePageId]);

  const run = async () => {
    if (!user || !inputReady || busy) return;
    setBusy(true);
    setConcepts([]);
    try {
      let payload = text;
      if (tab === "note") {
        const page = notes.find((n) => n.id === sourcePageId);
        if (!page) {
          toast.error("Pick a note", "Choose a page on the left.");
          return;
        }
        payload = pageToPlainText(page);
      }
      if (!payload.trim()) {
        toast.error("Nothing to read", "The selected source is empty.");
        return;
      }
      const cards = await conceptsFromText(payload, { provider: "anthropic" });
      setConcepts(cards);
      if (cards.length === 0) {
        toast.warning("No concepts found", "Try a longer passage.");
      }
    } catch {
      toast.error("Extraction failed", "Try again later.");
    } finally {
      setBusy(false);
    }
  };

  const onAppend = async () => {
    if (!user || concepts.length === 0 || !destPageId || appending) return;
    setAppending(true);
    try {
      const updated = await appendConceptsToPage(destPageId, concepts);
      toast.success(
        "Concepts appended",
        `Added ${concepts.length} to "${updated.title || "Untitled"}".`,
      );
      navigate({ to: "/notes/$pageId", params: { pageId: updated.id } });
    } catch {
      toast.error("Append failed", "Try again.");
    } finally {
      setAppending(false);
    }
  };

  const onSaveAsNew = async () => {
    if (!user || concepts.length === 0 || saving) return;
    setSaving(true);
    try {
      const blocks = buildConceptBlocks(concepts);
      // Prepend a paragraph block describing the source so the page reads
      // sensibly on its own.
      const intro = {
        id: `kc-intro-${Date.now().toString(36)}`,
        type: "paragraph" as const,
        text:
          tab === "text"
            ? "Concepts extracted from a pasted passage."
            : "Concepts extracted from another note in this workspace.",
      };
      const title = `Concepts ${new Date().toLocaleDateString()}`;
      const created = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title,
        icon: "bookmark-plus",
        parent: "",
        course: "",
        lecture: "",
        blocks: [intro, ...blocks],
        properties: { tags: ["concepts", "auto-generated"] },
        archived: false,
      });
      void ingestNote(user.id, created).catch(() => undefined);
      toast.success("New note created", title);
      navigate({ to: "/notes/$pageId", params: { pageId: created.id } });
    } catch {
      toast.error("Save failed", "Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Concept extraction"
        subtitle="Pull 3–7 named concepts out of any passage or note."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-4">
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <Sparkles
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            Concepts come back as cards you can append to an existing note or
            save as a fresh page. High-importance concepts also get an
            “important” callout when written into a note.
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Concept source"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
        >
          {(
            [
              { id: "text" as const, label: "From text" },
              { id: "note" as const, label: "From note" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-xs px-2.5 h-7 rounded ${
                tab === t.id
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-text)] border border-[var(--color-primary)]/40"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Input */}
        {tab === "text" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            placeholder="Paste a passage. The longer the passage, the better the concept set."
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none"
          />
        ) : (
          <PagePicker
            ariaLabel="Source note"
            notes={filteredSourceNotes}
            filter={sourceFilter}
            onFilterChange={setSourceFilter}
            selectedId={sourcePageId}
            onSelect={setSourcePageId}
            emptyHint="No notes yet. Create one first, then come back."
          />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={!inputReady || busy}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="w-4 h-4" aria-hidden="true" />
            )}
            Extract concepts
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {concepts.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {concepts.length} concept{concepts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Result cards */}
        {concepts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {concepts.map((c, idx) => (
              <article
                key={`${c.term}-${idx}`}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1"
              >
                <header className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text)] leading-tight">
                    {c.term}
                  </h3>
                  <ImportanceBadge importance={c.importance} />
                </header>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {c.definition}
                </p>
              </article>
            ))}
          </div>
        )}

        {/* Output actions */}
        {concepts.length > 0 && (
          <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              Send concepts to a note
            </h2>
            <PagePicker
              ariaLabel="Destination note"
              notes={filteredDestNotes}
              filter={destFilter}
              onFilterChange={setDestFilter}
              selectedId={destPageId}
              onSelect={setDestPageId}
              compact
              emptyHint="No pages yet — use Save as new note instead."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAppend}
                disabled={!destPageId || appending}
                className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
              >
                {appending ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <BookmarkPlus className="w-4 h-4" aria-hidden="true" />
                )}
                Append to a note
              </button>
              <button
                type="button"
                onClick={onSaveAsNew}
                disabled={saving}
                className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText className="w-4 h-4" aria-hidden="true" />
                )}
                Save as new note
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

interface PagePickerProps {
  ariaLabel: string;
  notes: NotePage[];
  filter: string;
  onFilterChange: (q: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  emptyHint: string;
  compact?: boolean;
}

function PagePicker({
  ariaLabel,
  notes,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  emptyHint,
  compact,
}: PagePickerProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)]">
        <Search
          className="w-3.5 h-3.5 text-[var(--color-text-subtle)]"
          aria-hidden="true"
        />
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter pages…"
          className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
          aria-label={`Filter ${ariaLabel}`}
        />
      </div>
      <ul
        role="listbox"
        aria-label={ariaLabel}
        className={`overflow-y-auto ${compact ? "max-h-40" : "max-h-72"}`}
      >
        {notes.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-[var(--color-text-subtle)]">
            {emptyHint}
          </li>
        )}
        {notes.map((p) => {
          const active = p.id === selectedId;
          return (
            <li
              key={p.id}
              role="option"
              aria-selected={active}
              onClick={() => onSelect(p.id)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                active
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              <FileText
                className="w-3.5 h-3.5 text-[var(--color-text-subtle)]"
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{p.title || "Untitled"}</span>
              {p.updated && (
                <span className="text-[10px] text-[var(--color-text-subtle)]">
                  {new Date(p.updated).toLocaleDateString()}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ImportanceBadge({ importance }: { importance: ConceptCard["importance"] }) {
  const cls =
    importance === "high"
      ? "border-[var(--color-primary)]/40 text-[var(--color-primary)] bg-[var(--color-primary)]/10"
      : importance === "medium"
        ? "border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]"
        : "border-[var(--color-border)] text-[var(--color-text-subtle)] bg-transparent";
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}
    >
      {importance}
    </span>
  );
}

/**
 * Flatten a page's blocks into a plain-text payload suitable for the LLM.
 * Mirrors the lighter blocksToPlainText in flashcardsFromNote — concepts
 * extraction doesn't need a separate convention.
 */
function pageToPlainText(page: NotePage): string {
  const lines: string[] = [];
  if (page.title) lines.push(page.title, "");
  for (const b of page.blocks ?? []) {
    switch (b.type) {
      case "heading":
        lines.push(`${"#".repeat(b.level)} ${b.text}`);
        break;
      case "paragraph":
      case "callout":
      case "quote":
      case "example":
      case "todo":
      case "bullet_item":
      case "numbered_item":
      case "toggle":
        if (b.text) lines.push(b.text);
        break;
      case "key_term":
        lines.push(`${b.term}: ${b.definition}`);
        break;
      case "code":
        lines.push(b.code);
        break;
      case "bullet_list":
        for (const it of b.items) lines.push("- " + it);
        break;
      case "math":
        if (b.expression) lines.push(b.expression);
        break;
      case "table":
        for (const row of b.rows) lines.push(row.join(" | "));
        break;
      case "page_ref":
        if (b.title) lines.push(`(see also: ${b.title})`);
        break;
      // divider, image, embed — skipped
    }
  }
  return lines.join("\n").trim();
}
