// Ingest — turn arbitrary source records into knowledge_chunks rows.
//
// Idempotent: the (source_type, source_id) pair acts as the unique
// "key" for a source's chunks. Re-running ingestion deletes the prior
// chunks and re-emits them, which is fine for v1 — the sources are
// few and rewrites are cheap. Real production would diff at the
// section level and update in place.

import { pb } from "../pocketbase";
import type {
  AslSegmentRecord,
  CalendarEventRecord,
  Flashcard,
  KnowledgeChunkRecord,
  KnowledgeEdgeKind,
  KnowledgeEdgeRecord,
  KnowledgeSourceType,
  Lecture,
  NotePage,
  Quiz,
  Transcript,
} from "../types";
import { chunkText, type Chunk } from "./chunk";

export interface IngestResult {
  chunks: number;
  edges: number;
}

interface BaseIngestArgs {
  userId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  text: string;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

async function clearExistingChunks(opts: {
  userId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
}): Promise<void> {
  const existing = await pb
    .collection("knowledge_chunks")
    .getFullList<KnowledgeChunkRecord>({
      filter: `user = "${opts.userId}" && source_type = "${opts.sourceType}" && source_id = "${opts.sourceId}"`,
      requestKey: `kc-existing-${opts.sourceType}-${opts.sourceId}`,
    });
  for (const c of existing) {
    await pb.collection("knowledge_chunks").delete(c.id).catch(() => undefined);
  }
}

/**
 * Generic "text-shaped source" ingest. Most callers funnel here after
 * flattening their source's structured content into a string.
 */
export async function ingestText(args: BaseIngestArgs): Promise<IngestResult> {
  await clearExistingChunks(args);
  const chunks = chunkText(args.text);
  if (chunks.length === 0) return { chunks: 0, edges: 0 };
  const created: KnowledgeChunkRecord[] = [];
  for (const ch of chunks) {
    try {
      const rec = await pb
        .collection("knowledge_chunks")
        .create<KnowledgeChunkRecord>({
          user: args.userId,
          source_type: args.sourceType,
          source_id: args.sourceId,
          section: `chunk-${ch.index}`,
          title: args.title,
          text: ch.text,
          tokens: ch.tokens,
          embedding: null,
          meta: args.meta ?? {},
          created_from_at: args.createdAt ?? new Date().toISOString(),
        });
      created.push(rec);
    } catch {
      // best-effort
    }
  }
  // same_source edges between adjacent chunks so the graph walk has
  // something to traverse on day 1.
  let edges = 0;
  for (let i = 0; i < created.length - 1; i++) {
    edges += await addEdge({
      userId: args.userId,
      from: created[i].id,
      to: created[i + 1].id,
      kind: "same_source",
      weight: 0.7,
    });
  }
  return { chunks: created.length, edges };
}

async function addEdge(opts: {
  userId: string;
  from: string;
  to: string;
  kind: KnowledgeEdgeKind;
  weight: number;
}): Promise<number> {
  try {
    await pb
      .collection("knowledge_edges")
      .create<KnowledgeEdgeRecord>({
        user: opts.userId,
        from_chunk: opts.from,
        to_chunk: opts.to,
        kind: opts.kind,
        weight: opts.weight,
      });
    return 1;
  } catch {
    return 0;
  }
}

/* ─────────── Source-specific ingest helpers ─────────── */

export async function ingestNote(
  userId: string,
  page: NotePage,
): Promise<IngestResult> {
  const lines: string[] = [];
  if (page.title) lines.push(`# ${page.title}`);
  for (const b of page.blocks ?? []) {
    const t = (b as { text?: string; code?: string; expression?: string }).text
      ?? (b as { code?: string }).code
      ?? (b as { expression?: string }).expression
      ?? "";
    if (t) lines.push(t);
  }
  return await ingestText({
    userId,
    sourceType: "note",
    sourceId: page.id,
    title: page.title || "Untitled note",
    text: lines.join("\n\n"),
    createdAt: page.created,
    meta: {
      icon: page.icon,
      course: page.course,
      tags: page.properties?.tags ?? [],
    },
  });
}

export async function ingestLecture(
  userId: string,
  lecture: Lecture,
  transcript: Transcript | null,
): Promise<IngestResult> {
  const text = transcript?.clean_text || transcript?.raw_text || "";
  if (!text) return { chunks: 0, edges: 0 };
  return await ingestText({
    userId,
    sourceType: "lecture_transcript",
    sourceId: lecture.id,
    title: lecture.title || "Lecture",
    text,
    createdAt: lecture.created,
    meta: {
      course: lecture.course,
      duration_secs: lecture.duration_secs,
    },
  });
}

export async function ingestFlashcard(
  userId: string,
  card: Flashcard,
): Promise<IngestResult> {
  return await ingestText({
    userId,
    sourceType: "flashcard",
    sourceId: card.id,
    title: card.front || "Flashcard",
    text: `${card.front}\n\n${card.back}`,
    createdAt: card.created,
    meta: { deck: card.deck_name, tags: card.tags ?? [] },
  });
}

export async function ingestQuiz(
  userId: string,
  quiz: Quiz,
): Promise<IngestResult> {
  const lines: string[] = [];
  for (const q of quiz.questions ?? []) {
    lines.push(q.question);
    if (q.type === "multiple_choice") {
      lines.push(q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n"));
      lines.push(`Answer: ${String.fromCharCode(65 + q.correct_answer)}`);
    } else if (q.type === "true_false") {
      lines.push(`Answer: ${q.correct_answer}`);
    } else {
      lines.push(`Answer: ${q.correct_answer}`);
    }
    if (q.explanation) lines.push(q.explanation);
  }
  return await ingestText({
    userId,
    sourceType: "quiz_question",
    sourceId: quiz.id,
    title: quiz.title || "Quiz",
    text: lines.join("\n\n"),
    createdAt: quiz.created,
    meta: { lecture: quiz.lecture },
  });
}

export async function ingestCalendarEvent(
  userId: string,
  ev: CalendarEventRecord,
): Promise<IngestResult> {
  const text = `${ev.title}\n\n${ev.notes ?? ""}`;
  return await ingestText({
    userId,
    sourceType: "calendar_event",
    sourceId: ev.id,
    title: ev.title || "Event",
    text,
    createdAt: ev.start_at || ev.created,
    meta: { start_at: ev.start_at, end_at: ev.end_at },
  });
}

export async function ingestAslSegment(
  userId: string,
  seg: AslSegmentRecord,
): Promise<IngestResult> {
  if (!seg.transcription || seg.transcription === "[unclear]")
    return { chunks: 0, edges: 0 };
  return await ingestText({
    userId,
    sourceType: "asl_segment",
    sourceId: seg.id,
    title: seg.transcription,
    text: seg.transcription,
    createdAt: seg.created,
    meta: { confidence: seg.confidence, provider: seg.provider },
  });
}

/**
 * Backfill — walk every supported source for the user and ingest.
 * Idempotent (delegates to ingestText which clears prior chunks),
 * so safe to re-run after schema or chunker changes.
 */
export async function backfillUserKnowledge(
  userId: string,
  onProgress?: (msg: string) => void,
): Promise<{
  total: IngestResult;
  perSource: Partial<Record<KnowledgeSourceType, IngestResult>>;
}> {
  const total: IngestResult = { chunks: 0, edges: 0 };
  const perSource: Partial<Record<KnowledgeSourceType, IngestResult>> = {};

  const tally = (st: KnowledgeSourceType, r: IngestResult) => {
    total.chunks += r.chunks;
    total.edges += r.edges;
    const cur = perSource[st] ?? { chunks: 0, edges: 0 };
    perSource[st] = { chunks: cur.chunks + r.chunks, edges: cur.edges + r.edges };
  };

  onProgress?.("Notes…");
  const pages = await pb
    .collection("note_pages")
    .getFullList<NotePage>({
      filter: `user = "${userId}" && archived = false`,
      requestKey: "bf-notes",
    })
    .catch(() => [] as NotePage[]);
  for (const p of pages) tally("note", await ingestNote(userId, p));

  onProgress?.("Lectures…");
  const lectures = await pb
    .collection("lectures")
    .getFullList<Lecture>({
      filter: `user = "${userId}"`,
      requestKey: "bf-lectures",
    })
    .catch(() => [] as Lecture[]);
  for (const lec of lectures) {
    const transcript = await pb
      .collection("transcripts")
      .getFirstListItem<Transcript>(`lecture = "${lec.id}"`, {
        requestKey: `bf-transcript-${lec.id}`,
      })
      .catch(() => null);
    tally("lecture_transcript", await ingestLecture(userId, lec, transcript));
  }

  onProgress?.("Flashcards…");
  const cards = await pb
    .collection("flashcards")
    .getFullList<Flashcard>({
      filter: `user = "${userId}"`,
      requestKey: "bf-flashcards",
    })
    .catch(() => [] as Flashcard[]);
  for (const c of cards) tally("flashcard", await ingestFlashcard(userId, c));

  onProgress?.("Quizzes…");
  const quizzes = await pb
    .collection("quizzes")
    .getFullList<Quiz>({
      filter: `user = "${userId}"`,
      requestKey: "bf-quizzes",
    })
    .catch(() => [] as Quiz[]);
  for (const q of quizzes) tally("quiz_question", await ingestQuiz(userId, q));

  onProgress?.("Calendar…");
  const events = await pb
    .collection("calendar_events")
    .getFullList<CalendarEventRecord>({
      filter: `user = "${userId}"`,
      requestKey: "bf-calendar",
    })
    .catch(() => [] as CalendarEventRecord[]);
  for (const ev of events) tally("calendar_event", await ingestCalendarEvent(userId, ev));

  onProgress?.("ASL transcripts…");
  const segs = await pb
    .collection("asl_segments")
    .getFullList<AslSegmentRecord>({
      filter: `user = "${userId}"`,
      requestKey: "bf-asl",
    })
    .catch(() => [] as AslSegmentRecord[]);
  for (const s of segs) tally("asl_segment", await ingestAslSegment(userId, s));

  return { total, perSource };
}
