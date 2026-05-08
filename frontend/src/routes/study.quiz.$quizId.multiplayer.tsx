import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Crown,
  Loader2,
  Play,
  Settings,
  Users,
  Wifi,
  Clock,
  History,
  X,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import {
  advanceSession,
  createSession,
  DEFAULT_QUESTION_SECONDS,
  joinSession,
  listParticipants,
  quizQuestions,
} from "../lib/multiplayer";
import type {
  Quiz,
  QuizSessionParticipantRecord,
  QuizSessionRecord,
  QuizSessionSettings,
} from "../lib/types";

export const Route = createFileRoute("/study/quiz/$quizId/multiplayer")({
  component: MultiplayerLobbyPage,
});

function MultiplayerLobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { quizId } = Route.useParams();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<QuizSessionRecord | null>(null);
  const [participants, setParticipants] = useState<
    QuizSessionParticipantRecord[]
  >([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<Required<QuizSessionSettings>>({
    question_seconds: DEFAULT_QUESTION_SECONDS,
    speed_bonus: true,
    shuffle: false,
  });
  const [pastSessions, setPastSessions] = useState<QuizSessionRecord[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    pb.collection("quizzes")
      .getOne<Quiz>(quizId)
      .then(setQuiz)
      .catch(() => setError("Quiz not found"));
  }, [user, quizId]);

  // Reuse an existing lobby session if the host already created one.
  useEffect(() => {
    if (!user || !quizId) return;
    let cancelled = false;
    pb.collection("quiz_session")
      .getFirstListItem<QuizSessionRecord>(
        `quiz = "${quizId}" && host_user = "${user.id}" && state = "lobby"`,
        { requestKey: `qs-existing-${quizId}` },
      )
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        // No active lobby — user can press Start to create one.
      });
    return () => {
      cancelled = true;
    };
  }, [user, quizId]);

  const startNewSession = async () => {
    if (!user || creating) return;
    setCreating(true);
    setError(null);
    try {
      const s = await createSession({
        hostUserId: user.id,
        quizId,
        settings,
      });
      setSession(s);
      // Auto-join host so the host shows up on the leaderboard too.
      await joinSession({
        sessionId: s.id,
        userId: user.id,
        displayName: user.display_name || "Host",
      });
    } catch {
      setError("Could not create session. Try again.");
    } finally {
      setCreating(false);
    }
  };

  // Load this host's recently-played sessions for the past-sessions
  // panel below the main lobby card.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("quiz_session")
      .getList<QuizSessionRecord>(1, 8, {
        filter: `host_user = "${user.id}" && quiz = "${quizId}"`,
        sort: "-created",
        requestKey: `qs-recent-${quizId}`,
      })
      .then((page) => {
        if (!cancelled) setPastSessions(page.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, quizId, session]);

  // Live participant list — refresh on PB realtime events for the
  // session so joins appear without a page refresh.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const refresh = () =>
      listParticipants(session.id).then((rows) => {
        if (!cancelled) setParticipants(rows);
      });
    refresh();
    pb.collection("quiz_session_participant").subscribe(
      "*",
      (e) => {
        const rec = e.record as unknown as QuizSessionParticipantRecord;
        if (rec.session === session.id) void refresh();
      },
      { requestKey: null },
    );
    return () => {
      cancelled = true;
      pb.collection("quiz_session_participant").unsubscribe("*");
    };
  }, [session]);

  const code = session?.code ?? "";

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const startGame = async () => {
    if (!session) return;
    if (participants.length === 0) {
      setError("Wait for at least one player before starting.");
      return;
    }
    try {
      const next = await advanceSession(session.id, {
        state: "running",
        current_question_index: 0,
        started_at: new Date().toISOString(),
        question_started_at: new Date().toISOString(),
      });
      setSession(next);
      navigate({ to: "/game/$sessionId", params: { sessionId: next.id } });
    } catch {
      setError("Failed to start the game.");
    }
  };

  const cancelLobby = async () => {
    if (!session) return;
    try {
      await pb.collection("quiz_session").delete(session.id);
    } catch {
      // ignore
    }
    setSession(null);
    setParticipants([]);
  };

  const questionCount = useMemo(() => quizQuestions(quiz).length, [quiz]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Multiplayer lobby"
        subtitle={quiz ? quiz.title : "Loading quiz…"}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="rounded border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        {!session ? (
          <>
            <EmptyState
              icon={Users}
              title="Start a multiplayer round"
              description={
                quiz
                  ? `Generate a 6-character join code your friends can enter at /play to compete on this quiz (${questionCount} questions).`
                  : "Loading quiz details…"
              }
              action={
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    aria-pressed={settingsOpen}
                    className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
                  >
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    Settings
                  </button>
                  <button
                    type="button"
                    disabled={!quiz || creating}
                    onClick={startNewSession}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="w-4 h-4" aria-hidden="true" />
                    )}
                    {creating ? "Creating…" : "Create lobby"}
                  </button>
                </div>
              }
            />
            {settingsOpen && (
              <SettingsCard
                value={settings}
                onChange={setSettings}
                onClose={() => setSettingsOpen(false)}
              />
            )}
            {pastSessions.length > 0 && (
              <PastSessionsPanel sessions={pastSessions} />
            )}
          </>
        ) : (
          <>
            <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                    Join code
                  </div>
                  <div className="font-mono text-4xl sm:text-5xl tracking-[0.4em] text-[var(--color-text)]">
                    {code}
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Share this code or send the link below. Players enter it at{" "}
                    <span className="font-mono">/play</span>.
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
                  >
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    {copied ? "Copied" : "Copy code"}
                  </button>
                  <button
                    type="button"
                    onClick={startGame}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md"
                  >
                    <Play className="w-4 h-4" aria-hidden="true" />
                    Start game
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                  Players ({participants.length})
                </h2>
                <button
                  type="button"
                  onClick={cancelLobby}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                >
                  Cancel lobby
                </button>
              </div>
              {participants.length === 0 ? (
                <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-6 text-center text-sm text-[var(--color-text-muted)]">
                  Waiting for players to join…
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {participants.map((p) => (
                    <li
                      key={p.id}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm flex items-center gap-2"
                    >
                      {p.user === user.id && (
                        <Crown
                          className="w-4 h-4 text-[var(--color-primary)]"
                          aria-hidden="true"
                          aria-label="Host"
                        />
                      )}
                      <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                        {p.display_name || "Player"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                        {p.user === user.id ? "Host" : "Player"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SettingsCard({
  value,
  onChange,
  onClose,
}: {
  value: Required<QuizSessionSettings>;
  onChange: (v: Required<QuizSessionSettings>) => void;
  onClose: () => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)] inline-flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
          Round settings
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <label className="block">
        <span className="flex items-center justify-between text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            Seconds per question
          </span>
          <span className="font-mono tabular-nums text-[var(--color-text)]">
            {value.question_seconds}s
          </span>
        </span>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={value.question_seconds}
          onChange={(e) =>
            onChange({ ...value, question_seconds: Number(e.target.value) })
          }
          className="w-full"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.speed_bonus}
          onChange={(e) => onChange({ ...value, speed_bonus: e.target.checked })}
        />
        <span className="text-[var(--color-text)]">Speed bonus</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Faster correct answers earn more points.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.shuffle}
          onChange={(e) => onChange({ ...value, shuffle: e.target.checked })}
        />
        <span className="text-[var(--color-text)]">Shuffle questions</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Random order for each game.
        </span>
      </label>
    </section>
  );
}

function PastSessionsPanel({ sessions }: { sessions: QuizSessionRecord[] }) {
  return (
    <section className="max-w-md mx-auto">
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" aria-hidden="true" />
        Recent rounds
      </h2>
      <ul className="space-y-1.5">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              to="/game/$sessionId"
              params={{ sessionId: s.id }}
              className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs hover:border-[var(--color-primary)]"
            >
              <span className="font-mono text-[var(--color-text)] tracking-widest">
                {s.code}
              </span>
              <span className="text-[var(--color-text-muted)] flex-1 truncate">
                {s.state}
                {s.started_at &&
                  ` · ${new Date(s.started_at).toLocaleTimeString()}`}
              </span>
              <span className="text-[var(--color-text-subtle)]">
                {new Date(s.created).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
