// Flow: arbitrary text -> ConceptCard[] -> NotePage key_term blocks.
//
// Two-step pipeline. The first step (`conceptsFromText`) is purely
// in-memory: it runs the prompt against the resolved provider and parses
// the JSON shape into a list of {term, definition, importance} cards.
// When no provider is reachable we fall through to a deterministic stub
// derived from the input sentences so the route stays functional offline.
//
// The second step (`appendConceptsToPage`) is the side-effect: read the
// destination NotePage, append a "Key concepts" heading and one key_term
// block per concept (plus an optional "important" callout for the high-
// importance ones), persist via PocketBase, and re-ingest into the
// knowledge graph so search/ask reflect the new content.

import { pb } from "../pocketbase";
import {
  resolveProvider,
  type LlmProvider,
  type LlmProviderId,
} from "../llm/providers";
import type {
  CalloutBlock,
  HeadingBlock,
  KeyTermBlock,
  NoteBlock,
  NotePage,
} from "../types";
import { ingestNote } from "../knowledge/ingest";

export interface ConceptCard {
  term: string;
  definition: string;
  importance: "low" | "medium" | "high";
}

export interface ConceptsFromTextOptions {
  provider?: LlmProviderId;
  /** Cap concept count (default 7). The model is asked for 3–7. */
  maxConcepts?: number;
  abortSignal?: AbortSignal;
}

const DEFAULT_MAX_CONCEPTS = 7;
const DEFAULT_MIN_CONCEPTS = 3;

/**
 * Pull 3–7 named concepts out of a passage. Calls the LLM provider with a
 * structured-output hint and parses the reply. If the provider is offline
 * or returns nothing usable we fall back to a sentence-based stub so the
 * caller always gets at least a few concept cards.
 */
export async function conceptsFromText(
  text: string,
  opts: ConceptsFromTextOptions = {},
): Promise<ConceptCard[]> {
  if (!text.trim()) {
    throw new Error("conceptsFromText: empty text");
  }
  const max = opts.maxConcepts ?? DEFAULT_MAX_CONCEPTS;
  try {
    const provider = await resolveProvider(opts.provider);
    const cards = await runConceptsCompletion(provider, text, {
      maxConcepts: max,
      abortSignal: opts.abortSignal,
    });
    if (cards.length > 0) return cards.slice(0, max);
  } catch {
    // fall through to stub
  }
  return stubConceptsFromText(text, max);
}

/**
 * Append the concepts to an existing NotePage as a "Key concepts" section.
 *
 * Importance maps to block decoration:
 *   - high   -> emit a "important" callout pointing at the term, then the
 *               key_term block itself
 *   - medium -> key_term only
 *   - low    -> key_term only (terse)
 *
 * Re-ingests the page so /knowledge surfaces stay current. Returns the
 * updated NotePage so the caller can navigate to it.
 */
export async function appendConceptsToPage(
  pageId: string,
  concepts: ConceptCard[],
): Promise<NotePage> {
  if (concepts.length === 0) {
    throw new Error("appendConceptsToPage: no concepts to append");
  }
  const page = await pb.collection("note_pages").getOne<NotePage>(pageId);
  if (!page) throw new Error("Note page not found");

  const existing: NoteBlock[] = Array.isArray(page.blocks) ? page.blocks : [];
  const appended = buildConceptBlocks(concepts);
  const nextBlocks = [...existing, ...appended];

  const updated = await pb
    .collection("note_pages")
    .update<NotePage>(page.id, { blocks: nextBlocks });

  // Best-effort knowledge re-ingest so search/ask see the new concepts.
  void ingestNote(updated.user, updated).catch(() => undefined);
  return updated;
}

/**
 * Build the heading + key_term blocks (plus optional callouts for the
 * high-importance entries). IDs are generated client-side with a stable
 * prefix so equality checks elsewhere don't see this section thrash.
 */
