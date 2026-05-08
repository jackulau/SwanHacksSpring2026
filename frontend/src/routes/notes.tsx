import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Archive,
  Tag as TagIcon,
  Copy,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Course, NotePage } from "../lib/types";

export const Route = createFileRoute("/notes")({
  component: () => (
    <AppShell>
      <NotesIndexPage />
    </AppShell>
  ),
});

/**
 * Notes index — browse, create, and search the user's rich-text pages.
 *
 * Three views: Recent (sorted by updated), All (alphabetical), and a
 * status board grouped by the page properties.status field. The view
 * selector is a calm pill row, not tabs, because notes is a sub-app
 * and pills mirror the rest of Converge's secondary navigation.
 */
function NotesIndexPage() {
  const { user } = useAuth();
  const [pages, setPages] = useState<NotePage[] | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "recent" | "board">("recent");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("courses")
      .getFullList<Course>({
        filter: `user = "${user.id}"`,
        sort: "name",
        requestKey: "notes-index-courses",
      })
      .then((rows) => {
        if (!cancelled) setCourses(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("note_pages")
      .getFullList<NotePage>({
        filter: `user = "${user.id}" && archived = false`,
        sort: "-updated",
        requestKey: "notes-index",
      })
      .then((rows) => {
        if (!cancelled) setPages(rows);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!pages) return null;
    let out = pages;
    if (courseFilter) {
      out = out.filter((p) => p.course === courseFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        JSON.stringify(p.blocks ?? []).toLowerCase().includes(q),
    );
  }, [pages, query, courseFilter]);

  const createPage = async () => {
    if (!user) return;
    const created = await pb.collection("note_pages").create<NotePage>({
      user: user.id,
      title: "",
      icon: "file-text",
      parent: "",
      course: "",
      lecture: "",
      blocks: [{ id: rid(), type: "paragraph", text: "" }],
      properties: {},
      archived: false,
    });
    navigate({ to: "/notes/$pageId", params: { pageId: created.id } });
  };

  const duplicatePage = async (src: NotePage) => {
    if (!user) return;
    try {
      // Stamp fresh ids on every block so a host of editors keyed by
      // block id (table cells, toggle children) don't collide.
      const cloneBlocks = (src.blocks ?? []).map((b) => ({
        ...b,
        id: rid(),
      })) as NotePage["blocks"];
      const created = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title: src.title ? `${src.title} (copy)` : "",
        icon: src.icon,
        parent: src.parent || "",
        course: src.course || "",
        lecture: src.lecture || "",
        blocks: cloneBlocks,
        properties: src.properties ?? {},
        archived: false,
      });
      setPages((prev) => (prev ? [created, ...prev] : prev));
      navigate({ to: "/notes/$pageId", params: { pageId: created.id } });
    } catch {
      // ignore — best-effort
    }
  };

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Rich pages with blocks, slash commands, and links across courses."
        actions={
          <button
            type="button"
            onClick={createPage}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-3 h-9 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New page
          </button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-subtle)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages…"
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md h-9 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-center gap-1 bg-[var(--color-surface-raised)] rounded-md p-0.5 text-xs">
              {(["recent", "all", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`px-3 h-7 rounded text-xs capitalize transition-colors ${
                    view === v
                      ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Link
              to="/trash"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            >
              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
              Archived
            </Link>
          </div>

          {courses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                type="button"
                onClick={() => setCourseFilter("")}
                className={`text-[11px] px-2.5 h-7 rounded-full border ${
                  courseFilter === ""
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                All courses
              </button>
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCourseFilter((prev) => (prev === c.id ? "" : c.id))
                  }
                  className={`text-[11px] px-2.5 h-7 rounded-full border ${
                    courseFilter === c.id
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                  }`}
                >
                  {c.code || c.name}
                </button>
              ))}
            </div>
          )}

          {filtered === null ? (
            <div className="text-sm text-[var(--color-text-subtle)]">Loading pages…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={query ? "No pages match your search" : "No pages yet"}
              description={
                query
                  ? "Try a shorter query or clear the search bar."
                  : "Notes are full Notion-style pages with slash commands, headings, lists, and code blocks."
              }
              action={
                !query ? (
                  <button
                    type="button"
                    onClick={createPage}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-3 h-9 rounded-md"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Create your first page
                  </button>
                ) : undefined
              }
            />
          ) : view === "board" ? (
            <PageBoard pages={filtered} />
          ) : (
            <PageGrid
              pages={view === "recent" ? filtered : sortByTitle(filtered)}
              onDuplicate={duplicatePage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function sortByTitle(pages: NotePage[]): NotePage[] {
  return [...pages].sort((a, b) =>
    (a.title || "Untitled").localeCompare(b.title || "Untitled"),
  );
}

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function PageGrid({
  pages,
  onDuplicate,
}: {
  pages: NotePage[];
  onDuplicate?: (p: NotePage) => void;
}) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {pages.map((p) => (
        <li key={p.id} className="group relative">
          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onDuplicate(p);
              }}
              aria-label={`Duplicate ${p.title || "Untitled"}`}
              title="Duplicate page"
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <Link
            to="/notes/$pageId"
            params={{ pageId: p.id }}
            className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] transition-colors"
          >
            <div className="flex items-start gap-2">
              <FileText
                className="w-4 h-4 text-[var(--color-text-subtle)] mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                  {p.title || "Untitled"}
                </h3>
                <p className="text-xs text-[var(--color-text-subtle)] mt-1 line-clamp-2">
                  {previewText(p)}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-[var(--color-text-subtle)]">
                  <span>{relativeTime(p.updated)}</span>
                  {p.properties?.tags && p.properties.tags.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <TagIcon className="w-3 h-3" aria-hidden="true" />
                      {p.properties.tags[0]}
                      {p.properties.tags.length > 1 && (
                        <span>+{p.properties.tags.length - 1}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PageBoard({ pages }: { pages: NotePage[] }) {
  const cols: Array<{ key: "draft" | "in_progress" | "done"; label: string }> = [
    { key: "draft", label: "Draft" },
    { key: "in_progress", label: "In progress" },
    { key: "done", label: "Done" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map((col) => {
        const list = pages.filter((p) => (p.properties?.status ?? "draft") === col.key);
        return (
          <div
            key={col.key}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 p-3"
          >
            <div className="flex items-center justify-between mb-2 text-xs uppercase tracking-wider text-[var(--color-text-subtle)]">
              <span>{col.label}</span>
              <span className="tabular-nums">{list.length}</span>
            </div>
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/notes/$pageId"
                    params={{ pageId: p.id }}
                    className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm hover:border-[var(--color-primary)] transition-colors"
                  >
                    <div className="font-medium text-[var(--color-text)] truncate">
                      {p.title || "Untitled"}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-subtle)] mt-1 line-clamp-2">
                      {previewText(p)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function previewText(page: NotePage): string {
  if (!page.blocks) return "";
  for (const b of page.blocks) {
    const t = (b as { text?: string }).text;
    if (t && t.trim()) return t.trim().slice(0, 140);
  }
  return "Empty page";
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const delta = Date.now() - then;
  const min = Math.round(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
