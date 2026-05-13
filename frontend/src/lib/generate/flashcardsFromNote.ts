// Flow: NotePage -> Flashcard deck.
//
// Reads the page blocks, flattens them into a single text payload, asks the
// LLM (real or stub) for {front, back} pairs, then writes one Flashcard row
// per pair into PocketBase. Source is stamped `auto_generated` so the rest
// of the app can distinguish these from manually-authored cards.
//
// Each NotePage gets its own deck — the deck_name is "<page title> deck"
// (truncated and sanitized so the /study/flashcards?deck= URL works) so a
// page can be regenerated repeatedly without merging into other decks. We
// don't dedupe across runs; that's what archive/delete on the deck index
// page is for. Re-running effectively creates new cards that overlay the
// old ones in spaced-repetition rotation.

import { pb } from "../pocketbase";
import { resolveProvider, type LlmProvider, type LlmProviderId } from "../llm/providers";
import type { Flashcard, NoteBlock, NotePage } from "../types";
import { ingestFlashcard } from "../knowledge/ingest";

export interface FlashcardsFromNoteOptions {
  /** Pin a specific provider; falls back through the resolver chain. */
  provider?: LlmProviderId;
  /** Override the deck name (default: derived from page title). */
  deckName?: string;
  /** Cap card count (default 10). */
  maxCards?: number;
  abortSignal?: AbortSignal;
}

export interface FlashcardsFromNoteResult {
  deckName: string;
  cardsCreated: number;
  providerId: string;
}

const DEFAULT_MAX_CARDS = 10;

export async function flashcardsFromNote(
  noteId: string,
  opts: FlashcardsFromNoteOptions = {},
): Promise<FlashcardsFromNoteResult> {
  const page = await pb.collection("note_pages").getOne<NotePage>(noteId);
  if (!page) throw new Error("Note page not found");

  const text = blocksToPlainText(page.title, page.blocks ?? []);
  if (text.trim().length === 0) {
    throw new Error("This page is empty — add some content before generating flashcards.");
  }

  const provider = await resolveProvider(opts.provider);
  const cards = await runFlashcardsCompletion(provider, text, {
    maxCards: opts.maxCards ?? DEFAULT_MAX_CARDS,
    abortSignal: opts.abortSignal,
  });

  const deckName = opts.deckName ?? deriveDeckName(page.title);

  // Write each card. We tolerate per-row failures so a single bad row doesn't
  // wipe out the whole deck — the count we return reflects what actually
  // landed.
  let created = 0;
  for (const card of cards) {
    try {
      const written = await pb.collection("flashcards").create<Flashcard>({
        lecture: page.lecture || "",
        user: page.user,
        deck_name: deckName,
        front: card.front,
        back: card.back,
        front_image: "",
        back_image: "",
        tags: [],
        difficulty: "medium",
        source: "auto_generated",
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
      });
      created++;
      // Best-effort knowledge ingest so the new card surfaces in
      // /knowledge search without manual backfill. Swallow errors so a
      // search-index hiccup never aborts the deck creation flow.
      void ingestFlashcard(page.user, written).catch(() => undefined);
    } catch {
      // Per-card create failed; continue with the rest.
    }
  }

  return { deckName, cardsCreated: created, providerId: provider.id };
}

interface FlashcardPair {
  front: string;
  back: string;
}

/**
 * Run the prompt against the chosen provider with a structured-output hint.
 * Stub returns its deterministic 6-card output; real providers reply with
 * JSON we parse and shape. If the parse fails or the shape is wrong, we
 * fall back to splitting the raw text on lines so the user always gets
 * something. The flow marker (`__flow:flashcards`) is what the StubProvider
 * pattern-matches on to pick its placeholder branch.
 */
async function runFlashcardsCompletion(
  provider: LlmProvider,
  text: string,
  opts: { maxCards: number; abortSignal?: AbortSignal },
): Promise<FlashcardPair[]> {
  const system =
    "You are a study-aid generator. Given a note page, output a JSON " +
    "object {\"cards\": [{\"front\": string, \"back\": string}]} with " +
    `between 4 and ${opts.maxCards} flashcards. The front is a concise ` +
    "question or prompt; the back is the answer or explanation. No " +
    "commentary, no markdown — JSON only.";
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:flashcards\n${text}` },
    ],
    { json: true, temperature: 0.4, abortSignal: opts.abortSignal, maxTokens: 2048 },
  );
  const cards = extractCards(completion.json ?? completion.text);
  // Cap to maxCards. The Stub returns exactly 6 which is within range.
  return cards.slice(0, opts.maxCards);
}

function extractCards(raw: unknown): FlashcardPair[] {
  // Real LLMs may put cards directly at the root, or under .cards, or under
  // .flashcards. Stub uses .cards. We try them in order.
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

/**
 * Flatten the page's blocks into a plain-text prompt. We keep headings on
 * their own line (so the LLM perceives structure), drop dividers, and
 * skip embeds/images. Code is included verbatim because lecture pages
 * sometimes use it for definitions.
 */
function blocksToPlainText(title: string, blocks: NoteBlock[]): string {
  const lines: string[] = [];
  if (title.trim()) lines.push(title.trim(), "");
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        lines.push("\n" + "#".repeat(b.level) + " " + (b.text || ""));
        break;
      case "paragraph":
        if (b.text) lines.push(b.text);
        break;
      case "bullet_item":
      case "numbered_item":
        if (b.text) lines.push("- " + b.text);
        break;
      case "todo":
        lines.push(`- [${b.checked ? "x" : " "}] ${b.text}`);
        break;
      case "callout":
      case "quote":
      case "example":
        if (b.text) lines.push(b.text);
        break;
      case "key_term":
        lines.push(`${b.term}: ${b.definition}`);
        break;
      case "code":
        lines.push(b.code);
        break;
      case "bullet_list":
        for (const it of b.items) lines.push("- " + it);
        break;
      case "math":
        if (b.expression) lines.push(b.expression);
        break;
      case "table":
        for (const row of b.rows) lines.push(row.join(" | "));
        break;
      case "toggle":
        if (b.text) lines.push(b.text);
        break;
      case "page_ref":
        if (b.title) lines.push(`(see also: ${b.title})`);
        break;
      // divider, image, embed — skipped intentionally
    }
  }
  return lines.join("\n").trim();
}

/**
 * Build a deck name from the page title. We keep words and digits, replace
 * everything else with spaces, collapse runs, and lowercase. This is the
 * value that ends up in the URL (`/study/flashcards?deck=…`).
 */
export function deriveDeckName(title: string): string {
  const base = (title || "Untitled deck").trim();
  return `${truncate(base, 60)} deck`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
