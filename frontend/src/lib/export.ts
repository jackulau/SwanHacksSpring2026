// Export — produce downloadable artifacts from PB content. Browser-only;
// uses a Blob + anchor click for downloads so we avoid pulling in a zip
// library (the deliverable is a single JSON for decks and a single
// bundled markdown for courses).

import { pb } from "./pocketbase";
import type {
  Course,
  Flashcard,
  Lecture,
  Note,
  NoteBlock,
  NotePage,
  Quiz,
  QuizQuestion,
  Transcript,
} from "./types";

export interface DeckExportPayload {
  deck_name: string;
  exported_at: string;
  format: "converge.deck.v1";
  cards: Array<{
    front: string;
    back: string;
    tags: string[];
    difficulty: string;
    next_review?: string;
    interval_days?: number;
    repetitions?: number;
  }>;
}

/**
 * Export a single named deck as JSON. The format is intentionally
 * anki-import-friendly (front/back/tags) while preserving the SM-2
 * state so a user can round-trip back to Converge later.
 */
export async function exportDeckJson(
  userId: string,
  deckName: string,
): Promise<DeckExportPayload> {
  const cards = await pb.collection("flashcards").getFullList<Flashcard>({
    filter: `user = "${userId}" && deck_name = "${deckName.replace(/"/g, '\\"')}"`,
    requestKey: `export-deck-${deckName}`,
  });
  return {
    deck_name: deckName,
    exported_at: new Date().toISOString(),
    format: "converge.deck.v1",
    cards: cards.map((c) => ({
      front: c.front,
      back: c.back,
      tags: c.tags ?? [],
      difficulty: c.difficulty,
      next_review: c.next_review,
      interval_days: c.interval_days,
      repetitions: c.repetitions,
    })),
  };
}

/**
 * Export an entire course as a single concatenated markdown document.
 * Sections: course header, lectures (transcripts), notes, quizzes,
 * flashcards. Each section is delimited by a level-1 heading so the
 * output reads as a study packet.
 */
export async function exportCourseMarkdown(
  userId: string,
  courseId: string,
): Promise<{ filename: string; content: string }> {
  const course = await pb.collection("courses").getOne<Course>(courseId);
  const safeBase = (course.code || course.name || "course")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const lectures = await pb.collection("lectures").getFullList<Lecture>({
    filter: `user = "${userId}" && course = "${courseId}"`,
    sort: "recorded_at",
  });

  const lines: string[] = [];
  lines.push(`# ${course.code ? `${course.code} — ` : ""}${course.name}`);
  lines.push("");
  if (course.semester) lines.push(`*Semester:* ${course.semester}`);
  lines.push(`*Exported:* ${new Date().toISOString()}`);
  lines.push("");

  // Lectures + transcripts
  if (lectures.length > 0) {
    lines.push("# Lectures");
    lines.push("");
    for (const lec of lectures) {
      lines.push(`## ${lec.title || "Untitled lecture"}`);
      if (lec.recorded_at)
        lines.push(`*Recorded:* ${new Date(lec.recorded_at).toLocaleString()}`);
      lines.push("");
      const tx = await pb
        .collection("transcripts")
        .getFirstListItem<Transcript>(`lecture = "${lec.id}"`)
        .catch(() => null);
      if (tx) {
        lines.push(tx.clean_text || tx.raw_text || "_no transcript_");
      } else {
        lines.push("_no transcript_");
      }
      lines.push("");

      // Auto-notes (from `notes` collection — distinct from note_pages)
      const note = await pb
        .collection("notes")
        .getFirstListItem<Note>(`lecture = "${lec.id}"`)
        .catch(() => null);
      if (note) {
        lines.push(`### Notes — ${note.title}`);
        for (const b of note.content as NoteBlock[]) {
          lines.push(blockToMarkdown(b));
        }
        lines.push("");
      }
    }
  }

  // Note pages (Notion-style standalone) tied to this course.
  const pages = await pb.collection("note_pages").getFullList<NotePage>({
    filter: `user = "${userId}" && course = "${courseId}" && archived = false`,
    sort: "-updated",
  });
  if (pages.length > 0) {
    lines.push("# Note pages");
    lines.push("");
    for (const p of pages) {
      lines.push(`## ${p.title || "Untitled"}`);
      for (const b of (p.blocks ?? []) as NoteBlock[]) {
        lines.push(blockToMarkdown(b));
      }
      lines.push("");
    }
  }

  // Quizzes
  const quizzes = await pb.collection("quizzes").getFullList<Quiz>({
    filter: `user = "${userId}" && lecture.course = "${courseId}"`,
  });
  if (quizzes.length > 0) {
    lines.push("# Quizzes");
    lines.push("");
    for (const q of quizzes) {
      lines.push(`## ${q.title}`);
      for (const question of q.questions as QuizQuestion[]) {
        lines.push(questionToMarkdown(question));
        lines.push("");
      }
    }
  }

  // Flashcards
  const cards = await pb.collection("flashcards").getFullList<Flashcard>({
    filter: `user = "${userId}" && lecture.course = "${courseId}"`,
  });
  if (cards.length > 0) {
    lines.push("# Flashcards");
    lines.push("");
    const byDeck = new Map<string, Flashcard[]>();
    for (const c of cards) {
      const k = c.deck_name || "Default";
      if (!byDeck.has(k)) byDeck.set(k, []);
      byDeck.get(k)!.push(c);
    }
    for (const [deck, cardList] of byDeck) {
      lines.push(`## ${deck}`);
      for (const c of cardList) {
        lines.push(`- **${c.front}** — ${c.back}`);
      }
      lines.push("");
    }
  }

  return {
    filename: `${safeBase}-bundle.md`,
    content: lines.join("\n").replace(/\n{3,}/g, "\n\n"),
  };
}

