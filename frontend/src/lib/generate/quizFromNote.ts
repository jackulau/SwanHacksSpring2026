// Sibling of quizFromLecture: build a quiz from a NotePage's blocks
// rather than a lecture transcript. Useful when the user wrote their
// own study notes and wants to self-test on them without the lecture
// pipeline.

import { pb } from "../pocketbase";
import {
  resolveProvider,
  StubProvider,
  type LlmProvider,
  type LlmProviderId,
} from "../llm/providers";
import { ingestQuiz } from "../knowledge/ingest";
import type {
  MultipleChoiceQuestion,
  NoteBlock,
  NotePage,
  Quiz,
  QuizQuestion,
} from "../types";

export interface QuizFromNoteOptions {
  questionCount?: number;
  provider?: LlmProviderId;
  abortSignal?: AbortSignal;
}

const DEFAULT_Q = 6;
const MIN_Q = 3;
const MAX_Q = 12;

export async function quizFromNote(
  noteId: string,
  opts: QuizFromNoteOptions = {},
): Promise<Quiz> {
  const page = await pb.collection("note_pages").getOne<NotePage>(noteId);
  if (!page) throw new Error("Note not found");
  const text = blocksToPlainText(page.title, page.blocks ?? []);
  if (!text.trim()) {
    throw new Error("Add some content to the note before generating a quiz.");
  }
  const target = clamp(opts.questionCount ?? DEFAULT_Q, MIN_Q, MAX_Q);
  const provider = await resolveProvider(opts.provider);
  let questions = await runQuizCompletion(provider, text, target);
  if (questions.length < MIN_Q) {
    const fallback = await runQuizCompletion(new StubProvider(), text, target);
    const seen = new Set(questions.map((q) => q.question));
    for (const q of fallback) {
      if (questions.length >= MIN_Q) break;
      if (seen.has(q.question)) continue;
      questions.push(q);
    }
  }
  questions = questions.slice(0, target);
  const totalPoints = questions.reduce((s, q) => s + (q.points ?? 1), 0);
  const written = await pb.collection("quizzes").create<Quiz>({
    user: page.user,
    lecture: page.lecture || "",
    title: `${page.title || "Note"} — quiz`,
    questions,
    total_points: totalPoints,
    source: "auto_generated",
  });
  void ingestQuiz(page.user, written).catch(() => undefined);
  return written;
}

async function runQuizCompletion(
  provider: LlmProvider,
  text: string,
  target: number,
): Promise<QuizQuestion[]> {
  const system =
    "You are a study-aid generator. Output JSON {questions: " +
    "[{type: 'multiple_choice', question, options, correct_answer, " +
    `difficulty, concept_tag}]}. Produce ${target} multiple-choice ` +
    "questions. correct_answer is the 0-based index. JSON only.";
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:quiz\n${text}` },
    ],
    { json: true, temperature: 0.4, maxTokens: 2048 },
  );
  return shapeQuestions(completion.json ?? completion.text);
}

function shapeQuestions(raw: unknown): QuizQuestion[] {
  const candidate = (() => {
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
  if (!candidate || typeof candidate !== "object") return [];
  const obj = candidate as Record<string, unknown>;
  const arr = Array.isArray(obj.questions)
    ? obj.questions
    : Array.isArray(candidate)
      ? (candidate as unknown[])
      : null;
  if (!arr) return [];
  const out: QuizQuestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const question = String(rec.question ?? "").trim();
    const options = Array.isArray(rec.options)
      ? (rec.options as unknown[]).map((o) => String(o)).slice(0, 6)
      : [];
    if (options.length < 2) continue;
    let correct = Number(rec.correct_answer);
    if (!Number.isFinite(correct) || correct < 0 || correct >= options.length) {
      correct = 0;
    }
    const q: MultipleChoiceQuestion = {
      id: Math.random().toString(36).slice(2, 10),
      type: "multiple_choice",
      question,
      options,
      correct_answer: correct,
      points: 100,
      difficulty: shapeDifficulty(rec.difficulty),
      concept_tag: String(rec.concept_tag ?? "").slice(0, 64),
      explanation: rec.explanation ? String(rec.explanation) : undefined,
    };
    out.push(q);
  }
  return out;
}

function shapeDifficulty(raw: unknown): "easy" | "medium" | "hard" {
  const v = String(raw ?? "").toLowerCase();
  if (v === "easy" || v === "medium" || v === "hard") return v;
  return "medium";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function blocksToPlainText(title: string, blocks: NoteBlock[]): string {
  const lines: string[] = [];
  if (title.trim()) lines.push(title.trim(), "");
  for (const b of blocks) {
    const t =
      (b as { text?: string }).text ??
      (b as { code?: string }).code ??
      (b as { expression?: string }).expression ??
      "";
    if (t) lines.push(String(t));
  }
  return lines.join("\n");
}
