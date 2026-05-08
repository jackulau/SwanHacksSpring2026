// LLM provider abstraction for the Generate pipeline.
//
// The Generate flows (note -> flashcards, lecture -> quiz, course -> study
// plan) compose a prompt, hand it to a provider, and parse the JSON reply.
// Providers are pluggable so we can swap Anthropic / OpenAI / Ollama without
// touching the flow code, and fall back to a deterministic StubProvider
// when no real key is configured. That keeps the UI working end-to-end on
// a fresh checkout, in CI, and on demo machines.
//
// Real-API providers route through PB JS hooks (so the API key never lands
// in the browser). Those hooks require a PB restart to deploy, which the
// agent can't trigger; therefore each provider probes its endpoint at
// `isAvailable` time and `resolveProvider` falls through to Ollama (which
// runs locally without a key) and then Stub.

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmCompleteOptions {
  /** Maximum response tokens. Providers may clamp. */
  maxTokens?: number;
  /** 0..1 sampling temperature. Lower for structured-output flows. */
  temperature?: number;
  /** When true, hint that the reply must be a JSON object. */
  json?: boolean;
  abortSignal?: AbortSignal;
}

export interface LlmCompletion {
  text: string;
  /** Best-effort parsed JSON if `opts.json` was set; null otherwise. */
  json?: unknown;
  latencyMs?: number;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly model: string;
  isAvailable(): Promise<boolean>;
  complete(messages: LlmMessage[], opts?: LlmCompleteOptions): Promise<LlmCompletion>;
}

export type LlmProviderId = "stub" | "anthropic" | "openai" | "ollama";

export const ALL_LLM_PROVIDER_IDS: LlmProviderId[] = [
  "anthropic",
  "openai",
  "ollama",
  "stub",
];

// ──────────────────────────────────────────────
// Stub provider — deterministic, key-free
// ──────────────────────────────────────────────

/**
 * Deterministic placeholder provider.
 *
 * The Stub doesn't try to be a real LLM — it inspects the user's last
 * message for one of the Generate flow markers (`__flow:flashcards`,
 * `__flow:quiz`, `__flow:study_plan`) plus a payload, then synthesizes
 * a structurally valid JSON reply derived from the input text. The seed
 * is the input length so the same input always produces the same output,
 * which keeps tests and demos predictable.
 *
 * The flow modules in `lib/generate/*` know to set those markers when
 * calling through; everyone else just gets an echo-style reply.
 */
export class StubProvider implements LlmProvider {
  readonly id = "stub" as const;
  readonly model = "stub-deterministic";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(
    messages: LlmMessage[],
    opts?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const t0 = performance.now();
    const last = messages[messages.length - 1]?.content ?? "";
    const flow = detectFlow(last);
    let payload: unknown = { reply: "stub: no real LLM configured" };
    if (flow.kind === "flashcards") {
      payload = { cards: stubFlashcards(flow.text) };
    } else if (flow.kind === "quiz") {
      payload = { questions: stubQuizQuestions(flow.text) };
    } else if (flow.kind === "study_plan") {
      payload = { blocks: stubStudyPlanBlocks(flow.text) };
    }
    const text = JSON.stringify(payload);
    // Small delay so the UI's "generating…" affordance is visible.
    await new Promise((r) => setTimeout(r, 150));
    return {
      text,
      json: opts?.json ? payload : undefined,
      latencyMs: performance.now() - t0,
    };
  }
}

interface FlowMarker {
  kind: "flashcards" | "quiz" | "study_plan" | "none";
  text: string;
}

function detectFlow(content: string): FlowMarker {
  const m = content.match(/__flow:(flashcards|quiz|study_plan)\s*\n([\s\S]*)/);
  if (!m) return { kind: "none", text: content };
  return { kind: m[1] as FlowMarker["kind"], text: m[2].trim() };
}

