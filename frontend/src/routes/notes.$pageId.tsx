import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Hash,
  ListOrdered,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type {
  Course,
  HeadingBlock,
  Lecture,
  NoteBlock,
  NoteLink,
  NotePage,
  PageProperties,
} from "../lib/types";
import type { Mentionable } from "../components/notes/MentionMenu";
import { PageEditor } from "../components/notes/PageEditor";
import { PagePropertiesPanel } from "../components/notes/PageProperties";
import { EmptyState } from "../components/layout/EmptyState";

export const Route = createFileRoute("/notes/$pageId")({
  component: () => (
    <AppShell>
      <NotePageView />
    </AppShell>
  ),
});

const AUTOSAVE_MS = 700;

type SaveState = "idle" | "dirty" | "saving" | "saved";

/**
 * The full Notion-grade page surface — title, blocks, outline, status bar,
 * find-in-page, reading mode. The editor is wrapped in a max-w container,
 * with the floating outline anchored to the right side on wide viewports.
 */
function NotePageView() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState<NotePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [properties, setProperties] = useState<PageProperties>({});
  const [course, setCourse] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [readingMode, setReadingMode] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [backlinks, setBacklinks] = useState<NotePage[]>([]);
  const [allPages, setAllPages] = useState<NotePage[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  /* ───── load ───── */

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setMissing(false);
    setPage(null);
    pb.collection("note_pages")
      .getOne<NotePage>(pageId, { requestKey: `note-page-${pageId}` })
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        setTitle(p.title || "");
        setProperties(
          (p.properties && typeof p.properties === "object"
            ? p.properties
            : {}) as PageProperties,
        );
        setCourse(p.course || "");
        setBlocks(
          Array.isArray(p.blocks) && p.blocks.length > 0
            ? p.blocks
            : [{ id: rid(), type: "paragraph", text: "" }],
        );
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, user]);

  // Backlinks — pages that mention this one through note_links rows.
  useEffect(() => {
    if (!user || !page) return;
    let cancelled = false;
    pb.collection("note_links")
      .getFullList<NoteLink>({
        filter: `target_page = "${page.id}"`,
        requestKey: `note-backlinks-${page.id}`,
      })
      .then(async (links) => {
        if (cancelled) return;
        const ids = Array.from(new Set(links.map((l) => l.source_page))).filter(Boolean);
        if (ids.length === 0) {
          setBacklinks([]);
          return;
        }
        const filter = ids.map((i) => `id = "${i}"`).join(" || ");
        const sources = await pb
          .collection("note_pages")
          .getFullList<NotePage>({ filter, requestKey: `note-backlinks-pages-${page.id}` })
          .catch(() => []);
        if (!cancelled) setBacklinks(sources);
      })
      .catch(() => setBacklinks([]));
    return () => {
      cancelled = true;
    };
  }, [user, page]);

  // Courses — used by the properties panel.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("courses")
      .getFullList<Course>({
        filter: `user = "${user.id}"`,
        sort: "name",
        requestKey: "note-page-courses",
      })
      .then((c) => {
        if (!cancelled) setCourses(c);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Sibling pages — used in the outline panel for quick jumps.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("note_pages")
      .getFullList<NotePage>({
        filter: `user = "${user.id}" && archived = false`,
        sort: "-updated",
        requestKey: "note-page-siblings",
      })
      .then((p) => {
        if (!cancelled) setAllPages(p);
      })
      .catch(() => {
        if (!cancelled) setAllPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Lectures — used by the @-mention picker.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("lectures")
      .getList<Lecture>(1, 30, {
        filter: `user = "${user.id}"`,
        sort: "-recorded_at",
        requestKey: "note-page-lectures",
      })
      .then((r) => {
        if (!cancelled) setLectures(r.items);
      })
      .catch(() => {
        if (!cancelled) setLectures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const mentionables = useMemo<Mentionable[]>(() => {
    const items: Mentionable[] = [];
    for (const p of allPages.filter((p) => p.id !== pageId)) {
      items.push({ id: p.id, kind: "page", title: p.title || "Untitled" });
    }
    for (const l of lectures) {
      items.push({ id: l.id, kind: "lecture", title: l.title || "Lecture" });
    }
    for (const c of courses) {
      items.push({
        id: c.id,
        kind: "course",
        title: c.code ? `${c.code} ${c.name}` : c.name,
      });
    }
    return items;
  }, [allPages, lectures, courses, pageId]);

  // Persist note_links rows whenever the blocks change. Only diff against
  // the page's last-saved state so we don't churn rows on every keystroke.
  useEffect(() => {
    if (!user || !page) return;
    const targetIds = new Set<string>();
    for (const b of blocks) {
      if (b.type === "page_ref" && b.pageId) targetIds.add(b.pageId);
    }
    if (targetIds.size === 0) return;
    let cancelled = false;
    pb.collection("note_links")
      .getFullList<NoteLink>({
        filter: `source_page = "${page.id}"`,
        requestKey: `note-links-source-${page.id}`,
      })
      .then(async (existing) => {
        if (cancelled) return;
        const existingTargets = new Set(existing.map((l) => l.target_page));
        const toCreate = [...targetIds].filter((t) => !existingTargets.has(t));
        for (const t of toCreate) {
          await pb
            .collection("note_links")
            .create({ user: user.id, source_page: page.id, target_page: t })
            .catch(() => undefined);
        }
        const toDelete = existing.filter((l) => !targetIds.has(l.target_page));
        for (const l of toDelete) {
          await pb.collection("note_links").delete(l.id).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [blocks, page, user]);

  // Title pinned to document.title for browser-tab orientation.
  useEffect(() => {
    const prev = document.title;
    document.title = `${title || "Untitled"} · Converge`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  /* ───── save ───── */

  const persist = useCallback(
    async (
      nextTitle: string,
      nextBlocks: NoteBlock[],
      nextProperties: PageProperties,
      nextCourse: string,
    ) => {
      if (!page) return;
      setSaveState("saving");
      try {
        await pb.collection("note_pages").update(page.id, {
          title: nextTitle,
          blocks: nextBlocks,
          properties: nextProperties,
          course: nextCourse || null,
        });
        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((s) => (s === "saved" ? "idle" : s));
        }, 1800);
      } catch {
        setSaveState("dirty");
      }
    },
    [page],
  );

  // Debounced autosave on any persisted-field change.
  useEffect(() => {
    if (!page) return;
    const titleChanged = title !== (page.title || "");
    const blocksChanged = !blocksEqual(blocks, page.blocks ?? []);
    const propsChanged = JSON.stringify(properties) !== JSON.stringify(page.properties ?? {});
    const courseChanged = course !== (page.course || "");
    if (!titleChanged && !blocksChanged && !propsChanged && !courseChanged) return;
    setSaveState("dirty");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void persist(title, blocks, properties, course);
    }, AUTOSAVE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [title, blocks, properties, course, page, persist]);

  /* ───── shortcuts ───── */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-page-editor]') || target?.closest('[data-find-bar]')) {
          e.preventDefault();
          setFindOpen(true);
          window.setTimeout(() => {
            const inp = document.querySelector<HTMLInputElement>("#page-find-input");
            inp?.focus();
            inp?.select();
          }, 0);
        }
      }
      if (e.key === "Escape" && findOpen) {
        setFindOpen(false);
        setFindQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findOpen]);

  /* ───── find-in-page ───── */

  const matches = useMemo(() => {
    if (!findQuery) return [];
    const q = findQuery.toLowerCase();
    const out: { blockId: string; offset: number; length: number }[] = [];
    for (const b of blocks) {
      const text = ((b as { text?: string; code?: string; expression?: string }).text ??
        (b as { code?: string }).code ??
        (b as { expression?: string }).expression ??
        "").toLowerCase();
      let from = 0;
      while (from <= text.length) {
        const at = text.indexOf(q, from);
        if (at === -1) break;
        out.push({ blockId: b.id, offset: at, length: q.length });
        from = at + Math.max(q.length, 1);
      }
    }
    return out;
  }, [findQuery, blocks]);

  // Highlight matches by walking text nodes inside the editor container.
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    container.querySelectorAll(".page-find-match").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    });
    if (!findQuery) return;
    const q = findQuery.toLowerCase();
    let cursor = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const toReplace: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.nodeValue && node.nodeValue.toLowerCase().includes(q)) {
        toReplace.push(node);
      }
    }
    for (const node of toReplace) {
      const text = node.nodeValue ?? "";
      const lower = text.toLowerCase();
      const fragment = document.createDocumentFragment();
      let from = 0;
      while (from < text.length) {
        const at = lower.indexOf(q, from);
        if (at === -1) {
          fragment.appendChild(document.createTextNode(text.slice(from)));
          break;
        }
        if (at > from) fragment.appendChild(document.createTextNode(text.slice(from, at)));
        const span = document.createElement("span");
        span.className = "page-find-match";
        if (cursor === findIndex) span.classList.add("page-find-current");
        span.textContent = text.slice(at, at + q.length);
        fragment.appendChild(span);
        from = at + q.length;
        cursor++;
      }
      node.parentNode?.replaceChild(fragment, node);
    }
  }, [findQuery, findIndex, blocks]);

  /* ───── outline (TOC) ───── */

  const outline = useMemo(() => {
    return blocks
      .filter((b): b is HeadingBlock => b.type === "heading")
      .map((b) => ({ id: b.id, level: b.level, text: b.text || "Untitled heading" }));
  }, [blocks]);

  const wordCount = useMemo(() => {
    let count = 0;
    for (const b of blocks) {
      const text = (b as { text?: string }).text ?? (b as { code?: string }).code ?? "";
      if (typeof text === "string") {
        count += text.trim().split(/\s+/).filter(Boolean).length;
      }
    }
    return count;
  }, [blocks]);

  const charCount = useMemo(() => {
    let count = 0;
    for (const b of blocks) {
      const text = (b as { text?: string }).text ?? "";
      if (typeof text === "string") count += text.length;
    }
    return count;
  }, [blocks]);

  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  /* ───── handlers ───── */

  const archivePage = async () => {
    if (!page) return;
    if (!window.confirm("Archive this page? You can restore it from the index later.")) return;
    await pb.collection("note_pages").update(page.id, { archived: true });
    navigate({ to: "/notes" });
  };

  const onTitleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value.replace(/\n/g, ""));
  };

  if (!user || missing) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-10">
        <EmptyState
          icon={FileText}
          title="Page not found"
          description="It may have been archived or you might not have access."
          action={
            <Link
              to="/notes"
              className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to notes
            </Link>
          }
        />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-10 text-sm text-[var(--color-text-subtle)]">
        Loading…
      </div>
    );
  }

  return (
    <div className={readingMode ? "page-reading-mode" : ""}>
      {/* Top utility row — back link, mode toggles, save state, archive. */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <Link
            to="/notes"
            className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Notes
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <span className="truncate text-[var(--color-text)] flex-1">{title || "Untitled"}</span>

          <SaveBadge state={saveState} />

          <button
            type="button"
            onClick={() => setFindOpen((v) => !v)}
            aria-pressed={findOpen}
            aria-label="Find in page"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Find</span>
          </button>
          <button
            type="button"
            onClick={() => setReadingMode((v) => !v)}
            aria-pressed={readingMode}
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
          >
            {readingMode ? (
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{readingMode ? "Edit" : "Read"}</span>
          </button>
          <button
            type="button"
            onClick={archivePage}
            aria-label="Archive page"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-raised)]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {findOpen && (
        <FindBar
          query={findQuery}
          onChange={setFindQuery}
          matches={matches.length}
          index={findIndex}
          onNext={() =>
            setFindIndex((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length))
          }
          onPrev={() =>
            setFindIndex((i) =>
              matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length,
            )
          }
          onClose={() => {
            setFindOpen(false);
            setFindQuery("");
          }}
        />
      )}

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10">
          <div ref={editorContainerRef} className="min-w-0">
            <textarea
              value={title}
              onChange={onTitleChange}
              placeholder="Untitled"
              rows={1}
              spellCheck
              disabled={readingMode}
              className="w-full bg-transparent border-0 outline-none text-4xl font-bold tracking-tight text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-none mb-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Move focus into the first block.
                  const first = document.querySelector<HTMLElement>(
                    '[data-page-editor] [data-block-content] [contenteditable="true"]',
                  );
                  first?.focus();
                }
              }}
            />

            {!readingMode && (
              <PagePropertiesPanel
                properties={properties}
                onChange={setProperties}
                course={course}
                onCourseChange={setCourse}
                courses={courses}
              />
            )}

            <PageEditor
              blocks={blocks}
              onChange={setBlocks}
              readOnly={readingMode}
              mentionables={mentionables}
              onNavigatePage={(id) => navigate({ to: "/notes/$pageId", params: { pageId: id } })}
            />

            <BacklinksPanel pages={backlinks} />
          </div>

          <aside className="hidden lg:block sticky top-20 self-start space-y-6">
            <OutlinePanel
              outline={outline}
              onJump={(id) => {
                const el = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                el?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
              }}
            />
            <SiblingPanel pages={allPages.filter((p) => p.id !== pageId).slice(0, 6)} />
          </aside>
        </div>

        <StatusBar
          wordCount={wordCount}
          charCount={charCount}
          readingMinutes={readingMinutes}
          blockCount={blocks.length}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Auxiliary panels.
   ═══════════════════════════════════════════════════════════════════ */

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") {
    return (
      <span className="text-[11px] text-[var(--color-text-subtle)] hidden sm:inline">
        Saved
      </span>
    );
  }
  return (
    <span className="text-[11px] inline-flex items-center gap-1">
      {state === "saved" ? (
        <>
          <Check className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" />
          <span className="text-[var(--color-success)]">Saved</span>
        </>
      ) : state === "saving" ? (
        <span className="text-[var(--color-text-subtle)]">Saving…</span>
      ) : (
        <span className="text-[var(--color-text-subtle)]">Editing…</span>
      )}
    </span>
  );
}

