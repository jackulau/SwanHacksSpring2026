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
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Heading1,
  List,
  ListChecks,
  ListOrdered,
  Mic,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { Note } from "../lib/types";
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
import { CommentThread } from "../components/notes/CommentThread";
import { EmptyState } from "../components/layout/EmptyState";
import { InlineAiMenu } from "../components/notes/InlineAiMenu";
import { ingestNote } from "../lib/knowledge/ingest";
import { flashcardsFromNote } from "../lib/generate";
import { getTts } from "../lib/tts";

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
        const updated = await pb.collection("note_pages").update<NotePage>(page.id, {
          title: nextTitle,
          blocks: nextBlocks,
          properties: nextProperties,
          course: nextCourse || null,
        });
        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((s) => (s === "saved" ? "idle" : s));
        }, 1800);
        // Re-ingest into knowledge_chunks so the search/ask surfaces stay
        // current. Best-effort: ingest failure must never block the save.
        if (user) {
          void ingestNote(user.id, updated).catch(() => undefined);
        }
      } catch {
        setSaveState("dirty");
      }
    },
    [page, user],
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

  const [lecturePickerOpen, setLecturePickerOpen] = useState(false);

  // Generate-flashcards UX state. We surface a brief inline confirmation
  // ("Created N cards · Review") that links to the deck rather than a
  // toast — there's no toast primitive on this surface yet, and the inline
  // chip is unobtrusive enough to live in the topbar without a layout
  // shift.
  const [genFlashState, setGenFlashState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "done"; deck: string; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onGenerateFlashcards = useCallback(async () => {
    if (!page) return;
    setGenFlashState({ kind: "running" });
    try {
      const r = await flashcardsFromNote(page.id);
      setGenFlashState({ kind: "done", deck: r.deckName, count: r.cardsCreated });
      // Auto-clear the chip so the topbar settles back to its resting state.
      window.setTimeout(() => {
        setGenFlashState((s) => (s.kind === "done" ? { kind: "idle" } : s));
      }, 6000);
    } catch (err) {
      setGenFlashState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't generate flashcards.",
      });
      window.setTimeout(() => {
        setGenFlashState((s) => (s.kind === "error" ? { kind: "idle" } : s));
      }, 5000);
    }
  }, [page]);

  const insertLectureBlocks = async (lectureId: string) => {
    setLecturePickerOpen(false);
    try {
      const note = await pb
        .collection("notes")
        .getFirstListItem<Note>(`lecture = "${lectureId}"`, {
          requestKey: `note-import-${lectureId}`,
        });
      const incoming = Array.isArray(note.content) ? note.content : [];
      if (incoming.length === 0) return;
      // Stamp fresh ids on imported blocks so they don't collide with the
      // host page (which is keyed by id) and append them.
      const fresh: NoteBlock[] = incoming.map((b) => ({
        ...b,
        id: rid(),
      })) as NoteBlock[];
      setBlocks((prev) => [...prev, ...fresh]);
    } catch {
      // No notes record yet; fall back to inserting a divider + heading
      // so the user knows the import was attempted.
      const lecture = lectures.find((l) => l.id === lectureId);
      if (lecture) {
        setBlocks((prev) => [
          ...prev,
          { id: rid(), type: "divider" },
          {
            id: rid(),
            type: "heading",
            level: 2,
            text: lecture.title || "Lecture",
          },
          {
            id: rid(),
            type: "paragraph",
            text: "Notes for this lecture haven't been generated yet.",
          },
        ]);
      }
    }
  };

  const [exportNoticed, setExportNoticed] = useState<"none" | "copied" | "downloaded">("none");

  const exportMarkdown = () => blocksToMarkdown(title, blocks);

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportMarkdown());
      setExportNoticed("copied");
      window.setTimeout(() => setExportNoticed("none"), 1400);
    } catch {
      // Clipboard blocked — fall back to download.
      downloadMarkdown();
    }
  };

  const downloadMarkdown = () => {
    const md = exportMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNoticed("downloaded");
    window.setTimeout(() => setExportNoticed("none"), 1400);
  };

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

          <div className="relative">
            <button
              type="button"
              onClick={() => setLecturePickerOpen((v) => !v)}
              aria-pressed={lecturePickerOpen}
              aria-label="Insert from lecture"
              className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            >
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">From lecture</span>
            </button>
            {lecturePickerOpen && (
              <LecturePickerPopover
                lectures={lectures}
                onPick={insertLectureBlocks}
                onClose={() => setLecturePickerOpen(false)}
              />
            )}
          </div>

          <button
            type="button"
            onClick={onGenerateFlashcards}
            disabled={genFlashState.kind === "running"}
            aria-label="Generate flashcards from this page"
            title="Generate a flashcard deck from the contents of this page"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {genFlashState.kind === "running" ? "Generating…" : "Generate flashcards"}
            </span>
          </button>
          {genFlashState.kind === "done" && (
            <Link
              to="/study/flashcards"
              search={{ deck: genFlashState.deck } as never}
              className="text-[11px] inline-flex items-center gap-1 px-1.5 h-6 rounded bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              {genFlashState.count} {genFlashState.count === 1 ? "card" : "cards"} · Review
            </Link>
          )}
          {genFlashState.kind === "error" && (
            <span
              role="status"
              className="text-[11px] inline-flex items-center px-1.5 h-6 rounded bg-[var(--color-record)]/15 text-[var(--color-record)]"
              title={genFlashState.message}
            >
              Generate failed
            </span>
          )}

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
            onClick={() => {
              const tts = getTts();
              if (!tts.available) return;
              if (tts.speaking) {
                tts.cancel();
              } else {
                const md = exportMarkdown();
                tts.speak(md);
              }
            }}
            aria-label="Read aloud"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            title="Read aloud (browser TTS)"
          >
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={copyMarkdown}
            aria-label="Copy as markdown"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
          >
            {exportNoticed === "copied" ? (
              <Check className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{exportNoticed === "copied" ? "Copied" : "Copy MD"}</span>
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            aria-label="Download as markdown"
            className="px-2 h-7 rounded inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
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

            {!readingMode && isEmpty(title, blocks) && (
              <EmptyPageHints
                onPick={(template) => {
                  setBlocks(template);
                  // Drop focus into the new first block on the next render.
                  window.setTimeout(() => {
                    const first = document.querySelector<HTMLElement>(
                      '[data-page-editor] [data-block-content] [contenteditable="true"]',
                    );
                    first?.focus();
                  }, 50);
                }}
              />
            )}

            <PageEditor
              blocks={blocks}
              onChange={setBlocks}
              readOnly={readingMode}
              mentionables={mentionables}
              onNavigatePage={(id) => navigate({ to: "/notes/$pageId", params: { pageId: id } })}
            />

            <InlineAiMenu
              containerRef={editorContainerRef}
              readOnly={readingMode}
            />

            <BacklinksPanel pages={backlinks} />

            {!readingMode && (
              <CommentThread pageId={page.id} userId={user.id} />
            )}
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

function LecturePickerPopover({
  lectures,
  onPick,
  onClose,
}: {
  lectures: Lecture[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [onClose]);

  const filtered = lectures.filter((l) =>
    query ? (l.title || "").toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-30 w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.5)] py-1 text-sm"
    >
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a lecture"
          className="w-full bg-transparent outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
        />
      </div>
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs text-[var(--color-text-subtle)]">
            No lectures found.
          </div>
        ) : (
          filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onPick(l.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            >
              <Mic className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate">{l.title || "Untitled lecture"}</span>
              <span className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
                {l.status}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
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

/**
 * Convert the canonical block array into a markdown string. Used by the
 * Copy / Download actions in the page editor toolbar. Only the most-used
 * block types round-trip cleanly; embeds and page references render as
 * readable links so the export is still useful pasted into Slack or a
 * text editor.
 */
function blocksToMarkdown(title: string, blocks: NoteBlock[]): string {
  const out: string[] = [];
  if (title.trim()) out.push(`# ${title.trim()}`, "");
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph":
        out.push(b.text || "");
        break;
      case "heading":
        out.push(`${"#".repeat(Math.min(6, b.level + 1))} ${b.text}`);
        break;
      case "bullet_item":
        out.push(`- ${b.text}`);
        break;
      case "numbered_item":
        out.push(`1. ${b.text}`);
        break;
      case "todo":
        out.push(`- [${b.checked ? "x" : " "}] ${b.text}`);
        break;
      case "toggle":
        out.push(`> ${b.text}`);
        break;
      case "quote":
        out.push(`> ${b.text}`);
        break;
      case "callout":
        out.push(`> [!${b.variant.toUpperCase()}] ${b.text}`);
        break;
      case "code":
        out.push("```" + (b.language || ""));
        out.push(b.code);
        out.push("```");
        break;
      case "divider":
        out.push("---");
        break;
      case "image":
        out.push(`![${b.alt ?? ""}](${b.url})`);
        if (b.caption) out.push(`*${b.caption}*`);
        break;
      case "page_ref":
        out.push(`[[${b.title || "page"}]]`);
        break;
      case "embed":
        out.push(`<${b.url}>`);
        break;
      case "math":
        out.push(`$$ ${b.expression} $$`);
        break;
      case "table": {
        if (!b.rows || b.rows.length === 0) break;
        const widths = b.rows[0].map((_, i) =>
          Math.max(3, ...b.rows.map((r) => (r[i] ?? "").length)),
        );
        const fmt = (row: string[]) =>
          "| " + row.map((c, i) => (c ?? "").padEnd(widths[i])).join(" | ") + " |";
        out.push(fmt(b.rows[0]));
        out.push("| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");
        for (let i = 1; i < b.rows.length; i++) out.push(fmt(b.rows[i]));
        break;
      }
      case "key_term":
        out.push(`**${b.term}** — ${b.definition}`);
        break;
      case "example":
        out.push(`*Example:* ${b.text}`);
        break;
      case "bullet_list":
        for (const it of b.items) out.push(`- ${it}`);
        break;
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function isEmpty(title: string, blocks: NoteBlock[]): boolean {
  if (title.trim()) return false;
  if (blocks.length > 1) return false;
  const only = blocks[0];
  if (!only) return true;
  const text = (only as { text?: string }).text ?? "";
  return only.type === "paragraph" && text.trim() === "";
}

function EmptyPageHints({
  onPick,
}: {
  onPick: (blocks: NoteBlock[]) => void;
}) {
  const templates: Array<{
    label: string;
    icon: typeof FileText;
    keywords: string;
    blocks: () => NoteBlock[];
  }> = [
    {
      label: "Empty page",
      icon: FileText,
      keywords: "Type / for blocks",
      blocks: () => [{ id: rid(), type: "paragraph", text: "" }],
    },
    {
      label: "Lecture summary",
      icon: Heading1,
      keywords: "Heading + key points",
      blocks: () => [
        { id: rid(), type: "heading", level: 1, text: "Lecture summary" },
        { id: rid(), type: "heading", level: 2, text: "Key points" },
        { id: rid(), type: "bullet_item", text: "" },
        { id: rid(), type: "heading", level: 2, text: "Open questions" },
        { id: rid(), type: "bullet_item", text: "" },
      ],
    },
    {
      label: "Reading notes",
      icon: List,
      keywords: "Citation + quotes",
      blocks: () => [
        { id: rid(), type: "heading", level: 1, text: "Reading notes" },
        { id: rid(), type: "callout", variant: "tip", text: "Citation:" },
        { id: rid(), type: "heading", level: 2, text: "Highlights" },
        { id: rid(), type: "quote", text: "" },
        { id: rid(), type: "heading", level: 2, text: "My takeaways" },
        { id: rid(), type: "paragraph", text: "" },
      ],
    },
    {
      label: "Study plan",
      icon: ListChecks,
      keywords: "To-dos with deadlines",
      blocks: () => [
        { id: rid(), type: "heading", level: 1, text: "Study plan" },
        { id: rid(), type: "todo", text: "Review notes", checked: false },
        { id: rid(), type: "todo", text: "Build flashcards", checked: false },
        { id: rid(), type: "todo", text: "Take a practice quiz", checked: false },
      ],
    },
  ];
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-md p-4 mb-6 bg-[var(--color-surface-raised)]/30">
      <div className="flex items-center gap-2 mb-3 text-xs text-[var(--color-text-subtle)]">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        Start from a template, or just type. Press <kbd className="font-mono px-1 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">/</kbd> for blocks.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {templates.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => onPick(t.blocks())}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left hover:border-[var(--color-primary)] transition-colors"
            >
              <Icon className="w-4 h-4 text-[var(--color-text-muted)] mb-2" aria-hidden="true" />
              <div className="text-sm font-medium text-[var(--color-text)]">{t.label}</div>
              <div className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">
                {t.keywords}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function blocksEqual(a: NoteBlock[], b: NoteBlock[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
