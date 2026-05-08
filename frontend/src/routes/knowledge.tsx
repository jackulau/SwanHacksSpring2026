import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Hand,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import {
  groupBySource,
  retrieve,
  type Retrieved,
} from "../lib/knowledge/retrieve";
import { backfillUserKnowledge } from "../lib/knowledge/ingest";
import type { KnowledgeSourceType } from "../lib/types";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgeLayout,
});

function KnowledgeLayout() {
  const location = useLocation();
  const isAsk = location.pathname.startsWith("/knowledge/ask");
  return (
    <AppShell>
      <PageHeader
        title="Knowledge"
        subtitle="Search across everything you've captured."
      />
      <div className="px-4 sm:px-6 lg:px-8 pt-4">
        <nav className="max-w-4xl mx-auto flex gap-1 text-sm">
          <Link
            to="/knowledge"
            className={`px-3 h-8 inline-flex items-center rounded-md ${
              !isAsk
                ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            }`}
          >
            Search
          </Link>
          <Link
            to="/knowledge/ask"
            className={`px-3 h-8 inline-flex items-center rounded-md ${
              isAsk
                ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
            }`}
          >
            Ask
          </Link>
        </nav>
      </div>
      {isAsk ? <Outlet /> : <KnowledgeSearchPage />}
    </AppShell>
  );
}

const SOURCE_META: Record<
  KnowledgeSourceType,
  { label: string; icon: typeof FileText }
> = {
  note: { label: "Notes", icon: FileText },
  lecture_transcript: { label: "Lectures", icon: GraduationCap },
  flashcard: { label: "Flashcards", icon: Layers },
  quiz_question: { label: "Quizzes", icon: HelpCircle },
  course_module: { label: "Course modules", icon: BookOpen },
  calendar_event: { label: "Calendar", icon: Calendar },
  asl_segment: { label: "ASL", icon: Hand },
  file: { label: "Files", icon: FileText },
};

const FILTER_TYPES: KnowledgeSourceType[] = [
  "note",
  "lecture_transcript",
  "flashcard",
  "quiz_question",
  "calendar_event",
  "asl_segment",
];

const FILTER_STORAGE_KEY = "converge:knowledge:filters";

function loadFilters(): Set<KnowledgeSourceType> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(
      arr.filter((s): s is KnowledgeSourceType =>
        (FILTER_TYPES as string[]).includes(s),
      ),
    );
  } catch {
    return new Set();
  }
}

function saveFilters(filters: Set<KnowledgeSourceType>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify(Array.from(filters)),
    );
  } catch {
    // ignore quota errors
  }
}

function KnowledgeSearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Retrieved[]>([]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [stats, setStats] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<KnowledgeSourceType>>(() =>
    loadFilters(),
  );

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const toggleFilter = (t: KnowledgeSourceType) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  useEffect(() => {
    if (!user || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const sourceTypes =
          filters.size > 0 ? Array.from(filters) : undefined;
        const out = await retrieve(user.id, query, {
          topK: 20,
          expandGraph: true,
          sourceTypes,
        });
        if (!cancelled) setResults(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [user, query, filters]);

  const grouped = useMemo(() => groupBySource(results), [results]);

  const runBackfill = async () => {
    if (!user || backfilling) return;
    setBackfilling(true);
    setProgress("Starting…");
    try {
      const out = await backfillUserKnowledge(user.id, (msg) => setProgress(msg));
      setStats(`Indexed ${out.total.chunks} chunks across your library.`);
    } catch {
      setStats("Backfill ran into an error — check the console.");
    } finally {
      setBackfilling(false);
      setProgress(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-5">
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2">
          <Search
            className="w-4 h-4 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search across notes, lectures, flashcards, quizzes, calendar, ASL…"
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
          />
          {loading && (
            <Loader2
              className="w-4 h-4 animate-spin text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTER_TYPES.map((t) => {
          const meta = SOURCE_META[t];
          const Icon = meta?.icon ?? FileText;
          const active = filters.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleFilter(t)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 h-7 text-[11px] ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              <Icon className="w-3 h-3" aria-hidden="true" />
              {meta?.label ?? t}
            </button>
          );
        })}
        {filters.size > 0 && (
          <button
            type="button"
            onClick={() => setFilters(new Set())}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] px-2.5 h-7 text-[11px] hover:bg-[var(--color-surface-raised)]"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div>
          {results.length > 0
            ? `${results.length} result${results.length === 1 ? "" : "s"}`
            : query
            ? "No matches in your library yet."
            : "Type to search; results update as you type."}
        </div>
        <button
          type="button"
          onClick={runBackfill}
          disabled={backfilling}
          className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] px-2.5 h-7 rounded text-[11px] hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3 h-3 ${backfilling ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {backfilling ? progress ?? "Backfilling…" : "Backfill index"}
        </button>
      </div>
      {stats && (
        <div className="text-xs text-[var(--color-success)]">{stats}</div>
      )}

      {results.length === 0 && !query && (
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-6 text-center text-sm text-[var(--color-text-muted)] flex flex-col items-center gap-2">
          <Sparkles className="w-5 h-5" aria-hidden="true" />
          <p>
            Run "Backfill index" once to load everything you've already
            captured. New content is indexed automatically as you create it.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {(Object.keys(grouped) as KnowledgeSourceType[]).map((type) => {
          const items = grouped[type];
          if (!items || items.length === 0) return null;
          const meta = SOURCE_META[type];
          const Icon = meta?.icon ?? FileText;
          return (
            <section key={type}>
              <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {meta?.label ?? type} <span>·</span> {items.length}
              </h2>
              <ul className="space-y-2">
                {items.map((r) => (
                  <SearchResultRow key={r.chunk.id} r={r} query={query} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SearchResultRow({ r, query }: { r: Retrieved; query: string }) {
  const href = sourceHref(r.chunk.source_type, r.chunk.source_id);
  const snippet = useMemo(() => buildSnippet(r.chunk.text, query), [r, query]);
  return (
    <li>
      {href ? (
        <a
          href={href}
          className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)] transition-colors"
        >
          <ResultBody r={r} snippet={snippet} />
        </a>
      ) : (
        <div className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <ResultBody r={r} snippet={snippet} />
        </div>
      )}
    </li>
  );
}

function ResultBody({
  r,
  snippet,
}: {
  r: Retrieved;
  snippet: { before: string; match: string; after: string };
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
        <span>{r.chunk.source_type}</span>
        <span>·</span>
        <span>section {r.chunk.section}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          {r.reason === "neighbour" ? "neighbour" : "match"}
          <span className="font-mono tabular-nums">{r.score.toFixed(2)}</span>
        </span>
      </div>
      <div className="font-medium text-sm text-[var(--color-text)] truncate">
        {r.chunk.title || "Untitled"}
      </div>
      <div className="mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
        {snippet.before}
        <mark className="bg-[var(--color-primary)]/20 text-[var(--color-text)] rounded px-0.5">
          {snippet.match}
        </mark>
        {snippet.after}
      </div>
    </>
  );
}

function buildSnippet(text: string, query: string) {
  if (!text)
    return { before: "", match: "", after: "" };
  const t = text;
  if (!query.trim())
    return {
      before: t.slice(0, 240),
      match: "",
      after: "",
    };
  const lower = t.toLowerCase();
  const term = query.trim().split(/\s+/)[0].toLowerCase();
  const at = lower.indexOf(term);
  if (at < 0) return { before: t.slice(0, 240), match: "", after: "" };
  const start = Math.max(0, at - 60);
  const end = Math.min(t.length, at + term.length + 180);
  return {
    before: (start > 0 ? "… " : "") + t.slice(start, at),
    match: t.slice(at, at + term.length),
    after: t.slice(at + term.length, end) + (end < t.length ? " …" : ""),
  };
}

export function sourceHref(
  type: KnowledgeSourceType,
  id: string,
): string | null {
  switch (type) {
    case "note":
      return `/notes/${id}`;
    case "lecture_transcript":
      return `/lectures/${id}`;
    case "quiz_question":
      return `/study/quiz/${id}`;
    case "calendar_event":
      return `/calendar`;
    case "asl_segment":
      return `/asl`;
    case "flashcard":
      return `/study/flashcards`;
    default:
      return null;
  }
}