/**
 * Split `text` into paragraphs (blank-line-delimited), keep non-empty ones,
 * and return them. Used by all three stub flows so the cards/questions/plan
 * are correlated with the input.
 */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Sentence split that's good enough for short-form study material. Splits
 * on `.`, `!`, `?` followed by whitespace, plus newlines. Avoids the regex
 * gymnastics of a real sentence tokenizer; the rest of the pipeline is
 * tolerant of messy boundaries.
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Build 6 deterministic flashcards from input text. We seed off paragraph
 * boundaries because that's where most of the structure lives in lecture
 * notes — the first sentence of each paragraph is usually the topic, the
 * rest is elaboration. If the input is too short, we fall back to the
 * sentence list and pad with topic-style placeholders so the deck always
 * has a useful card count.
 */
function stubFlashcards(text: string): { front: string; back: string }[] {
  const paras = paragraphs(text);
  const cards: { front: string; back: string }[] = [];
  for (const p of paras) {
    const sents = sentences(p);
    if (sents.length === 0) continue;
    const front = truncate(sents[0], 120);
    const back = truncate(sents.slice(1).join(" ") || sents[0], 320);
    cards.push({ front, back });
    if (cards.length >= 6) break;
  }
  if (cards.length < 6) {
    const sents = sentences(text);
    let i = 0;
    while (cards.length < 6 && i < sents.length) {
      const s = sents[i];
      if (s.length > 6) {
        // Split a sentence into a "what is X?" / "X is …" pair.
        const half = Math.max(1, Math.floor(s.length / 3));
        cards.push({
          front: `What does this mean: "${truncate(s.slice(0, half), 80)}…"?`,
          back: truncate(s, 320),
        });
      }
      i++;
    }
  }
  while (cards.length < 6) {
    const idx = cards.length + 1;
    cards.push({
      front: `Review point ${idx}`,
      back: `Re-read your notes for review point ${idx} and summarize in your own words.`,
    });
  }
  return cards.slice(0, 6);
}

/**
 * Build 6 multiple-choice questions deterministically. We pick six anchor
 * sentences from the input, treat each anchor's first word/keyword as the
 * "correct" answer, and synthesize three plausible distractors from the
 * surrounding text. The distractor selection is intentionally cheap — it
 * just rotates other anchor keywords — so the questions are recognizable
 * placeholders rather than a real comprehension test.
 */
function stubQuizQuestions(text: string): {
  id: string;
  type: "multiple_choice";
  question: string;
  options: string[];
  correct_answer: number;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  concept_tag: string;
  explanation?: string;
}[] {
  const sents = sentences(text);
  const usable = sents.filter((s) => s.length > 12);
  const anchors: string[] = [];
  for (let i = 0; i < usable.length && anchors.length < 6; i++) {
    anchors.push(usable[i]);
  }
  while (anchors.length < 6) {
    anchors.push(`Review point ${anchors.length + 1} from this lecture.`);
  }
  const keywords = anchors.map(extractKeyword);

  const questions = anchors.map((anchor, i) => {
    const correct = keywords[i];
    // Three distractors are the other anchors' keywords rotated; fall back
    // to canned distractors if there aren't enough unique words.
    const distractorPool = keywords
      .filter((k, idx) => idx !== i && k.toLowerCase() !== correct.toLowerCase())
      .slice(0, 6);
    const distractors: string[] = [];
    for (const d of distractorPool) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(d)) distractors.push(d);
    }
    while (distractors.length < 3) {
      distractors.push(`Option ${String.fromCharCode(65 + distractors.length)}`);
    }
    // Place the correct answer at a deterministic but varying position.
    const correctIdx = (i + (text.length % 4)) % 4;
    const options: string[] = [];
    let dIdx = 0;
    for (let k = 0; k < 4; k++) {
      if (k === correctIdx) options.push(correct);
      else options.push(distractors[dIdx++]);
    }
    return {
      id: `q${i + 1}`,
      type: "multiple_choice" as const,
      question: `In the context of this lecture, what is highlighted by: "${truncate(
        anchor,
        140,
      )}"?`,
      options,
      correct_answer: correctIdx,
      points: 1,
      difficulty: (i % 3 === 0
        ? "easy"
        : i % 3 === 1
          ? "medium"
          : "hard") as "easy" | "medium" | "hard",
      concept_tag: correct.toLowerCase(),
      explanation: `The lecture passage centers on "${correct}".`,
    };
  });
  return questions;
}