export function buildConceptBlocks(concepts: ConceptCard[]): NoteBlock[] {
  const out: NoteBlock[] = [];
  let i = 0;
  const id = () => `kc-${Date.now().toString(36)}-${(i++).toString(36)}`;
  const heading: HeadingBlock = {
    id: id(),
    type: "heading",
    level: 2,
    text: "Key concepts",
  };
  out.push(heading);
  for (const c of concepts) {
    if (c.importance === "high") {
      const callout: CalloutBlock = {
        id: id(),
        type: "callout",
        variant: "important",
        text: `Cornerstone concept: ${c.term}`,
      };
      out.push(callout);
    }
    const block: KeyTermBlock = {
      id: id(),
      type: "key_term",
      term: c.term,
      definition: c.definition,
    };
    out.push(block);
  }
  return out;
}

/* ─────────── LLM plumbing ─────────── */

async function runConceptsCompletion(
  provider: LlmProvider,
  text: string,
  opts: { maxConcepts: number; abortSignal?: AbortSignal },
): Promise<ConceptCard[]> {
  const system =
    "You are a study-aid generator. Extract the key named concepts from " +
    'the passage. Output a JSON object {"concepts": [{"term": string, ' +
    '"definition": string, "importance": "low"|"medium"|"high"}]} with ' +
    `between ${DEFAULT_MIN_CONCEPTS} and ${opts.maxConcepts} entries. ` +
    "term is a noun phrase; definition is one or two sentences; " +
    "importance reflects how central the concept is to the passage. " +
    "JSON only, no commentary.";
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:concepts\n${text}` },
    ],
    {
      json: true,
      temperature: 0.3,
      abortSignal: opts.abortSignal,
      maxTokens: 1024,
    },
  );
  return extractConcepts(completion.json ?? completion.text);
}

function extractConcepts(raw: unknown): ConceptCard[] {
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
  if (Array.isArray(obj.concepts)) arr = obj.concepts;
  else if (Array.isArray(obj.cards)) arr = obj.cards;
  else if (Array.isArray(obj.terms)) arr = obj.terms;
  else if (Array.isArray(candidate)) arr = candidate as unknown[];
  if (!arr) return [];
  const out: ConceptCard[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const term = String(r.term ?? r.name ?? r.concept ?? "").trim();
    const definition = String(
      r.definition ?? r.description ?? r.meaning ?? "",
    ).trim();
    if (!term || !definition) continue;
    const rawImp = String(r.importance ?? r.priority ?? "medium").toLowerCase();
    const importance: ConceptCard["importance"] =
      rawImp === "high" || rawImp === "low" ? rawImp : "medium";
    out.push({ term, definition, importance });
  }
  return out;
}

/* ─────────── Deterministic offline stub ─────────── */

/**
 * Sentence-based concept synthesizer. Used when no real provider answers.
 * Each sentence becomes one ConceptCard whose term is the longest non-
 * stopword and whose definition is the original sentence (truncated). The
 * first sentence is rated "high", the next two "medium", the rest "low",
 * which matches the rough shape a real model produces.
 */
function stubConceptsFromText(text: string, max: number): ConceptCard[] {
  const sents = splitSentences(text);
  const usable = sents.filter((s) => s.length > 12);
  const cards: ConceptCard[] = [];
  for (let i = 0; i < usable.length && cards.length < max; i++) {
    const term = extractKeyword(usable[i]);
    if (!term) continue;
    const importance: ConceptCard["importance"] =
      cards.length === 0 ? "high" : cards.length < 3 ? "medium" : "low";
    cards.push({
      term,
      definition: truncate(usable[i], 220),
      importance,
    });
  }
  // Always emit at least the minimum so the UI has something to show.
  let pad = 1;
  while (cards.length < DEFAULT_MIN_CONCEPTS) {
    cards.push({
      term: `Concept ${pad}`,
      definition:
        "Re-read the passage and capture this idea in your own words.",
      importance: "low",
    });
    pad++;
  }
  return cards;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const STOPWORDS = new Set([
  "the", "and", "with", "from", "that", "this", "their", "those", "these",
  "into", "about", "over", "under", "between", "while", "where", "which",
  "would", "could", "should", "there", "have", "been", "what", "when",
  "your", "they", "them", "will", "also", "such", "than", "then", "more",
]);

function extractKeyword(sentence: string): string {
  const words = sentence
    .replace(/[^\p{Letter}\p{Number}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  let best = "";
  for (const w of words) {
    const lw = w.toLowerCase();
    if (STOPWORDS.has(lw)) continue;
    if (lw.length > best.length) best = w;
  }
  return best || words[0] || "concept";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
