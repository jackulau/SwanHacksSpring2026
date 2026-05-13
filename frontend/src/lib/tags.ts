import { pb } from "./pocketbase";
import type { Flashcard, Lecture, NotePage, Quiz } from "./types";

// ──────────────────────────────────────────────
// Unified tag system
// ──────────────────────────────────────────────
//
// Tags live as plain string arrays on four surfaces:
//   - note_pages.properties.tags
//   - flashcards.tags
//   - lectures.tags
//   - quizzes.tags
//
// We deliberately do NOT introduce a `tags` collection — the existing
// columns are the source of truth, and aggregation happens client-side
// from the user's own records. Tag names are normalised on read (lower-
// case, trimmed) so casing variants ("Algebra" vs "algebra") collapse.

export type TaggedKind = "note" | "flashcard" | "lecture" | "quiz";

export interface TaggedItem {
  kind: TaggedKind;
  id: string;
  title: string;
  /** Subtitle / supporting context to render in lists. */
  subtitle?: string;
  /** TanStack Router target. Optional for items without a dedicated page. */
  href?: { to: string; params?: Record<string, string> };
  /** Tags, already normalised. */
  tags: string[];
  /** Original ISO timestamp for sorting (created/updated). */
  ts: number;
}

export interface TagBucket {
  tag: string;
  count: number;
  /** Per-kind counts so the index can show a small breakdown. */
  by_kind: Record<TaggedKind, number>;
}

export interface TagSearchResult {
  tag: string;
  groups: Record<TaggedKind, TaggedItem[]>;
  total: number;
}

/**
 * Normalise a single tag for storage and comparison. Trims whitespace,
 * collapses internal runs, and lowercases. Empty strings drop out.
 */
export function normaliseTag(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Best-effort coerce of a stored tags blob into a deduped string[]. */
function coerceTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const n = normaliseTag(v);
    if (n) out.add(n);
  }
  return Array.from(out);
}

interface FetchedSurfaces {
  notes: NotePage[];
  flashcards: Flashcard[];
  lectures: Lecture[];
  quizzes: Quiz[];
}

async function fetchAllSurfaces(userId: string): Promise<FetchedSurfaces> {
  const filter = `user = "${userId}"`;
  const [notes, flashcards, lectures, quizzes] = await Promise.all([
    pb
      .collection("note_pages")
      .getFullList<NotePage>({
        filter: `${filter} && archived = false`,
        sort: "-updated",
        requestKey: "tags-notes",
      })
      .catch(() => [] as NotePage[]),
    pb
      .collection("flashcards")
      .getFullList<Flashcard>({ filter, requestKey: "tags-flashcards" })
      .catch(() => [] as Flashcard[]),
    pb
      .collection("lectures")
      .getFullList<Lecture>({
        filter,
        sort: "-recorded_at",
        requestKey: "tags-lectures",
      })
      .catch(() => [] as Lecture[]),
    pb
      .collection("quizzes")
      .getFullList<Quiz>({ filter, requestKey: "tags-quizzes" })
      .catch(() => [] as Quiz[]),
  ]);
  return { notes, flashcards, lectures, quizzes };
}

function noteTags(p: NotePage): string[] {
  return coerceTags(p.properties?.tags);
}

function recordTs(r: object): number {
  const updated = (r as { updated?: unknown }).updated;
  const created = (r as { created?: unknown }).created;
  const t =
    typeof updated === "string"
      ? updated
      : typeof created === "string"
        ? created
        : null;
  return t ? new Date(t).getTime() : 0;
}

function toItems(surfaces: FetchedSurfaces): TaggedItem[] {
  const items: TaggedItem[] = [];
  for (const p of surfaces.notes) {
    const tags = noteTags(p);
    if (tags.length === 0) continue;
    items.push({
      kind: "note",
      id: p.id,
      title: p.title || "Untitled",
      subtitle: undefined,
      href: { to: "/notes/$pageId", params: { pageId: p.id } },
      tags,
      ts: recordTs(p),
    });
  }
  for (const f of surfaces.flashcards) {
    const tags = coerceTags(f.tags);
    if (tags.length === 0) continue;
    items.push({
      kind: "flashcard",
      id: f.id,
      title: f.front || "Untitled card",
      subtitle: f.deck_name || undefined,
      href: undefined,
      tags,
      ts: recordTs(f),
    });
  }
  for (const l of surfaces.lectures) {
    const tags = coerceTags(l.tags);
    if (tags.length === 0) continue;
    items.push({
      kind: "lecture",
      id: l.id,
      title: l.title || "Untitled lecture",
      subtitle: l.recorded_at
        ? new Date(l.recorded_at).toLocaleDateString()
        : undefined,
      href: { to: "/lectures/$lectureId", params: { lectureId: l.id } },
      tags,
      ts: recordTs(l),
    });
  }
  for (const q of surfaces.quizzes) {
    const tags = coerceTags(q.tags);
    if (tags.length === 0) continue;
    items.push({
      kind: "quiz",
      id: q.id,
      title: q.title || "Untitled quiz",
      subtitle: undefined,
      href: { to: "/study/quiz/$quizId", params: { quizId: q.id } },
      tags,
      ts: recordTs(q),
    });
  }
  return items;
}

/**
 * Collect every distinct tag this user has applied across notes,
 * flashcards, lectures, and quizzes. Results are sorted by count
 * descending, then alphabetically. Tag names are lowercased.
 */
export async function listAllTags(userId: string): Promise<TagBucket[]> {
  const surfaces = await fetchAllSurfaces(userId);
  const items = toItems(surfaces);
  const map = new Map<string, TagBucket>();
  for (const item of items) {
    for (const tag of item.tags) {
      let bucket = map.get(tag);
      if (!bucket) {
        bucket = {
          tag,
          count: 0,
          by_kind: { note: 0, flashcard: 0, lecture: 0, quiz: 0 },
        };
        map.set(tag, bucket);
      }
      bucket.count += 1;
      bucket.by_kind[item.kind] += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Return everything tagged with `tag` (case-insensitive), grouped by
 * source kind. Items are sorted within each group by recency (most
 * recently updated first).
 */
export async function searchByTag(
  userId: string,
  tag: string,
): Promise<TagSearchResult> {
  const needle = normaliseTag(tag);
  const surfaces = await fetchAllSurfaces(userId);
  const items = toItems(surfaces).filter((it) => it.tags.includes(needle));
  const groups: Record<TaggedKind, TaggedItem[]> = {
    note: [],
    flashcard: [],
    lecture: [],
    quiz: [],
  };
  for (const item of items) groups[item.kind].push(item);
  for (const k of Object.keys(groups) as TaggedKind[]) {
    groups[k].sort((a, b) => b.ts - a.ts);
  }
  return { tag: needle, groups, total: items.length };
}
