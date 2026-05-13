// Flow: arbitrary text -> Flashcard deck.
//
// Sibling of flashcardsFromNote, but for callers that already have the
// raw text (e.g. the inline-AI menu acting on a selection inside a note
// editor). Same provider abstraction, same shape result.

import { pb } from "../pocketbase";
import {
  resolveProvider,
  type LlmProvider,
  type LlmProviderId,
} from "../llm/providers";
import type { Flashcard } from "../types";
import { ingestFlashcard } from "../knowledge/ingest";

export interface FlashcardsFromTextOptions {
  userId: string;
  deckName: string;
  /** Optional lecture id to attach the cards to. Empty string when the
   *  text comes from a free-floating selection. */
  lectureId?: string;
  provider?: LlmProviderId;
  maxCards?: number;
  abortSignal?: AbortSignal;
}

export interface FlashcardsFromTextResult {
  deckName: string;
  cardsCreated: number;
  providerId: string;
}

const DEFAULT_MAX_CARDS = 6;

export async function flashcardsFromText(
  text: string,
  opts: FlashcardsFromTextOptions,
): Promise<FlashcardsFromTextResult> {
  if (!text.trim()) {
    throw new Error("flashcardsFromText: empty text");
  }
  const provider = await resolveProvider(opts.provider);
  const cards = await runFlashcardsCompletion(provider, text, {
    maxCards: opts.maxCards ?? DEFAULT_MAX_CARDS,
    abortSignal: opts.abortSignal,
  });
  let created = 0;
  for (const card of cards) {
    try {
      const written = await pb.collection("flashcards").create<Flashcard>({
        lecture: opts.lectureId ?? "",
        user: opts.userId,
        deck_name: opts.deckName,
        front: card.front,
        back: card.back,
        front_image: "",
        back_image: "",
        tags: ["selection"],
        difficulty: "medium",
        source: "auto_generated",
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
      });
      created++;
      void ingestFlashcard(opts.userId, written).catch(() => undefined);
    } catch {
      // ignore per-card failures
    }
  }
  return { deckName: opts.deckName, cardsCreated: created, providerId: provider.id };
}

interface FlashcardPair {
  front: string;
  back: string;
}

async function runFlashcardsCompletion(
  provider: LlmProvider,
  text: string,
  opts: { maxCards: number; abortSignal?: AbortSignal },
): Promise<FlashcardPair[]> {
  const system =
    "You are a study-aid generator. Given a passage, output a JSON " +
    "object {\"cards\": [{\"front\": string, \"back\": string}]} with " +
    `between 3 and ${opts.maxCards} flashcards. front is a concise ` +
    "question; back is the answer. JSON only.";
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:flashcards\n${text}` },
    ],
    { json: true, temperature: 0.4, abortSignal: opts.abortSignal, maxTokens: 1024 },
  );
  return extractCards(completion.json ?? completion.text).slice(0, opts.maxCards);
}

function extractCards(raw: unknown): FlashcardPair[] {
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
  let arr: unknown[] | null = null;
  if (Array.isArray(obj.cards)) arr = obj.cards;
  else if (Array.isArray(obj.flashcards)) arr = obj.flashcards;
  else if (Array.isArray(candidate)) arr = candidate as unknown[];
  if (!arr) return [];
  const out: FlashcardPair[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const front = String(rec.front ?? rec.question ?? rec.q ?? "").trim();
    const back = String(rec.back ?? rec.answer ?? rec.a ?? "").trim();
    if (front && back) out.push({ front, back });
  }
  return out;
}
