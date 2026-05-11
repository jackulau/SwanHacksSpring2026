/**
 * HackStack — demo data seed (Node script).
 *
 * Authenticates as a PocketBase superuser and upserts the shared demo dataset
 * defined in `backend/seed/demo-data.js`. Idempotent — re-running the script
 * never duplicates rows.
 *
 * Usage:
 *   PB_URL=http://127.0.0.1:8090 \
 *   PB_ADMIN_EMAIL=you@example.com \
 *   PB_ADMIN_PASSWORD=secret \
 *   pnpm --filter frontend run seed
 *
 *   (Or just `cd frontend && npm run seed` after exporting the env vars.)
 */

import PocketBase, { ClientResponseError } from "pocketbase";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────

interface DemoUser {
  id: string;
  email: string;
  password: string;
  display_name: string;
  onboarding_done: boolean;
  badges?: {
    label: string;
    backgroundColor: string;
    textColor?: string;
    borderColor?: string;
  }[];
}

interface DemoCourse {
  id: string;
  name: string;
  code: string;
  color: string;
  semester: string;
}

interface DemoLecture {
  id: string;
  course_id: string;
  title: string;
  duration_secs: number;
  days_ago: number;
}

interface DemoTranscript {
  id: string;
  lecture_id: string;
  raw_text: string;
  clean_text: string;
  segments: unknown[];
  language: string;
  word_count: number;
}

interface DemoNote {
  id: string;
  lecture_id: string;
  title: string;
  content: unknown[];
  summary: string;
  key_concepts: unknown[];
}

interface DemoFlashcard {
  id: string;
  lecture_id: string;
  deck_name: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
}

interface DemoQuiz {
  id: string;
  lecture_id: string;
  title: string;
  questions: unknown[];
  total_points: number;
}

interface DemoStudySession {
  id: string;
  lecture_id: string;
  days_ago: number;
  duration_secs: number;
  cards_reviewed: number;
  cards_correct: number;
}

interface DemoData {
  user: DemoUser;
  courses: DemoCourse[];
  lectures: DemoLecture[];
  transcripts: DemoTranscript[];
  notes: DemoNote[];
  flashcards: DemoFlashcard[];
  quizzes: DemoQuiz[];
  study_sessions: DemoStudySession[];
}

// ─── Env ──────────────────────────────────────────────────────────────────

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error(
    "Missing required env vars. Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD " +
      "(superuser credentials) before running this script.",
  );
  process.exit(1);
}

// ─── Dataset loading ──────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = resolve(__dirname, "../../backend/seed/demo-data.js");

// `demo-data.js` is CommonJS; load it via `createRequire` so this stays a
// single-source-of-truth between the migration and the script.
const require_ = createRequire(import.meta.url);
const demoData = require_(dataPath) as DemoData;

// ─── Helpers ──────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toPbDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    ` ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`
  );
}

function nowDateIso(): string {
  return toPbDate(new Date());
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toPbDate(d);
}

function daysAgoIsoOffset(days: number, plusSecs: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCSeconds(d.getUTCSeconds() + plusSecs);
  return toPbDate(d);
}

function isNotFound(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    return `${error.status} ${error.message} :: ${JSON.stringify(error.data)}`;
  }
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

// ─── Upsert primitive ─────────────────────────────────────────────────────

