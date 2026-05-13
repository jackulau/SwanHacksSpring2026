// Chunking — slice arbitrary text into ~300-500-token chunks with
// soft overlap. Used by the ingest helpers so that any source-of-
// truth content (notes, transcripts, etc.) can land in the
// knowledge_chunks table at a uniform granularity.
//
// We approximate token count with a simple word-piece estimate
// (words / 0.75) since we don't ship a tokenizer to the browser.
// The numbers don't have to be exact — they just have to be stable
// across re-ingests so the same source doesn't produce different
// chunk boundaries on each pass.

export interface ChunkConfig {
  targetTokens: number;
  overlapTokens: number;
  minTokens: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  targetTokens: 400,
  overlapTokens: 60,
  minTokens: 32,
};

export interface Chunk {
  text: string;
  tokens: number;
  index: number;
}

const WORD = /\S+/g;

export function approxTokens(text: string): number {
  if (!text) return 0;
  const words = text.match(WORD)?.length ?? 0;
  return Math.ceil(words / 0.75);
}

/**
 * Greedy paragraph-aware chunker. Walks paragraphs in order, packing
 * them into a buffer until the next addition would exceed the target.
 * Then emits the buffer and seeds the next chunk with the trailing
 * `overlapTokens` worth of words for continuity.
 */
export function chunkText(text: string, cfg = DEFAULT_CHUNK_CONFIG): Chunk[] {
  if (!text || !text.trim()) return [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let bufTokens = 0;

  const flush = () => {
    if (bufTokens >= cfg.minTokens) {
      const joined = buf.join("\n\n");
      chunks.push({ text: joined, tokens: bufTokens, index: chunks.length });
      // seed overlap from tail of buf
      const tailWords = joined.split(/\s+/).slice(-cfg.overlapTokens);
      buf = tailWords.length > 0 ? [tailWords.join(" ")] : [];
      bufTokens = approxTokens(buf.join(" "));
    } else {
      buf = [];
      bufTokens = 0;
    }
  };

  for (const para of paragraphs) {
    const t = approxTokens(para);
    if (bufTokens + t > cfg.targetTokens && bufTokens >= cfg.minTokens) flush();
    buf.push(para);
    bufTokens += t;
    // Hard cap: very long paragraph alone — split on sentences.
    if (bufTokens > cfg.targetTokens * 1.5) {
      const sentences = para.split(/(?<=[.!?])\s+/);
      buf.pop();
      bufTokens -= t;
      for (const s of sentences) {
        const st = approxTokens(s);
        if (bufTokens + st > cfg.targetTokens && bufTokens >= cfg.minTokens) flush();
        buf.push(s);
        bufTokens += st;
      }
    }
  }
  if (bufTokens >= cfg.minTokens) flush();
  // If we never emitted anything but text exists, emit the residue.
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      text: text.trim(),
      tokens: approxTokens(text),
      index: 0,
    });
  }
  return chunks;
}
