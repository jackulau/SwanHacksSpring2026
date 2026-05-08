// Flow: Lecture transcript -> Quiz.
//
// Reads the most recent transcript for a lecture, runs it through the LLM
// (or Stub) to get a list of multiple-choice questions, and writes a fresh
// `quizzes` row tagged `auto_generated`. We always produce *new* quiz rows
// rather than mutating the existing one — re-running creates another quiz
// the user can pick from on the lecture detail page. The lecture row's
// status is left alone here; this flow is independent of the legacy ai-
// pipeline that mutates `lectures.status`.
//
// The clamp at 6-12 matches the spec; if the LLM returns fewer than 6 we
// pad from the Stub's deterministic generator so the quiz is always usable.

import { pb } from "../pocketbase";
import { resolveProvider, StubProvider, type LlmProvider, type LlmProviderId } from "../llm/providers";
import type {
  Lecture,
  MultipleChoiceQuestion,
  Quiz,
  Transcript,
} from "../types";

export interface QuizFromLectureOptions {
  provider?: LlmProviderId;
  /** Override the quiz title (default: derived from lecture title). */
  title?: string;
  /** Question count target (default 8, clamped to 6..12). */
  questionCount?: number;
  abortSignal?: AbortSignal;
}

const MIN_Q = 6;
const MAX_Q = 12;
const DEFAULT_Q = 8;

export async function quizFromLecture(
  lectureId: string,
  opts: QuizFromLectureOptions = {},
): Promise<Quiz> {
  const lecture = await pb.collection("lectures").getOne<Lecture>(lectureId);
  if (!lecture) throw new Error("Lecture not found");

  // Most-recent transcript first. `-id` is used here for the same reason
  // the lecture detail page uses it: autodate fields aren't always populated
  // on seeded data, and `-id` is monotonic in PocketBase.
  const transcripts = await pb
    .collection("transcripts")
    .getFullList<Transcript>({
      filter: `lecture = "${lectureId}"`,
      sort: "-id",
      requestKey: `quiz-from-lecture-transcripts-${lectureId}`,
    })
    .catch(() => [] as Transcript[]);
  const transcript = transcripts[0];
  const text = (transcript?.clean_text || transcript?.raw_text || "").trim();
  if (!text) {
    throw new Error("This lecture has no transcript yet — generate one first.");
  }

  const target = clamp(opts.questionCount ?? DEFAULT_Q, MIN_Q, MAX_Q);
  const provider = await resolveProvider(opts.provider);
  let questions = await runQuizCompletion(provider, text, target, opts.abortSignal);

  // Floor at MIN_Q. If the real provider undershot, ask the Stub to fill
  // the rest from the same text so we never create an unusable row.
  if (questions.length < MIN_Q) {
    const fallback = await runQuizCompletion(new StubProvider(), text, target, opts.abortSignal);
    const seen = new Set(questions.map((q) => q.question));
    for (const q of fallback) {
      if (questions.length >= MIN_Q) break;
      if (seen.has(q.question)) continue;
      questions.push(q);
    }
  }
  questions = questions.slice(0, target);

  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
  const title = opts.title ?? `${lecture.title} — quiz`;
  const written = await pb.collection("quizzes").create<Quiz>({
    lecture: lectureId,
    user: lecture.user,
    title,
    questions,
    total_points: totalPoints,
    source: "auto_generated",
  });
  // Best-effort knowledge ingest so the new quiz surfaces in /knowledge
  // search immediately. The dynamic import avoids pulling the ingest
  // module into the quiz-generation path on first load.
  try {
    const mod = await import("../knowledge/ingest");
    void mod.ingestQuiz(lecture.user, written).catch(() => undefined);
  } catch {
    // ignore
  }
  return written;
}

/**
 * Prompt the provider for an array of multiple_choice questions. We ask
 * specifically for that shape (not a mixed-question quiz) because the spec
 * requires multi-choice and because mixed-format generation is brittle when
 * the underlying model isn't guaranteed strong. The Stub matches the marker
 * and returns its deterministic output; real providers see the JSON-mode
 * hint and reply with structured data.
 */
async function runQuizCompletion(
  provider: LlmProvider,
  text: string,
  target: number,
  abortSignal?: AbortSignal,
): Promise<MultipleChoiceQuestion[]> {
  const system =
    "You are a study-aid generator. Build a multiple-choice quiz from " +
    "the lecture transcript below. Output a single JSON object: " +
    '{"questions": [{"id": string, "type": "multiple_choice", ' +
    '"question": string, "options": string[4], "correct_answer": ' +
    '0|1|2|3, "points": number, "difficulty": "easy"|"medium"|"hard", ' +
    '"concept_tag": string, "explanation"?: string}]}. Aim for ' +
    `${target} questions. Distractors must be plausible. JSON only.`;
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:quiz\n${text}` },
    ],
    { json: true, temperature: 0.3, abortSignal, maxTokens: 3072 },
  );
  return shapeQuestions(completion.json ?? completion.text);
}

function shapeQuestions(raw: unknown): MultipleChoiceQuestion[] {
  const parsed = (() => {
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    return raw;
  })();
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  const arr = Array.isArray(obj.questions)
    ? obj.questions
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];
  const out: MultipleChoiceQuestion[] = [];
  arr.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const options = Array.isArray(r.options)
      ? (r.options as unknown[]).map((o) => String(o)).slice(0, 4)
      : [];
    if (options.length < 2) return;
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
    const correctRaw = r.correct_answer;
    let correct = 0;
    if (typeof correctRaw === "number") {
      correct = clamp(Math.floor(correctRaw), 0, 3);
    } else if (typeof correctRaw === "string") {
      // Tolerate "0".."3" or letter answers like "A".."D".
      const asNum = Number(correctRaw);
      if (Number.isFinite(asNum)) correct = clamp(Math.floor(asNum), 0, 3);
      else {
        const letter = correctRaw.trim().toUpperCase().charCodeAt(0) - 65;
        if (letter >= 0 && letter <= 3) correct = letter;
      }
    }
    out.push({
      id: String(r.id ?? `q${idx + 1}`),
      type: "multiple_choice",
      question: String(r.question ?? "").trim() || `Question ${idx + 1}`,
      options,
      correct_answer: correct,
      points: typeof r.points === "number" && r.points > 0 ? r.points : 1,
      difficulty: normalizeDifficulty(r.difficulty),
      concept_tag: String(r.concept_tag ?? "").trim(),
      explanation:
        typeof r.explanation === "string" && r.explanation.trim()
          ? r.explanation.trim()
          : undefined,
    });
  });
  return out;
}

function normalizeDifficulty(raw: unknown): "easy" | "medium" | "hard" {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
