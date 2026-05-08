import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Check,
  Crown,
  Loader2,
  Timer,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { useOnlineStatus } from "../lib/pwa";
import {
  advanceSession,
  bumpParticipantScore,
  isAnswerCorrect,
  joinSession,
  listAnswers,
  listParticipants,
  pointsForAnswer,
  questionWindowMs,
  quizQuestions,
} from "../lib/multiplayer";
import type {
  Quiz,
  QuizQuestion,
  QuizSessionAnswerRecord,
  QuizSessionParticipantRecord,
  QuizSessionRecord,
} from "../lib/types";

export const Route = createFileRoute("/game/$sessionId")({
  component: GamePage,
});

function GamePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { sessionId } = Route.useParams();
  const online = useOnlineStatus();

  const [session, setSession] = useState<QuizSessionRecord | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participants, setParticipants] = useState<
    QuizSessionParticipantRecord[]
  >([]);
  const [me, setMe] = useState<QuizSessionParticipantRecord | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [submittedFor, setSubmittedFor] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);
  const [missing, setMissing] = useState(false);

  const questionStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("quiz_session")
      .getOne<QuizSessionRecord>(sessionId)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        return pb.collection("quizzes").getOne<Quiz>(s.quiz);
      })
      .then((q) => {
        if (cancelled || !q) return;
        setQuiz(q);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionId]);

  // Realtime — keep session record fresh and re-fetch participants on any
  // event for this session. Used both for join/leave and for the host's
  // question-advance announcements.
  useEffect(() => {
    if (!user || !session) return;
    let cancelled = false;
    const refresh = () =>
      Promise.all([
        listParticipants(session.id).then((rows) => {
          if (!cancelled) setParticipants(rows);
        }),
        pb
          .collection("quiz_session")
          .getOne<QuizSessionRecord>(session.id)
          .then((s) => {
            if (!cancelled) setSession(s);
          }),
      ]);
    refresh();
    pb.collection("quiz_session").subscribe(
      session.id,
      () => {
        void refresh();
      },
      { requestKey: null },
    );
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
      pb.collection("quiz_session").unsubscribe(session.id);
      pb.collection("quiz_session_participant").unsubscribe("*");
    };
  }, [user, session]);

  // Tick — used for the per-question countdown. We don't put the timer
  // on the host alone because every client should agree on the cutoff.
  useEffect(() => {
    if (!session || session.state !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [session]);

  // Make sure the current user has a participant row even if they
  // landed on /game/$sessionId without going through /play (host flow).
  useEffect(() => {
    if (!user || !session) return;
    const found = participants.find((p) => p.user === user.id);
    if (found) {
      setMe(found);
      return;
    }
    if (participants.length === 0) return; // not loaded yet
    void joinSession({
      sessionId: session.id,
      userId: user.id,
      displayName: user.display_name || "Player",
    });
  }, [user, session, participants]);

  const questions = useMemo(() => quizQuestions(quiz), [quiz]);
  const qIx = session?.current_question_index ?? 0;
  const currentQuestion: QuizQuestion | undefined = questions[qIx];
  const isHost = !!(user && session && user.id === session.host_user);
  const windowMs = session ? questionWindowMs(session) : 30_000;
  const startedAt = session?.question_started_at
    ? new Date(session.question_started_at).getTime()
    : null;
  const remainingMs =
    startedAt !== null
      ? Math.max(0, startedAt + windowMs - now)
      : windowMs;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const elapsedFraction = startedAt
    ? Math.min(1, (now - startedAt) / windowMs)
    : 0;

  // Reset per-question UI state whenever the question advances.
  useEffect(() => {
    setLastResult(null);
    setSubmittedFor(null);
    questionStartRef.current = startedAt;
  }, [qIx, startedAt]);

  // Submit handler — runs scoring locally, writes the answer row, and
  // bumps the participant's score.
  const submit = useCallback(
    async (choice: number | string | boolean | null) => {
      if (!session || !currentQuestion || !me) return;
      if (submittedFor === qIx) return;
      const startTs = startedAt ?? Date.now();
      const ms = Math.max(0, Date.now() - startTs);
      const correct = isAnswerCorrect(currentQuestion, choice);
      const earned = pointsForAnswer({
        base: currentQuestion.points || 1000,
        msToAnswer: ms,
        windowMs,
        correct,
        speedBonus: session.settings?.speed_bonus !== false,
      });
      setSubmittedFor(qIx);
      setLastResult({ correct, points: earned });
      try {
        await pb.collection("quiz_session_answer").create({
          session: session.id,
          participant: me.id,
          user: me.user,
          question_index: qIx,
          choice: choice as unknown,
          correct,
          points_earned: earned,
          ms_to_answer: ms,
          answered_at: new Date().toISOString(),
        });
        await bumpParticipantScore({
          participantId: me.id,
          delta: earned,
          correct,
        });
      } catch {
        // duplicate — already submitted
      }
    },
    [session, currentQuestion, me, qIx, startedAt, windowMs, submittedFor],
  );

  // Host: when timer hits zero or every player has answered, advance.
  const advance = useCallback(async () => {
    if (!session || !quiz || !isHost) return;
    const total = questions.length;
    const next = qIx + 1;
    if (next >= total) {
      await advanceSession(session.id, {
        state: "complete",
        ended_at: new Date().toISOString(),
      });
    } else {
      await advanceSession(session.id, {
        current_question_index: next,
        question_started_at: new Date().toISOString(),
      });
    }
  }, [session, quiz, isHost, qIx, questions.length]);

  // Auto-advance: host watches the clock + answer count and bumps when
  // either fires. Only the host runs this branch.
  useEffect(() => {
    if (!isHost || !session || session.state !== "running") return;
    if (remainingMs > 0) return;
    if (qIx + 1 > questions.length) return;
    let cancelled = false;
    listAnswers(session.id, qIx).then((answers) => {
      if (cancelled) return;
      // tiny grace so straggler answers persist before we move on
      window.setTimeout(() => void advance(), 600);
      // surface answers count if needed in future leaderboard reveal
      void answers;
    });
    return () => {
      cancelled = true;
    };
  }, [isHost, session, qIx, remainingMs, questions.length, advance]);

  // Keyboard shortcuts during running questions:
  //   1-4 / a-d  -> pick that multiple-choice option
  //   t / f      -> true / false
  //   space      -> show last result animation again (passive)
  // Skip when the user is typing in the short-answer field — the
  // submit form handles Enter on its own.
  useEffect(() => {
    if (!session || session.state !== "running" || !currentQuestion) return;
    if (submittedFor === qIx) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (currentQuestion.type === "multiple_choice") {
        const aLow = e.key.toLowerCase();
        let ix = -1;
        if (e.key >= "1" && e.key <= "9") ix = Number(e.key) - 1;
        else if (aLow >= "a" && aLow <= "z") ix = aLow.charCodeAt(0) - 97;
        if (ix >= 0 && ix < currentQuestion.options.length) {
          e.preventDefault();
          void submit(ix);
        }
      } else if (currentQuestion.type === "true_false") {
        if (e.key === "t" || e.key === "T") {
          e.preventDefault();
          void submit(true);
        } else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          void submit(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, currentQuestion, qIx, submit, submittedFor]);

  // Host-only "everyone answered" early-advance trigger.
  useEffect(() => {
    if (!isHost || !session || session.state !== "running") return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const answers = await listAnswers(session.id, qIx).catch(
        () => [] as QuizSessionAnswerRecord[],
      );
      if (
        participants.length > 0 &&
        answers.length >= participants.length &&
        remainingMs > 1500
      ) {
        await advance();
      }
    };
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isHost, session, qIx, participants.length, advance, remainingMs]);

  if (authLoading || !user) return null;

  if (missing) {
    return (
      <AppShell>
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-md mx-auto text-center text-sm text-[var(--color-text-muted)]">
          Couldn't find that game session.{" "}
          <Link to="/play" className="underline">
            Try a different code
          </Link>
          .
        </div>
      </AppShell>
    );
  }

  if (!session || !quiz) {
    return (
      <AppShell>
        <div className="px-4 sm:px-6 lg:px-8 py-12 text-center text-sm text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 inline animate-spin mr-1" aria-hidden="true" />
          Loading game…
        </div>
      </AppShell>
    );
  }

  if (session.state === "lobby") {
    return (
      <AppShell>
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-2xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Waiting for host
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            The host hasn't started the game yet. {participants.length}{" "}
            {participants.length === 1 ? "player is" : "players are"} in the
            lobby with code{" "}
            <span className="font-mono tracking-widest">{session.code}</span>.
          </p>
          <ParticipantsRow participants={participants} hostId={session.host_user} />
        </div>
      </AppShell>
    );
  }

  if (session.state === "complete") {
    return (
      <AppShell>
        <ResultsScreen
          quiz={quiz}
          session={session}
          participants={participants}
          isHost={isHost}
        />
      </AppShell>
    );
  }

  // running
  return (
    <AppShell>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        {!online && (
          <div className="rounded border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
            You appear to be offline. Answers won't sync until your
            connection returns; the game will resume automatically.
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono tabular-nums">
            Q {qIx + 1} / {questions.length}
          </span>
          <span className="opacity-50">·</span>
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${
              remainingSec <= 5 && session.state === "running"
                ? "text-[var(--color-warning)] font-semibold"
                : ""
            }`}
          >
            <Timer
              className={`w-3.5 h-3.5 ${remainingSec <= 5 && session.state === "running" ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {remainingSec}s
          </span>
          <span className="opacity-50">·</span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            {me?.score ?? 0} pts
          </span>
        </div>

        <div className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${Math.max(0, 100 - elapsedFraction * 100)}%` }}
          />
        </div>

        {currentQuestion ? (
          <QuestionCard
            question={currentQuestion}
            disabled={submittedFor === qIx}
            onSubmit={submit}
            lastResult={lastResult}
          />
        ) : (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
            No question loaded.
          </div>
        )}

        <Leaderboard participants={participants} hostId={session.host_user} meId={user.id} />

        {isHost && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={advance}
              className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-xs px-3 h-8 rounded-md hover:bg-[var(--color-surface-raised)]"
            >
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              Next question
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuestionCard({
  question,
  disabled,
  onSubmit,
  lastResult,
}: {
  question: QuizQuestion;
  disabled: boolean;
  onSubmit: (choice: number | string | boolean | null) => void;
  lastResult: { correct: boolean; points: number } | null;
}) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        {question.question}
      </h2>

      {question.type === "multiple_choice" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSubmit(i)}
              className="text-left rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              <span className="font-mono text-xs text-[var(--color-text-subtle)] mr-2">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="flex gap-2">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              type="button"
              disabled={disabled}
              onClick={() => onSubmit(b)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              {b ? "True" : "False"}
            </button>
          ))}
        </div>
      )}

      {(question.type === "short_answer" || question.type === "fill_blank") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && text.trim()) onSubmit(text.trim());
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 h-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none disabled:opacity-50"
            placeholder="Type your answer"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-10 rounded-md disabled:opacity-50"
          >
            Submit
          </button>
        </form>
      )}

      {lastResult && (
        <div
          className={`flex items-center gap-2 text-sm rounded px-3 py-2 ${
            lastResult.correct
              ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "bg-[var(--color-error)]/10 text-[var(--color-error)]"
          }`}
        >
          {lastResult.correct ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <X className="w-4 h-4" aria-hidden="true" />
          )}
          {lastResult.correct ? "Correct" : "Incorrect"}
          <span className="ml-auto inline-flex items-center gap-1 text-[var(--color-text-muted)]">
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            {lastResult.points} pts
          </span>
        </div>
      )}
    </div>
  );
}

function ParticipantsRow({
  participants,
  hostId,
}: {
  participants: QuizSessionParticipantRecord[];
  hostId: string;
}) {
  if (participants.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-subtle)]">
        No players yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap justify-center gap-2 text-xs">
      {participants.map((p) => (
        <li
          key={p.id}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[var(--color-text-muted)]"
        >
          {p.user === hostId && (
            <Crown className="w-3 h-3 text-[var(--color-primary)]" aria-hidden="true" />
          )}
          {p.display_name || "Player"}
        </li>
      ))}
    </ul>
  );
}

function Leaderboard({
  participants,
  hostId,
  meId,
}: {
  participants: QuizSessionParticipantRecord[];
  hostId: string;
  meId: string;
}) {
  const sorted = [...participants].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  return (
    <section>
      <h2 className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
        Live leaderboard
      </h2>
      <ol className="space-y-1">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded border px-3 py-1.5 text-sm ${
              p.user === meId
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                : "border-[var(--color-border)] bg-[var(--color-surface)]"
            }`}
          >
            <span className="w-5 text-right tabular-nums text-[var(--color-text-subtle)]">
              {i + 1}
            </span>
            {p.user === hostId && (
              <Crown
                className="w-3.5 h-3.5 text-[var(--color-primary)]"
                aria-hidden="true"
              />
            )}
            <span className="flex-1 truncate text-[var(--color-text)]">
              {p.display_name || "Player"}
            </span>
            <span className="font-mono tabular-nums text-xs text-[var(--color-text-muted)]">
              {p.score ?? 0}
            </span>
            {(p.streak ?? 0) >= 2 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-warning)]">
                <Zap className="w-3 h-3" aria-hidden="true" />×{p.streak}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultsScreen({
  quiz,
  session,
  participants,
  isHost,
}: {
  quiz: Quiz;
  session: QuizSessionRecord;
  participants: QuizSessionParticipantRecord[];
  isHost: boolean;
}) {
  const sorted = [...participants].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const top = sorted[0];
  const navigate = useNavigate();
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto space-y-6 text-center">
      <div className="inline-flex flex-col items-center gap-2">
        <Award className="w-10 h-10 text-[var(--color-primary)]" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">
          Game over
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{quiz.title}</p>
      </div>
      {top && (
        <div className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)]/5 p-4 mx-auto max-w-sm">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Winner
          </div>
          <div className="text-2xl font-semibold text-[var(--color-text)]">
            {top.display_name || "Player"}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {top.score} pts
          </div>
        </div>
      )}
      <ol className="text-left rounded border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] mx-auto max-w-md">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center gap-3 px-4 py-2 text-sm"
          >
            <span className="w-5 text-right tabular-nums text-[var(--color-text-subtle)]">
              {i + 1}
            </span>
            <span className="flex-1 truncate">{p.display_name || "Player"}</span>
            <span className="font-mono tabular-nums">{p.score ?? 0}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-center gap-2">
        <Link
          to="/study"
          className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
        >
          Back to study
        </Link>
        {isHost && (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/study/quiz/$quizId/multiplayer",
                params: { quizId: session.quiz },
              })
            }
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md"
          >
            New round
          </button>
        )}
      </div>
    </div>
  );
}
