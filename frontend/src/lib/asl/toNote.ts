// ASL → Note page exporter. Bundles a session's transcribed segments
// into a brand-new note_pages row so the user can curate, edit, and
// share the content alongside their other notes.

import { pb } from "../pocketbase";
import type {
  AslSegmentRecord,
  NoteBlock,
  NotePage,
} from "../types";
import { ingestNote } from "../knowledge/ingest";

export interface AslSessionSummary {
  pageId: string;
  segmentCount: number;
}

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Persist the user's ASL segments for `sessionId` (or all of their
 * recent segments if no sessionId given) into a new NotePage with a
 * heading per row. Low-confidence rows are kept but rendered as
 * blockquotes so the user can spot them at a glance.
 */
export async function aslSessionToNotePage(
  userId: string,
  opts: { sessionId?: string; limit?: number; title?: string } = {},
): Promise<AslSessionSummary> {
  const limit = Math.min(200, opts.limit ?? 100);
  const filter = opts.sessionId
    ? `user = "${userId}" && session_id = "${opts.sessionId}"`
    : `user = "${userId}"`;
  const segs = await pb
    .collection("asl_segments")
    .getList<AslSegmentRecord>(1, limit, {
      filter,
      sort: "created",
      requestKey: `asl-to-note-${opts.sessionId ?? "all"}`,
    });

  const blocks: NoteBlock[] = [];
  blocks.push({ id: rid(), type: "heading", level: 1, text: "ASL session" });
  if (segs.totalItems === 0) {
    blocks.push({
      id: rid(),
      type: "paragraph",
      text: "No transcribed segments in this session yet.",
    });
  } else {
    blocks.push({
      id: rid(),
      type: "paragraph",
      text: `${segs.totalItems} segment${segs.totalItems === 1 ? "" : "s"} captured · exported ${new Date().toLocaleString()}`,
    });
    for (const s of segs.items) {
      const ts = new Date(s.created).toLocaleTimeString();
      const conf = Math.round((s.confidence ?? 0) * 100);
      const head = `${ts} · ${conf}% conf · ${s.provider}`;
      const text = s.transcription || "[unclear]";
      const lowConf = (s.confidence ?? 0) < 0.45 || text === "[unclear]";
      blocks.push({
        id: rid(),
        type: "paragraph",
        text: head,
      });
      if (lowConf) {
        blocks.push({
          id: rid(),
          type: "quote",
          text,
        });
      } else {
        blocks.push({
          id: rid(),
          type: "paragraph",
          text,
        });
      }
    }
  }

  const created = await pb.collection("note_pages").create<NotePage>({
    user: userId,
    title:
      opts.title ?? `ASL session — ${new Date().toLocaleDateString()}`,
    icon: "hand",
    parent: "",
    course: "",
    lecture: "",
    blocks,
    properties: { tags: ["asl", "auto-generated"] },
    archived: false,
  });

  // Best-effort knowledge ingest so the new page is searchable.
  void ingestNote(userId, created).catch(() => undefined);

  return { pageId: created.id, segmentCount: segs.totalItems };
}