/**
 * Build a study-plan NoteBlock array. The plan reads like a checklist
 * organized by week: a heading, a few todos, and a paragraph note. Block
 * IDs are generated client-side via a counter prefix so they're stable
 * across re-runs of the same input length (deterministic seed: text len).
 */
function stubStudyPlanBlocks(text: string): unknown[] {
  const paras = paragraphs(text);
  const moduleNames =
    paras.length > 0
      ? paras.slice(0, 4).map((p, i) => truncate(sentences(p)[0] ?? `Module ${i + 1}`, 80))
      : ["Module 1", "Module 2", "Module 3", "Module 4"];
  const seed = text.length;
  let counter = 0;
  const id = () => `sp-${seed}-${(counter++).toString(36)}`;
  const blocks: unknown[] = [];
  blocks.push({ id: id(), type: "heading", level: 1, text: "Study plan" });
  blocks.push({
    id: id(),
    type: "paragraph",
    text:
      "Auto-generated checklist. Reorder modules, edit todos, and check items off as you go. Re-run Generate to refresh after major content changes.",
  });
  moduleNames.forEach((name, i) => {
    blocks.push({ id: id(), type: "heading", level: 2, text: `Week ${i + 1}: ${name}` });
    blocks.push({ id: id(), type: "todo", text: `Read assigned material for ${name}`, checked: false });
    blocks.push({ id: id(), type: "todo", text: `Take notes and flag confusions`, checked: false });
    blocks.push({ id: id(), type: "todo", text: `Review flashcards for ${name}`, checked: false });
    blocks.push({ id: id(), type: "todo", text: `Take a practice quiz`, checked: false });
  });
  blocks.push({ id: id(), type: "divider" });
  blocks.push({ id: id(), type: "heading", level: 2, text: "Wrap-up" });
  blocks.push({ id: id(), type: "todo", text: "Self-assess: which module needs another pass?", checked: false });
  blocks.push({ id: id(), type: "todo", text: "Schedule a final cumulative review", checked: false });
  return blocks;
}

function extractKeyword(sentence: string): string {
  const words = sentence
    .replace(/[^\p{Letter}\p{Number}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  // Pick the longest word that isn't a generic stop-style filler.
  const stop = new Set([
    "the", "and", "with", "from", "that", "this", "their", "those", "these",
    "into", "about", "over", "under", "between", "while", "where", "which",
    "would", "could", "should", "there", "have", "been", "what", "when",
  ]);
  let best = "";
  for (const w of words) {
    const lw = w.toLowerCase();
    if (stop.has(lw)) continue;
    if (lw.length > best.length) best = w;
  }
  return best || words[0] || "concept";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

// ──────────────────────────────────────────────
// Real-API providers — server-hook routed
// ──────────────────────────────────────────────

interface ProviderHttpResponse {
  text?: string;
  json?: unknown;
  raw?: string;
}

/**
 * Build fetch headers that include the PB auth token so server-side
 * routerAdd hooks can read `e.requestInfo().auth` and authorize the
 * caller. Without this header the hook returns 401 and the provider
 * looks unavailable.
 */
import { pb } from "../pocketbase";

function pbAuthedHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const tok = pb.authStore?.token;
  if (tok) headers.Authorization = tok;
  return headers;
}

/**
 * Anthropic provider — POSTs to a server-side hook at /api/llm/anthropic
 * which forwards to the Messages API. The hook isn't deployed in this
 * branch (it'd require a PB restart we can't trigger from the agent), so
 * isAvailable() will get a 404 and resolveProvider falls through to the
 * next candidate.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly model: string;

  constructor(model = "claude-opus-4-7") {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // POST with no body — the server will 400 if the route exists,
      // 404/503 otherwise. We treat anything non-404/503 as "deployed".
      const res = await fetch("/api/llm/anthropic", { method: "POST" });
      return res.status !== 404 && res.status !== 503;
    } catch {
      return false;
    }
  }

  async complete(
    messages: LlmMessage[],
    opts?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const t0 = performance.now();
    const res = await fetch("/api/llm/anthropic", {
      method: "POST",
      headers: pbAuthedHeaders(),
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.4,
        json: opts?.json ?? false,
      }),
      signal: opts?.abortSignal,
    });
    if (!res.ok) throw new Error(`anthropic: HTTP ${res.status}`);
    const data = (await res.json()) as ProviderHttpResponse;
    return {
      text: data.text ?? "",
      json: opts?.json ? safeJsonParse(data.text ?? "") : undefined,
      latencyMs: performance.now() - t0,
    };
  }
}

/** OpenAI mirror of AnthropicProvider; same hook pattern at /api/llm/openai. */
export class OpenAIProvider implements LlmProvider {
  readonly id = "openai" as const;
  readonly model: string;

  constructor(model = "gpt-5") {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("/api/llm/openai", { method: "POST" });
      return res.status !== 404 && res.status !== 503;
    } catch {
      return false;
    }
  }

  async complete(
    messages: LlmMessage[],
    opts?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const t0 = performance.now();
    const res = await fetch("/api/llm/openai", {
      method: "POST",
      headers: pbAuthedHeaders(),
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.4,
        json: opts?.json ?? false,
      }),
      signal: opts?.abortSignal,
    });
    if (!res.ok) throw new Error(`openai: HTTP ${res.status}`);
    const data = (await res.json()) as ProviderHttpResponse;
    return {
      text: data.text ?? "",
      json: opts?.json ? safeJsonParse(data.text ?? "") : undefined,
      latencyMs: performance.now() - t0,
    };
  }
}

