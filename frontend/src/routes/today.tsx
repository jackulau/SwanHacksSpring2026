import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers,
  Loader2,
  Sparkles,
  Sun,
  Trophy,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type {
  Assignment,
  CalendarEventRecord,
  Flashcard,
  Lecture,
  QuizAttempt,
  QuizSessionRecord,
} from "../lib/types";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

interface TodayData {
  dueCount: number;
  upcomingAssignments: Assignment[];
  todayEvents: CalendarEventRecord[];
  liveSessions: QuizSessionRecord[];
  todayAttempts: number;
  pendingLectures: Lecture[];
}

function TodayPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TodayData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const inSevenDays = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();

    Promise.all([
      pb
        .collection("flashcards")
        .getList<Flashcard>(1, 1, {
          filter: `user = "${user.id}" && (next_review <= "${now.toISOString()}" || next_review = "")`,
          requestKey: "today-due",
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
      pb
        .collection("assignments")
        .getList<Assignment>(1, 6, {
          filter: `user = "${user.id}" && due_at >= "${startOfDay}" && due_at <= "${inSevenDays}" && status = "upcoming"`,
          sort: "due_at",
          requestKey: "today-asg",
        })
        .then((r) => r.items)
        .catch(() => [] as Assignment[]),
      pb
        .collection("calendar_events")
        .getList<CalendarEventRecord>(1, 6, {
          filter: `user = "${user.id}" && start_at >= "${startOfDay}" && start_at < "${endOfDay}"`,
          sort: "start_at",
          requestKey: "today-cal",
        })
        .then((r) => r.items)
        .catch(() => [] as CalendarEventRecord[]),
      pb
        .collection("quiz_session")
        .getList<QuizSessionRecord>(1, 4, {
          filter: `(host_user = "${user.id}" || host_user != "") && state = "running"`,
          sort: "-created",
          requestKey: "today-sessions",
        })
        .then((r) => r.items.filter((s) => s.host_user === user.id))
        .catch(() => [] as QuizSessionRecord[]),
      pb
        .collection("quiz_attempts")
        .getList<QuizAttempt>(1, 1, {
          filter: `user = "${user.id}" && completed_at >= "${startOfDay}"`,
          requestKey: "today-attempts",
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
      pb
        .collection("lectures")
        .getList<Lecture>(1, 4, {
          filter: `user = "${user.id}" && (status = "uploading" || status = "processing" || status = "transcribing" || status = "generating")`,
          sort: "-recorded_at",
          requestKey: "today-pending-lectures",
        })
        .then((r) => r.items)
        .catch(() => [] as Lecture[]),
    ]).then(
      ([
        dueCount,
        upcomingAssignments,
        todayEvents,
        liveSessions,
        todayAttempts,
        pendingLectures,
      ]) => {
        if (cancelled) return;
        setData({
          dueCount,
          upcomingAssignments,
          todayEvents,
          liveSessions,
          todayAttempts,
          pendingLectures,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Late night";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title={`${greeting}${user.display_name ? `, ${user.display_name}` : ""}`}
        subtitle="One screen for what's pulling on your attention right now."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        {data === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Pulling your day…
          </div>
        ) : (
          <>
            <Block
              icon={Layers}
              title="Spaced repetition"
              accent={data.dueCount > 0 ? "active" : undefined}
            >
              {data.dueCount === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  All caught up.{" "}
                  <Link to="/decks" className="underline">
                    Browse decks
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-sm">
                  <Link
                    to="/study/due"
                    className="font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    {data.dueCount} card{data.dueCount === 1 ? "" : "s"} due
                  </Link>
                  <span className="text-[var(--color-text-muted)]">
                    {" "}
                    · Review now
                  </span>
                </p>
              )}
            </Block>

            <Block
              icon={CalendarCheck}
              title="Assignments coming up"
              accent={
                data.upcomingAssignments.length > 0 ? "active" : undefined
              }
            >
              {data.upcomingAssignments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Nothing due in the next 7 days.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.upcomingAssignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/assignments/$assignmentId"
                        params={{ assignmentId: a.id }}
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        {a.status === "submitted" ||
                        a.status === "graded" ? (
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[var(--color-success)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="flex-1 truncate text-[var(--color-text)]">
                          {a.title}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                          {a.due_at
                            ? new Date(a.due_at).toLocaleDateString()
                            : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block
              icon={Calendar}
              title="On your calendar today"
              accent={data.todayEvents.length > 0 ? "active" : undefined}
            >
              {data.todayEvents.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No events today.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.todayEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                        {ev.start_at
                          ? new Date(ev.start_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                      <span className="flex-1 truncate text-[var(--color-text)]">
                        {ev.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block
              icon={GraduationCap}
              title="Lectures still processing"
            >
              {data.pendingLectures.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Nothing in flight.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.pendingLectures.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Loader2
                        className="w-3 h-3 animate-spin text-[var(--color-text-muted)]"
                        aria-hidden="true"
                      />
                      <Link
                        to="/lectures/$lectureId"
                        params={{ lectureId: l.id }}
                        className="flex-1 truncate text-[var(--color-text)] hover:underline"
                      >
                        {l.title}
                      </Link>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                        {l.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block
              icon={Trophy}
              title="Live multiplayer rounds"
              accent={data.liveSessions.length > 0 ? "active" : undefined}
            >
              {data.liveSessions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No live rounds. Want to host one?{" "}
                  <Link to="/study" className="underline">
                    Open Study
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.liveSessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/game/$sessionId"
                        params={{ sessionId: s.id }}
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <span className="font-mono tracking-widest text-[var(--color-primary)]">
                          {s.code}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          Question {s.current_question_index + 1}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>
                You've completed{" "}
                <span className="text-[var(--color-text)] tabular-nums">
                  {data.todayAttempts}
                </span>{" "}
                quiz{data.todayAttempts === 1 ? "" : "zes"} today.
              </span>
              <Link
                to="/activity"
                className="hover:text-[var(--color-text)]"
              >
                Activity feed →
              </Link>
            </div>

            <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
              <Sparkles
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div>
                Tip: <span className="font-mono">Cmd K</span> to jump to any
                surface, <span className="font-mono">Cmd J</span> to quick-
                capture a thought.
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Block({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: typeof Sun;
  title: string;
  accent?: "active";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-md border bg-[var(--color-surface)] p-4 ${
        accent === "active"
          ? "border-[var(--color-primary)]"
          : "border-[var(--color-border)]"
      }`}
    >
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