async function upsert(
  pb: PocketBase,
  collection: string,
  id: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<void> {
  try {
    await pb.collection(collection).getOne(id);
    console.log(`→ skipped existing ${label}`);
    return;
  } catch (err: unknown) {
    if (!isNotFound(err)) {
      throw new Error(`failed to read ${collection}/${id}: ${getErrorMessage(err)}`);
    }
  }

  try {
    await pb.collection(collection).create({ id, ...payload });
    console.log(`✓ created ${label}`);
  } catch (err: unknown) {
    throw new Error(`failed to create ${collection}/${id}: ${getErrorMessage(err)}`);
  }
}

// ─── User upsert (special — auth collection needs password fields) ───────

async function upsertUser(pb: PocketBase, user: DemoUser): Promise<string> {
  try {
    const existing = await pb.collection("users").getOne(user.id);
    console.log(`→ skipped existing user ${user.id}`);
    return existing.id;
  } catch (err: unknown) {
    if (!isNotFound(err)) {
      throw new Error(`failed to read users/${user.id}: ${getErrorMessage(err)}`);
    }
  }

  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    emailVisibility: true,
    verified: true,
    password: user.password,
    passwordConfirm: user.password,
    name: user.display_name,
    display_name: user.display_name,
    onboarding_done: user.onboarding_done,
    badges: user.badges ?? [],
  };

  try {
    const created = await pb.collection("users").create(payload);
    console.log(`✓ created user ${user.id} (${user.email})`);
    return created.id;
  } catch (err: unknown) {
    throw new Error(`failed to create users/${user.id}: ${getErrorMessage(err)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const pb = new PocketBase(PB_URL);
  // Avoid auto-cancelling the many sequential reads/writes below.
  pb.autoCancellation(false);

  console.log(`Connecting to PocketBase at ${PB_URL}...`);
  try {
    await pb
      .collection("_superusers")
      .authWithPassword(PB_ADMIN_EMAIL as string, PB_ADMIN_PASSWORD as string);
  } catch (err: unknown) {
    console.error(
      `Superuser auth failed: ${getErrorMessage(err)}. Set PB_ADMIN_EMAIL ` +
        "and PB_ADMIN_PASSWORD to credentials of an existing superuser.",
    );
    process.exit(1);
  }
  console.log(`Authenticated as ${PB_ADMIN_EMAIL}.`);

  const userId = await upsertUser(pb, demoData.user);

  for (const c of demoData.courses) {
    await upsert(
      pb,
      "courses",
      c.id,
      {
        name: c.name,
        code: c.code,
        color: c.color,
        semester: c.semester,
        user: userId,
      },
      `course ${c.id}`,
    );
  }

  for (const l of demoData.lectures) {
    await upsert(
      pb,
      "lectures",
      l.id,
      {
        title: l.title,
        audio_file: "",
        duration_secs: l.duration_secs,
        status: "ready",
        error_message: "",
        recorded_at: daysAgoIso(l.days_ago),
        user: userId,
        course: l.course_id,
      },
      `lecture ${l.id}`,
    );
  }

  for (const t of demoData.transcripts) {
    await upsert(
      pb,
      "transcripts",
      t.id,
      {
        raw_text: t.raw_text,
        clean_text: t.clean_text,
        segments: t.segments,
        speakers: [],
        language: t.language,
        word_count: t.word_count,
        lecture: t.lecture_id,
      },
      `transcript ${t.id}`,
    );
  }

  for (const n of demoData.notes) {
    await upsert(
      pb,
      "notes",
      n.id,
      {
        title: n.title,
        content: n.content,
        content_type: "auto_generated",
        key_concepts: n.key_concepts,
        summary: n.summary,
        lecture: n.lecture_id,
        user: userId,
      },
      `note ${n.id}`,
    );
  }

  const nowIso = nowDateIso();
  for (const c of demoData.flashcards) {
    await upsert(
      pb,
      "flashcards",
      c.id,
      {
        deck_name: c.deck_name,
        front: c.front,
        back: c.back,
        tags: c.tags,
        difficulty: c.difficulty,
        source: "auto_generated",
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review: nowIso,
        lecture: c.lecture_id,
        user: userId,
      },
      `flashcard ${c.id}`,
    );
  }

  for (const q of demoData.quizzes) {
    await upsert(
      pb,
      "quizzes",
      q.id,
      {
        title: q.title,
        questions: q.questions,
        total_points: q.total_points,
        source: "auto_generated",
        lecture: q.lecture_id,
        user: userId,
      },
      `quiz ${q.id}`,
    );
  }

  for (const s of demoData.study_sessions) {
    await upsert(
      pb,
      "study_sessions",
      s.id,
      {
        session_type: "flashcard_review",
        cards_reviewed: s.cards_reviewed,
        cards_correct: s.cards_correct,
        duration_secs: s.duration_secs,
        started_at: daysAgoIso(s.days_ago),
        ended_at: daysAgoIsoOffset(s.days_ago, s.duration_secs),
        lecture: s.lecture_id,
        user: userId,
      },
      `study_session ${s.id}`,
    );
  }

  const totals = {
    courses: demoData.courses.length,
    lectures: demoData.lectures.length,
    transcripts: demoData.transcripts.length,
    notes: demoData.notes.length,
    flashcards: demoData.flashcards.length,
    quizzes: demoData.quizzes.length,
    study_sessions: demoData.study_sessions.length,
  };
  console.log("Done.", totals);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", getErrorMessage(err));
  process.exit(1);
});