function FindBar({
  query,
  onChange,
  matches,
  index,
  onNext,
  onPrev,
  onClose,
}: {
  query: string;
  onChange: (q: string) => void;
  matches: number;
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-find-bar
      className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/40"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs">
        <Search className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
        <input
          id="page-find-input"
          autoFocus
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Find on page"
          className="flex-1 bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
        />
        <span className="text-[var(--color-text-subtle)] tabular-nums">
          {matches === 0 ? "0" : `${(index % Math.max(matches, 1)) + 1} / ${matches}`}
        </span>
        <button
          type="button"
          onClick={onPrev}
          disabled={matches === 0}
          className="px-2 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={matches === 0}
          className="px-2 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close find"
          className="px-1.5 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function OutlinePanel({
  outline,
  onJump,
}: {
  outline: { id: string; level: 1 | 2 | 3; text: string }[];
  onJump: (id: string) => void;
}) {
  if (outline.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-subtle)]">
        <div className="uppercase tracking-wider mb-2 inline-flex items-center gap-1">
          <Hash className="w-3 h-3" aria-hidden="true" /> Outline
        </div>
        <p>Add headings (#, ##, ###) to populate the outline.</p>
      </div>
    );
  }
  return (
    <div className="text-xs">
      <div className="uppercase tracking-wider mb-2 text-[var(--color-text-subtle)] inline-flex items-center gap-1">
        <Hash className="w-3 h-3" aria-hidden="true" /> Outline
      </div>
      <ul className="space-y-1">
        {outline.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onJump(h.id)}
              className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] truncate w-full"
              style={{ paddingLeft: (h.level - 1) * 10 }}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiblingPanel({ pages }: { pages: NotePage[] }) {
  if (pages.length === 0) return null;
  return (
    <div className="text-xs">
      <div className="uppercase tracking-wider mb-2 text-[var(--color-text-subtle)] inline-flex items-center gap-1">
        <ListOrdered className="w-3 h-3" aria-hidden="true" /> Recent pages
      </div>
      <ul className="space-y-1">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              to="/notes/$pageId"
              params={{ pageId: p.id }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] truncate block"
            >
              {p.title || "Untitled"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BacklinksPanel({ pages }: { pages: NotePage[] }) {
  if (pages.length === 0) return null;
  return (
    <section className="mt-12 pt-6 border-t border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-3 font-medium">
        Linked from
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              to="/notes/$pageId"
              params={{ pageId: p.id }}
              className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm hover:border-[var(--color-primary)] transition-colors"
            >
              <div className="font-medium text-[var(--color-text)] truncate">
                {p.title || "Untitled"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBar({
  wordCount,
  charCount,
  readingMinutes,
  blockCount,
}: {
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  blockCount: number;
}) {
  return (
    <div className="max-w-5xl mx-auto mt-12 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-subtle)] tabular-nums">
      <span>
        {blockCount} {blockCount === 1 ? "block" : "blocks"}
      </span>
      <span>
        {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} characters
      </span>
      <span>{readingMinutes} min read</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers.
   ═══════════════════════════════════════════════════════════════════ */

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function blocksEqual(a: NoteBlock[], b: NoteBlock[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
