// Per-course full-text search.
//
// This is a sibling sub-route of the course detail page rather than a
// nested tab, because `courses.$courseId.tsx` manages its tab state in
// component-local state instead of routes. Adding an Outlet there
// would mean reworking the existing tabbed UI; a dedicated page keeps
// the change surgical and gives search its own URL (which is friendlier
// to deep-linking and the back button anyway).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  HelpCircle,
  Hand,
  Layers,
  Loader2,
  Search,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/layout/PageHeader";
import {
  groupBySource,
  type Retrieved,
} from "../lib/knowledge/retrieve";
import { retrieveByCourse } from "../lib/knowledge/retrieveByCourse";
import { sourceHref } from "./knowledge";
import type { Course, KnowledgeSourceType } from "../lib/types";

export const Route = createFileRoute("/courses/$courseId/search")({
  component: CourseSearchPage,
});

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

function CourseSearchPage() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Retrieved[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pb.collection("courses")
      .getOne<Course>(courseId)
      .then((c) => {
        if (!cancelled) setCourse(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!user || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const out = await retrieveByCourse(user.id, courseId, query, {
          topK: 25,
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
  }, [user, courseId, query]);

  const grouped = useMemo(() => groupBySource(results), [results]);

  return (
    <>
      <PageHeader
        title="Search this course"
        eyebrow={course?.name ?? undefined}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-5">
        <Link
          to="/courses/$courseId"
          params={{ courseId }}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to course
        </Link>

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
              placeholder="Search notes, lectures, flashcards, quizzes, calendar in this course…"
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

        <div className="text-xs text-[var(--color-text-muted)]">
          {results.length > 0
            ? `${results.length} result${results.length === 1 ? "" : "s"} in this course`
            : query
              ? "No matches in this course."
              : "Type to search; results update as you type."}
        </div>

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
    </>
  );
}

function SearchResultRow({ r, query }: { r: Retrieved; query: string }) {
  const href = sourceHref(r.chunk.source_type, r.chunk.source_id);
  const snippet = useMemo(
    () => buildSnippet(r.chunk.text, query),
    [r, query],
  );
  const body = (
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
        {snippet.match && (
          <mark className="bg-[var(--color-primary)]/20 text-[var(--color-text)] rounded px-0.5">
            {snippet.match}
          </mark>
        )}
        {snippet.after}
      </div>
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)] transition-colors"
        >
          {body}
        </a>
      ) : (
        <div className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          {body}
        </div>
      )}
    </li>
  );
}

function buildSnippet(text: string, query: string) {
  if (!text) return { before: "", match: "", after: "" };
  const t = text;
  if (!query.trim()) {
    return { before: t.slice(0, 240), match: "", after: "" };
  }
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