function blockToMarkdown(b: NoteBlock): string {
  switch (b.type) {
    case "paragraph":
      return b.text || "";
    case "heading":
      return `${"#".repeat(Math.min(6, b.level + 1))} ${b.text}`;
    case "bullet_item":
      return `- ${b.text}`;
    case "numbered_item":
      return `1. ${b.text}`;
    case "todo":
      return `- [${b.checked ? "x" : " "}] ${b.text}`;
    case "toggle":
    case "quote":
      return `> ${b.text}`;
    case "callout":
      return `> [!${b.variant.toUpperCase()}] ${b.text}`;
    case "code":
      return "```" + (b.language || "") + "\n" + b.code + "\n```";
    case "divider":
      return "---";
    case "image":
      return `![${b.alt ?? ""}](${b.url})`;
    case "key_term":
      return `**${b.term}** — ${b.definition}`;
    case "example":
      return `*Example:* ${b.text}`;
    case "math":
      return `$$ ${b.expression} $$`;
    case "embed":
      return `<${b.url}>`;
    case "page_ref":
      return `[[${b.title || "page"}]]`;
    case "table":
      if (!b.rows || b.rows.length === 0) return "";
      return b.rows.map((r) => "| " + r.join(" | ") + " |").join("\n");
    case "bullet_list":
      return b.items.map((i) => `- ${i}`).join("\n");
    default:
      return "";
  }
}

function questionToMarkdown(q: QuizQuestion): string {
  const lines: string[] = [];
  lines.push(`### ${q.question}`);
  if (q.type === "multiple_choice") {
    q.options.forEach((o, i) => {
      const marker = i === q.correct_answer ? "**" : "";
      lines.push(`- ${marker}${String.fromCharCode(65 + i)}. ${o}${marker}`);
    });
  } else if (q.type === "true_false") {
    lines.push(`Answer: ${q.correct_answer}`);
  } else {
    lines.push(`Answer: ${q.correct_answer}`);
  }
  if (q.explanation) lines.push(`*Explanation:* ${q.explanation}`);
  return lines.join("\n");
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
}

export function downloadText(filename: string, content: string): void {
  downloadBlob(
    filename,
    new Blob([content], { type: "text/markdown;charset=utf-8" }),
  );
}
