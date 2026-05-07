// Multiplayer quiz session helpers.
//
// Centralizes session creation, join-by-code, scoring, and PB realtime
// subscription wiring so the lobby/game routes stay thin presentational
// shells. The host owns the session record; clients only mutate their
// own participant rows and write answer rows when the host is on the
// matching question_index. Speed bonus formula:
//
//   points_earned = base + max(0, base * (1 - ms_to_answer / window_ms))
//
// where `base` is the question's point value and `window_ms` is the
// host's question_seconds setting (default 30s).

import { pb } from "./pocketbase";
import type {
  Quiz,
  QuizQuestion,
  QuizSessionAnswerRecord,
  QuizSessionParticipantRecord,
  QuizSessionRecord,
  QuizSessionSettings,
} from "./types";

export const DEFAULT_QUESTION_SECONDS = 30;
export const SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generate a 6-character code using a Crockford-style alphabet (no
 * 0/O/1/I/L) so codes are unambiguous when read aloud. Collisions on
 * the unique index trigger a transparent retry up to 5 times.
 */
export function generateSessionCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * SESSION_CODE_ALPHABET.length);
    chars.push(SESSION_CODE_ALPHABET[idx]);
  }
  return chars.join("");
}

export async function createSession(opts: {
  hostUserId: string;
  quizId: string;
  settings?: QuizSessionSettings;
}): Promise<QuizSessionRecord> {
  const settings: QuizSessionSettings = {
    question_seconds: DEFAULT_QUESTION_SECONDS,
    speed_bonus: true,
    shuffle: false,
    ...opts.settings,
  };
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode();
    try {
      return await pb.collection("quiz_session").create<QuizSessionRecord>({
        host_user: opts.hostUserId,
        quiz: opts.quizId,
        code,
        state: "lobby",
        current_question_index: 0,
        settings,
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Failed to allocate a unique session code");
}

export async function findSessionByCode(
  code: string,
): Promise<QuizSessionRecord | null> {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 6) return null;
  try {
    return await pb
      .collection("quiz_session")
      .getFirstListItem<QuizSessionRecord>(`code = "${trimmed}"`, {
        requestKey: `quiz-session-code-${trimmed}`,
      });
  } catch {
    return null;
  }
}

export async function joinSession(opts: {
  sessionId: string;
  userId: string;
  displayName: string;
}): Promise<QuizSessionParticipantRecord> {
  // Idempotent join — re-joining with the same (session, user) pair
  // returns the existing row. PB's unique index makes this safe under
  // races; we just reach for the row when create rejects.
  try {
    return await pb
      .collection("quiz_session_participant")
      .create<QuizSessionParticipantRecord>({
        session: opts.sessionId,
        user: opts.userId,
        display_name: opts.displayName.slice(0, 64),
        score: 0,
        streak: 0,
      });
  } catch {
    return await pb
      .collection("quiz_session_participant")
      .getFirstListItem<QuizSessionParticipantRecord>(
        `session = "${opts.sessionId}" && user = "${opts.userId}"`,
      );
  }
}

export async function listParticipants(
  sessionId: string,
): Promise<QuizSessionParticipantRecord[]> {
  return await pb
    .collection("quiz_session_participant")
    .getFullList<QuizSessionParticipantRecord>({
      filter: `session = "${sessionId}"`,
      sort: "-score,created",
      requestKey: `qsp-list-${sessionId}`,
    });
}

export async function listAnswers(
  sessionId: string,
  questionIndex: number,
): Promise<QuizSessionAnswerRecord[]> {
  return await pb
    .collection("quiz_session_answer")
    .getFullList<QuizSessionAnswerRecord>({
      filter: `session = "${sessionId}" && question_index = ${questionIndex}`,
      requestKey: `qsa-list-${sessionId}-${questionIndex}`,
    });
}

/**
 * Decide whether `choice` matches the canonical correct answer for a
 * given quiz question. We reuse this for both client-side scoring and
 * the host's authoritative tally (the host can also verify by reading
 * answer rows).
 */
export function isAnswerCorrect(
  question: QuizQuestion,
  choice: number | string | boolean | null,
): boolean {
  if (choice === null || choice === undefined) return false;
  switch (question.type) {
    case "multiple_choice":
      return choice === question.correct_answer;
    case "true_false":
      return choice === question.correct_answer;
    case "short_answer":
    case "fill_blank": {
      const norm = (s: string) => s.trim().toLowerCase();
      const expected = [question.correct_answer, ...(question.accept_also ?? [])];
      const got = String(choice);
      return expected.some((c) => norm(c) === norm(got));
    }
  }
}

/**
 * Speed-weighted point award. base is the question's point value; the
 * player gets the full base plus up to one full base again as a bonus
 * when they answer instantly, decaying linearly to 0 by the timeout.
 */
export function pointsForAnswer(opts: {
  base: number;
  msToAnswer: number;
  windowMs: number;
  correct: boolean;
  speedBonus: boolean;
}): number {
  if (!opts.correct) return 0;
  const base = Math.max(0, opts.base);
  if (!opts.speedBonus) return base;
  const fraction = Math.max(0, 1 - opts.msToAnswer / Math.max(1, opts.windowMs));
  return Math.round(base + base * fraction);
}

export interface AnswerWriteInput {
  sessionId: string;
  participantId: string;
  userId: string;
  questionIndex: number;
  choice: number | string | boolean | null;
  correct: boolean;
  pointsEarned: number;
  msToAnswer: number;
}

/**
 * Persist a single participant's answer for the current question. The
 * unique (participant, question_index) index makes this a no-op when
 * the participant already submitted, which we accept silently — the
 * UI locks after submit anyway.
 */
export async function submitAnswer(input: AnswerWriteInput): Promise<void> {
  try {
    await pb.collection("quiz_session_answer").create<QuizSessionAnswerRecord>({
      session: input.sessionId,
      participant: input.participantId,
      user: input.userId,
      question_index: input.questionIndex,
      choice: input.choice,
      correct: input.correct,
      points_earned: input.pointsEarned,
      ms_to_answer: input.msToAnswer,
      answered_at: new Date().toISOString(),
    });
  } catch {
    // duplicate submit — already locked client-side
  }
}

export async function bumpParticipantScore(opts: {
  participantId: string;
  delta: number;
  correct: boolean;
}): Promise<void> {
  try {
    const part = await pb
      .collection("quiz_session_participant")
      .getOne<QuizSessionParticipantRecord>(opts.participantId, {
        requestKey: `qsp-get-${opts.participantId}`,
      });
    const nextStreak = opts.correct ? (part.streak ?? 0) + 1 : 0;
    await pb.collection("quiz_session_participant").update(opts.participantId, {
      score: (part.score ?? 0) + Math.max(0, opts.delta),
      streak: nextStreak,
      last_answer_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function advanceSession(
  sessionId: string,
  patch: Partial<QuizSessionRecord>,
): Promise<QuizSessionRecord> {
  return await pb
    .collection("quiz_session")
    .update<QuizSessionRecord>(sessionId, patch as Record<string, unknown>);
}

export function questionWindowMs(session: QuizSessionRecord): number {
  const seconds = session.settings?.question_seconds ?? DEFAULT_QUESTION_SECONDS;
  return Math.max(5, Math.min(180, seconds)) * 1000;
}

export function quizQuestions(quiz: Quiz | null): QuizQuestion[] {
  if (!quiz) return [];
  return Array.isArray(quiz.questions) ? (quiz.questions as QuizQuestion[]) : [];
}
