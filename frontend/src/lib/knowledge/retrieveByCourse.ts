// Course-scoped retrieval — wraps `retrieve()` and narrows the result
// to chunks that belong to a specific course.
//
// Why a wrapper instead of a `course` filter on retrieve()? Because the
// "course" relationship lives in two different places depending on the
// source:
//
//   * notes, lectures, calendar events: ingest stamps `meta.course`
//     directly on each chunk, so we can match by JSON field.
//   * flashcards, quizzes, asl segments: there is no course on the
//     source record itself — they're attached to a lecture, and the
//     lecture is what carries the course. We resolve the course's
//     lecture ids first, then keep chunks whose `source_id` is one of
//     those lectures.
//
// The simplest correct approach is to retrieve broadly (per-user), then
// filter the BM25-scored results in memory. Chunk counts per user are
// tiny (<10K) so this is cheap, and it lets the IDF table stay built
// from the full corpus rather than a course-only sub-corpus, which
// would over-weight rare-but-irrelevant terms.

import { pb } from "../pocketbase";
import type { Flashcard, Lecture, KnowledgeSourceType } from "../types";
import { retrieve, type Retrieved, type RetrieveOptions } from "./retrieve";

const LECTURE_SCOPED_TYPES: ReadonlySet<KnowledgeSourceType> = new Set([
  "flashcard",
  "quiz_question",
  "asl_segment",
]);

const META_SCOPED_TYPES: ReadonlySet<KnowledgeSourceType> = new Set([
  "note",
  "lecture_transcript",
  "calendar_event",
]);

/**
 * Resolve all lecture ids that belong to a given course. Used to map
 * flashcard / quiz / asl_segment chunks (which only know their lecture)
 * back to the course.
 */
async function lectureIdsForCourse(courseId: string): Promise<Set<string>> {
  const lectures = await pb
    .collection("lectures")
    .getFullList<Lecture>({
      filter: `course = "${courseId}"`,
      fields: "id",
      requestKey: `kc-course-lectures-${courseId}`,
    })
    .catch(() => [] as Lecture[]);
  return new Set(lectures.map((l) => l.id));
}

/**
 * Run retrieval, then drop anything that isn't tied to `courseId`.
 *
 * - If a chunk's source type stamps the course in `meta.course`
 *   (notes, lecture transcripts, calendar events), match on that.
 * - If the source is lecture-scoped (flashcards, quizzes, ASL),
 *   keep the chunk only when its `source_id` is one of the course's
 *   lectures (or, for flashcards/quizzes whose source carries the
 *   lecture in meta, when `meta.lecture` matches).
 * - Anything else is dropped.
 */
export async function retrieveByCourse(
  userId: string,
  courseId: string,
  query: string,
  opts: RetrieveOptions = {},
): Promise<Retrieved[]> {
  if (!courseId || !query.trim()) return [];

  // Pull a generous topK from the underlying retriever, since we'll
  // throw away the off-course portion below.
  const innerTopK = (opts.topK ?? 20) * 4;
  const [hits, courseLectureIds] = await Promise.all([
    retrieve(userId, query, { ...opts, topK: innerTopK }),
    lectureIdsForCourse(courseId),
  ]);

  // Flashcards don't carry a lecture in chunk meta, so we resolve a
  // flashcard-id -> lecture-id map for any flashcard chunks present
  // in the hit set. Single batched fetch keeps this O(1) round trips.
  const flashcardIds = Array.from(
    new Set(
      hits
        .filter((r) => r.chunk.source_type === "flashcard")
        .map((r) => r.chunk.source_id),
    ),
  );
  const flashcardLectureById = new Map<string, string>();
  if (flashcardIds.length > 0) {
    const filter = flashcardIds.map((id) => `id = "${id}"`).join(" || ");
    const cards = await pb
      .collection("flashcards")
      .getFullList<Flashcard>({
        filter,
        fields: "id,lecture",
        requestKey: `kc-course-flashcards-${courseId}`,
      })
      .catch(() => [] as Flashcard[]);
    for (const c of cards) flashcardLectureById.set(c.id, c.lecture);
  }

  const filtered = hits.filter((r) => {
    const st = r.chunk.source_type as KnowledgeSourceType;
    if (META_SCOPED_TYPES.has(st)) {
      const metaCourse = (r.chunk.meta as { course?: unknown } | null)?.course;
      return typeof metaCourse === "string" && metaCourse === courseId;
    }
    if (LECTURE_SCOPED_TYPES.has(st)) {
      // Quizzes carry their lecture in meta.lecture. Flashcards don't,
      // so we use the flashcards lookup we just built. ASL segments
      // have neither, so they're effectively excluded from course
      // search until ingest stamps a lecture/course on them.
      if (st === "flashcard") {
        const lec = flashcardLectureById.get(r.chunk.source_id);
        return !!lec && courseLectureIds.has(lec);
      }
      const metaLecture = (r.chunk.meta as { lecture?: unknown } | null)
        ?.lecture;
      if (typeof metaLecture === "string" && courseLectureIds.has(metaLecture))
        return true;
      return courseLectureIds.has(r.chunk.source_id);
    }
    return false;
  });

  const topK = opts.topK ?? 20;
  return filtered.slice(0, topK);
}
