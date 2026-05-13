import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  GraduationCap,
  Hand,
  HelpCircle,
  Layers,
  Loader2,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type {
  AslSegmentRecord,
  Lecture,
  NotePage,
  QuizAttempt,
  QuizSessionRecord,
  StudySession,
} from "../lib/types";

export const Route = createFileRoute("/activity")({
  component: ActivityPage,
});

interface ActivityRow {
  id: string;
  ts: number;
  kind:
    | "note"
    | "lecture"
    | "quiz_attempt"
    | "session"
    | "asl"
    | "study_session";
  title: string;
  description?: string;
  href?: { to: string; params?: Record<string, string> };
}

const KIND_META: Record<
  ActivityRow["kind"],
  { label: string; icon: typeof FileText }
> = {
  note: { label: "Note", icon: FileText },
  lecture: { label: "Lecture", icon: GraduationCap },
  quiz_attempt: { label: "Quiz attempt", icon: HelpCircle },
  session: { label: "Multiplayer", icon: Trophy },
  asl: { label: "ASL", icon: Hand },
  study_session: { label: "Study session", icon: Layers },
};

function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [filter, setFilter] = useState<"all" | ActivityRow["kind"]>("all");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let intervalId: number | undefined;
    const fetchAll = () => Promise.all([
      pb
        .collection("note_pages")
        .getList<NotePage>(1, 30, {
          filter: `user = "${user.id}" && archived = false`,
          sort: "-updated",
          requestKey: "act-notes",
        })
        .catch(() => ({ items: [] as NotePage[] })),
      pb
        .collection("lectures")
        .getList<Lecture>(1, 20, {
          filter: `user = "${user.id}"`,
          sort: "-recorded_at",
          requestKey: "act-lectures",
        })
        .catch(() => ({ items: [] as Lecture[] })),
      pb
        .collection("quiz_attempts")
        .getList<QuizAttempt>(1, 20, {
          filter: `user = "${user.id}"`,
          sort: "-completed_at",
          requestKey: "act-attempts",
        })
        .catch(() => ({ items: [] as QuizAttempt[] })),
      pb
        .collection("quiz_session")
        .getList<QuizSessionRecord>(1, 10, {
          filter: `host_user = "${user.id}"`,
          sort: "-created",
          requestKey: "act-sessions",
        })
        .catch(() => ({ items: [] as QuizSessionRecord[] })),
      pb
        .collection("asl_segments")
        .getList<AslSegmentRecord>(1, 20, {
          filter: `user = "${user.id}"`,
          sort: "-created",
          requestKey: "act-asl",
        })
        .catch(() => ({ items: [] as AslSegmentRecord[] })),
      pb
        .collection("study_sessions")
        .getList<StudySession>(1, 20, {
          filter: `user = "${user.id}"`,
          sort: "-started_at",
          requestKey: "act-study",
        })
        .catch(() => ({ items: [] as StudySession[] })),
    ]).then((results) => {
      if (cancelled) return;
      const merged: ActivityRow[] = [];
      for (const p of results[0].items) {
        merged.push({
          id: `note-${p.id}`,
          ts: new Date(p.updated || p.created).getTime(),
          kind: "note",
          title: p.title || "Untitled",
          description: ((p.blocks?.[0] as { text?: string })?.text ?? "")
            .slice(0, 120),
          href: { to: "/notes/$pageId", params: { pageId: p.id } },
        });
      }
      for (const l of results[1].items) {
        merged.push({
          id: `lec-${l.id}`,
          ts: new Date(l.recorded_at || l.created).getTime(),
          kind: "lecture",
          title: l.title || "Untitled lecture",
          description: l.status,
          href: { to: "/lectures/$lectureId", params: { lectureId: l.id } },
        });
      }
      for (const q of results[2].items) {
        merged.push({
          id: `att-${q.id}`,
          ts: new Date(q.completed_at || q.created).getTime(),
          kind: "quiz_attempt",
          title: `Quiz ${q.percentage}%`,
          description: `${q.score}/${q.max_score}`,
        });
      }
      for (const s of results[3].items) {
        merged.push({
          id: `ses-${s.id}`,
          ts: new Date(s.started_at || s.created).getTime(),
          kind: "session",
          title: `Game ${s.code} · ${s.state}`,
          href: { to: "/game/$sessionId", params: { sessionId: s.id } },
        });
      }
      for (const a of results[4].items) {
        merged.push({
          id: `asl-${a.id}`,
          ts: new Date(a.created).getTime(),
          kind: "asl",
          title: a.transcription || "[unclear]",
          description: `${Math.round((a.confidence ?? 0) * 100)}% conf · ${a.provider}`,
        });
      }
      for (const s of results[5].items) {
        if (!s.started_at) continue;
        merged.push({
          id: `ss-${s.id}`,
          ts: new Date(s.started_at).getTime(),
          kind: "study_session",
          title: s.session_type.replace(/_/g, " "),
          description:
            s.cards_reviewed > 0
              ? `${s.cards_correct}/${s.cards_reviewed} correct`
              : `${Math.round(s.duration_secs / 60)} min`,
        });
      }
      merged.sort((a, b) => b.ts - a.ts);
      setRows(merged.slice(0, 80));
    });
    fetchAll();
    intervalId = window.setInterval(() => void fetchAll(), 60_000);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === "all") return rows;
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  if (authLoading || !user) return null;

  const kinds: Array<"all" | ActivityRow["kind"]> = [
    "all",
    "note",
    "lecture",
    "quiz_attempt",
    "session",
    "asl",
    "study_session",
  ];

  return (
    <AppShell>
      <PageHeader
        title="Activity"
        subtitle={
          rows === null
            ? "Loading…"
            : rows.length === 0
              ? "Everything you've touched lately, in one place."
              : `${rows.length} recent event${rows.length === 1 ? "" : "s"}.`
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`text-[11px] px-2.5 h-7 rounded-full border ${
                filter === k
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {k === "all" ? "All" : KIND_META[k as ActivityRow["kind"]].label}
            </button>
          ))}
        </div>

        {filtered === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">
            Nothing here yet. Open a note or run a quiz to populate the feed.
          </p>
        ) : (
          <ol className="space-y-2">
            {filtered.map((r) => (
              <ActivityRowItem key={r.id} row={r} />
            ))}
          </ol>
        )}

        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] inline-flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            Tip: the global command palette (
            <span className="font-mono">Cmd K</span> /{" "}
            <span className="font-mono">Ctrl K</span>) jumps straight to any
            recent item.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ActivityRowItem({ row }: { row: ActivityRow }) {
  const meta = KIND_META[row.kind];
  const Icon = meta.icon;
  const ago = relativeTime(row.ts);
  const inner = (
    <div className="flex items-start gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 hover:border-[var(--color-primary)]">
      <Icon
        className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
          <span>{meta.label}</span>
          <span>·</span>
          <span>{ago}</span>
        </div>
        <div className="text-sm text-[var(--color-text)] truncate">
          {row.title}
        </div>
        {row.description && (
          <div className="text-xs text-[var(--color-text-muted)] truncate">
            {row.description}
          </div>
        )}
      </div>
      {row.href && (
        <Play
          className="w-3 h-3 text-[var(--color-text-subtle)] mt-1.5 flex-shrink-0"
          aria-hidden="true"
        />
      )}
    </div>
  );
  return (
    <li>
      {row.href ? (
        <Link to={row.href.to} params={row.href.params} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