/**
 * Ollama provider — talks directly to a locally-running daemon at
 * http://localhost:11434/api/chat. No API key needed; the user just has
 * to be running `ollama serve` with a model pulled. We probe with a HEAD
 * to /api/tags which costs nothing if Ollama is up and 0-times-out fast
 * via the browser's normal connection-refused path if it isn't.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = "ollama" as const;
  readonly model: string;
  private readonly endpoint: string;

  constructor(opts?: { model?: string; endpoint?: string }) {
    this.model = opts?.model ?? "llama3.2";
    this.endpoint = opts?.endpoint ?? "http://localhost:11434";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(
    messages: LlmMessage[],
    opts?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const t0 = performance.now();
    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        format: opts?.json ? "json" : undefined,
        options: {
          temperature: opts?.temperature ?? 0.4,
          num_predict: opts?.maxTokens ?? 2048,
        },
      }),
      signal: opts?.abortSignal,
    });
    if (!res.ok) throw new Error(`ollama: HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content ?? "";
    return {
      text,
      json: opts?.json ? safeJsonParse(text) : undefined,
      latencyMs: performance.now() - t0,
    };
  }
}

/**
 * Pick a usable provider by walking preferred -> ollama -> stub. Each
 * candidate is asked once; the first that returns true from `isAvailable`
 * wins. The stub is the universal fallback because it has no external
 * dependencies, which means every Generate flow always has *something*
 * to talk to. Probes are cheap (single HTTP request, fast 404/refused).
 */
export async function resolveProvider(
  preferred: LlmProviderId = "anthropic",
): Promise<LlmProvider> {
  const seen = new Set<LlmProviderId>();
  const ordered: LlmProviderId[] = [];
  const push = (id: LlmProviderId) => {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  };
  push(preferred);
  push("ollama");
  push("stub");
  for (const id of ordered) {
    const p = providerFor(id);
    try {
      if (await p.isAvailable()) return p;
    } catch {
      // probe failed — try next candidate
    }
  }
  return new StubProvider();
}

function providerFor(id: LlmProviderId): LlmProvider {
  switch (id) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
      return new OpenAIProvider();
    case "ollama":
      return new OllamaProvider();
    case "stub":
    default:
      return new StubProvider();
  }
}

/**
 * Lenient JSON extractor. LLM JSON-mode replies are often pure JSON, but
 * we also handle the common "here's your JSON in a fenced block" case so
 * downstream code doesn't have to. Returns null on parse failure.
 */
export function safeJsonParse(text: string): unknown {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fenced block? Find the first `{` … last `}` and try again.
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    // Maybe an array literal.
    const fa = trimmed.indexOf("[");
    const la = trimmed.lastIndexOf("]");
    if (fa >= 0 && la > fa) {
      try {
        return JSON.parse(trimmed.slice(fa, la + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
