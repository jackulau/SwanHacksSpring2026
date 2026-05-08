// Flow: Quiz -> Flashcard deck.
//
// Turns a quiz's questions into a deck so the user can spaced-repetition
// review the same content. Each question becomes one card:
//   - multiple_choice: front = question, back = correct option
//   - true_false:     front = question, back = "True" / "False"
//   - short_answer:   front = question, back = canonical answer
// We also include the explanation in the back when present.

import { pb } from "../pocketbase";
import type { Flashcard, Quiz, QuizQuestion } from "../types";
import { ingestFlashcard } from "../knowledge/ingest";

export interface FlashcardsFromQuizOptions {
  /** Override the deck name (default: "<quiz title> deck"). */
  deckName?: string;
  /** Cap card count. */
  maxCards?: number;
}

export interface FlashcardsFromQuizResult {
  deckName: string;
  cardsCreated: number;
}

export async function flashcardsFromQuiz(
  quizId: string,
  opts: FlashcardsFromQuizOptions = {},
): Promise<FlashcardsFromQuizResult> {
  const quiz = await pb.collection("quizzes").getOne<Quiz>(quizId);
  if (!quiz) throw new Error("Quiz not found");
  const deckName =
    opts.deckName ?? `${quiz.title || "Quiz"} review`;
  const max = opts.maxCards ?? 50;

  const cards = (quiz.questions ?? []).slice(0, max).map(questionToCard);
  let created = 0;
  for (const c of cards) {
    if (!c) continue;
    try {
      const written = await pb.collection("flashcards").create<Flashcard>({
        lecture: quiz.lecture || "",
        user: quiz.user,
        deck_name: deckName,
        front: c.front,
        back: c.back,
        front_image: "",
        back_image: "",
        tags: ["from-quiz"],
        difficulty: "medium",
        source: "auto_generated",
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
      });
      created++;
      void ingestFlashcard(quiz.user, written).catch(() => undefined);
    } catch {
      // ignore per-card failures
    }
  }
  return { deckName, cardsCreated: created };
}

function questionToCard(
  q: QuizQuestion,
): { front: string; back: string } | null {
  switch (q.type) {
    case "multiple_choice": {
      const correct = q.options[q.correct_answer] ?? "";
      const back = q.explanation
        ? `${correct}\n\n${q.explanation}`
        : correct;
      return { front: q.question, back };
    }
    case "true_false": {
      const back = q.explanation
        ? `${q.correct_answer ? "True" : "False"}\n\n${q.explanation}`
        : q.correct_answer
          ? "True"
          : "False";
      return { front: q.question, back };
    }
    case "short_answer":
    case "fill_blank": {
      const back = q.explanation
        ? `${q.correct_answer}\n\n${q.explanation}`
        : q.correct_answer;
      return { front: q.question, back };
    }
  }
  return null;
}
