// Retrieval — BM25-ish keyword scoring over a user's knowledge_chunks.
//
// v1 is intentionally simple: pull the chunks for a user, score with
// IDF + length-normalized TF, return the top K. The provider abstraction
// is the seam we'll swap in when real embeddings or hybrid retrieval
// land.
//
// Graph extension: after scoring, we expand each top-K chunk by walking
// knowledge_edges out one hop (kind in {mentions, derived_from,
// same_source}) and merging the neighbours with a weight discount so
// they show up beneath the seed chunk in /knowledge results.

import { pb } from "../pocketbase";
import type {
  KnowledgeChunkRecord,
  KnowledgeEdgeRecord,
  KnowledgeSourceType,
} from "../types";

export interface Retrieved {
  chunk: KnowledgeChunkRecord;
  score: number;
  reason: "match" | "neighbour";
  via?: string; // chunk id this neighbour was reached from
}

export interface RetrieveOptions {
  topK?: number;
  sourceTypes?: KnowledgeSourceType[];
  expandGraph?: boolean;
  query?: string;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "a",
  "is",
  "in",
  "for",
  "on",
  "that",
  "this",
  "with",
  "as",
  "are",
  "was",
  "be",
  "by",
  "or",
  "an",
  "it",
  "at",
  "from",
  "but",
  "not",
  "so",
  "if",
  "what",
  "how",
  "do",
  "does",
  "did",
  "will",
  "can",
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "his",
  "her",
  "their",
  "have",
  "has",
  "had",
  "your",
  "my",
  "our",
]);

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Pull every chunk for a user, then score in-memory. Fine for v1 — a
 * single user's chunk count stays well under 10K for any realistic
 * study workload, and the JSON pull comes from PB's regular pagination
 * with a generous perPage. Replace with PB's full-text WHERE clause
 * (or a real vector index) when this gets too slow.
 */
export async function retrieve(
  userId: string,
  query: string,
  opts: RetrieveOptions = {},
): Promise<Retrieved[]> {
  const topK = opts.topK ?? 12;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const filterParts = [`user = "${userId}"`];
  if (opts.sourceTypes && opts.sourceTypes.length > 0) {
    filterParts.push(
      `(${opts.sourceTypes
        .map((t) => `source_type = "${t}"`)
        .join(" || ")})`,
    );
  }
  const filter = filterParts.join(" && ");

  // Pull all candidate chunks. PB caps perPage at 500.
  const candidates = await pb
    .collection("knowledge_chunks")
    .getFullList<KnowledgeChunkRecord>({
      filter,
      requestKey: `kc-fetch-${userId}-${query.slice(0, 16)}`,
    });

  if (candidates.length === 0) return [];

  // Build doc-frequency table on the fly.
  const df = new Map<string, number>();
  const docTerms: string[][] = candidates.map((c) =>
    tokenize(`${c.title ?? ""} ${c.text ?? ""}`),
  );
  for (const tokens of docTerms) {
    const uniq = new Set(tokens);
    uniq.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
  }
  const N = candidates.length;
  const avgLen =
    docTerms.reduce((s, d) => s + d.length, 0) / Math.max(1, N);

  // BM25-lite (k1=1.5, b=0.75)
  const k1 = 1.5;
  const b = 0.75;

  const scored = candidates
    .map((chunk, i) => {
      const tokens = docTerms[i];
      if (tokens.length === 0) return null;
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      for (const q of queryTerms) {
        const f = tf.get(q) ?? 0;
        if (f === 0) continue;
        const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
        const norm = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (tokens.length / avgLen)));
        score += idf * norm;
      }
      // Title boost — terms in the title are ~2x.
      const title = (chunk.title ?? "").toLowerCase();
      for (const q of queryTerms) if (title.includes(q)) score *= 1.15;
      return { chunk, score };
    })
    .filter((x): x is { chunk: KnowledgeChunkRecord; score: number } => !!x)
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const out: Retrieved[] = scored.map(({ chunk, score }) => ({
    chunk,
    score,
    reason: "match" as const,
  }));

  if (opts.expandGraph) {
    const seedIds = scored.map((s) => s.chunk.id);
    const neighbours = await graphExpand(userId, seedIds);
    // Discount neighbour chunks; keep only those not already in `out`.
    const seen = new Set(seedIds);
    for (const n of neighbours) {
      if (seen.has(n.chunk.id)) continue;
      out.push({ ...n, score: n.score * 0.4 });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Walk knowledge_edges from a seed set out exactly one hop. Returns
 * the neighbour chunks with a synthetic score derived from the edge
 * weight — the caller can rescale before merging.
 */
export async function graphExpand(
  userId: string,
  seedChunkIds: string[],
): Promise<Retrieved[]> {
  if (seedChunkIds.length === 0) return [];
  const filter =
    `user = "${userId}" && (` +
    seedChunkIds.map((id) => `from_chunk = "${id}"`).join(" || ") +
    `)`;
  const edges = await pb
    .collection("knowledge_edges")
    .getFullList<KnowledgeEdgeRecord>({
      filter,
      requestKey: `ke-walk-${seedChunkIds[0]}`,
    });
  if (edges.length === 0) return [];
  const targetIds = Array.from(new Set(edges.map((e) => e.to_chunk)));
  const targetFilter = targetIds.map((id) => `id = "${id}"`).join(" || ");
  const targets = await pb
    .collection("knowledge_chunks")
    .getFullList<KnowledgeChunkRecord>({
      filter: targetFilter,
      requestKey: `kc-targets-${seedChunkIds[0]}`,
    });
  const byId = new Map(targets.map((t) => [t.id, t]));
  const out: Retrieved[] = [];
  for (const e of edges) {
    const c = byId.get(e.to_chunk);
    if (!c) continue;
    out.push({
      chunk: c,
      score: e.weight ?? 0.5,
      reason: "neighbour",
      via: e.from_chunk,
    });
  }
  return out;
}

/**
 * Group retrievals by source_type — used by the /knowledge UI to
 * render results in clusters rather than a flat list.
 */
export function groupBySource(
  results: Retrieved[],
): Record<KnowledgeSourceType, Retrieved[]> {
  const out: Partial<Record<KnowledgeSourceType, Retrieved[]>> = {};
  for (const r of results) {
    const k = r.chunk.source_type as KnowledgeSourceType;
    if (!out[k]) out[k] = [];
    out[k]!.push(r);
  }
  return out as Record<KnowledgeSourceType, Retrieved[]>;
}
