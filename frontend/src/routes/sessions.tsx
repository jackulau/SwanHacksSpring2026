import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  History,
  Loader2,
  Trophy,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type {
  Quiz,
  QuizSessionParticipantRecord,
  QuizSessionRecord,
} from "../lib/types";

export const Route = createFileRoute("/sessions")({
  component: SessionsPage,
});

interface SessionRow {
  session: QuizSessionRecord;
  quizTitle: string;
  participantCount: number;
}

function SessionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hosted, setHosted] = useState<SessionRow[] | null>(null);
  const [joined, setJoined] = useState<SessionRow[] | null>(null);
  const [filter, setFilter] = useState<"all" | "lobby" | "running" | "complete">(
    "all",
  );

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      pb
        .collection("quiz_session")
        .getFullList<QuizSessionRecord>({
          filter: `host_user = "${user.id}"`,
          sort: "-created",
          requestKey: "sessions-hosted",
        })
        .catch(() => [] as QuizSessionRecord[]),
      pb
        .collection("quiz_session_participant")
        .getFullList<QuizSessionParticipantRecord>({
          filter: `user = "${user.id}"`,
          requestKey: "sessions-joined-as-participant",
        })
        .catch(() => [] as QuizSessionParticipantRecord[]),
    ]).then(async ([hostedSessions, mySpots]) => {
      if (cancelled) return;
      const enrich = async (sessions: QuizSessionRecord[]) => {
        const rows: SessionRow[] = [];
        const quizCache = new Map<string, string>();
        for (const s of sessions) {
          let quizTitle = quizCache.get(s.quiz) ?? "";
          if (!quizTitle) {
            try {
              const q = await pb.collection("quizzes").getOne<Quiz>(s.quiz);
              quizTitle = q.title;
              quizCache.set(s.quiz, quizTitle);
            } catch {
              quizTitle = "Quiz";
            }
          }
          let participantCount = 0;
          try {
            const page = await pb
              .collection("quiz_session_participant")
              .getList(1, 1, {
                filter: `session = "${s.id}"`,
                requestKey: `sessions-pcount-${s.id}`,
              });
            participantCount = page.totalItems;
          } catch {
            // ignore
          }
          rows.push({ session: s, quizTitle, participantCount });
        }
        return rows;
      };

      const hostedRows = await enrich(hostedSessions);

      // Resolve the participant rows to their session metadata.
      const joinedSessionIds = Array.from(
        new Set(mySpots.map((p) => p.session)),
      ).filter(
        (id) => !hostedSessions.some((s) => s.id === id),
      );
      const joinedSessions: QuizSessionRecord[] = [];
      for (const id of joinedSessionIds) {
        try {
          const s = await pb
            .collection("quiz_session")
            .getOne<QuizSessionRecord>(id);
          joinedSessions.push(s);
        } catch {
          // session deleted; skip
        }
      }
      const joinedRows = await enrich(
        joinedSessions.sort(
          (a, b) =>
            new Date(b.created).getTime() - new Date(a.created).getTime(),
        ),
      );

      if (!cancelled) {
        setHosted(hostedRows);
        setJoined(joinedRows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredHosted = useMemo(
    () => filterRows(hosted, filter),
    [hosted, filter],
  );
  const filteredJoined = useMemo(
    () => filterRows(joined, filter),
    [joined, filter],
  );

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Multiplayer sessions"
        subtitle="Lobbies you've hosted and rounds you've joined."
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "lobby", "running", "complete"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`text-[11px] px-2.5 h-7 rounded-full border ${
                filter === s
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        <SessionList
          title="Hosted"
          icon={Crown}
          rows={filteredHosted}
          emptyHint="You haven't hosted any rounds yet. Open a quiz and choose Multiplayer."
          loading={hosted === null}
        />

        <SessionList
          title="Joined"
          icon={Users}
          rows={filteredJoined}
          emptyHint="You haven't joined any rounds yet."
          loading={joined === null}
        />
      </div>
    </AppShell>
  );
}

function filterRows(
  rows: SessionRow[] | null,
  filter: "all" | "lobby" | "running" | "complete",
): SessionRow[] | null {
  if (rows === null) return null;
  if (filter === "all") return rows;
  return rows.filter((r) => r.session.state === filter);
}

function SessionList({
  title,
  icon: Icon,
  rows,
  emptyHint,
  loading,
}: {
  title: string;
  icon: typeof Crown;
  rows: SessionRow[] | null;
  emptyHint: string;
  loading: boolean;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {title} {rows && <span>({rows.length})</span>}
      </h2>
      {loading ? (
        <div className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : rows && rows.length === 0 ? (
        <EmptyState
          icon={History}
          title={`No ${title.toLowerCase()} sessions`}
          description={emptyHint}
          size="sm"
        />
      ) : (
        <ul className="space-y-1.5">
          {rows!.map((r) => (
            <SessionRowItem key={r.session.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SessionRowItem({ row }: { row: SessionRow }) {
  const { session, quizTitle, participantCount } = row;
  const stateIcon =
    session.state === "running"
      ? Wifi
      : session.state === "complete"
      ? Trophy
      : session.state === "lobby"
      ? Users
      : XCircle;
  const Icon = stateIcon;
  return (
    <li>
      <Link
        to="/game/$sessionId"
        params={{ sessionId: session.id }}
        className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
      >
        <Icon
          className={`w-4 h-4 ${
            session.state === "running"
              ? "text-[var(--color-success)]"
              : session.state === "complete"
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)]"
          }`}
          aria-hidden="true"
        />
        <span className="font-mono text-[var(--color-text)] tracking-widest">
          {session.code}
        </span>
        <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
          {quizTitle}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
          {session.state}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-0.5">
          <Users className="w-3 h-3" aria-hidden="true" />
          {participantCount}
        </span>
      </Link>
    </li>
  );
}
