// Persist the extracted+confirmed syllabus into PocketBase: course (if new),
// calendar_events for every dated item, and one flashcard set per topic.
//
// Runs in the browser using the user's PB session — no server-side hooks
// required. Each step is independent and a partial failure (e.g. one bad
// calendar row) doesn't abort the whole import.

import { pb } from "../pocketbase";
import type { Course, Flashcard } from "../types";
import type { ExtractedSyllabus } from "./extract";

export interface SyllabusImportPlan {
  /** Existing course id, or undefined if a new course should be created. */
  existingCourseId?: string;
  extracted: ExtractedSyllabus;
  userId: string;
}

export interface SyllabusImportResult {
  courseId: string;
  courseCreated: boolean;
  eventsCreated: number;
  flashcardsCreated: number;
  decksCreated: number;
}

const DEFAULT_COURSE_COLOR = "#2f5d4f";
const KIND_COLORS: Record<string, string> = {
  lecture: "#2f5d4f",
  assignment: "#c97b41",
  exam: "#a23b3b",
  reading: "#5b6b8a",
  other: "#6b6b6b",
};

export async function importSyllabus(
  plan: SyllabusImportPlan,
): Promise<SyllabusImportResult> {
  const { extracted, userId } = plan;
  let courseId = plan.existingCourseId ?? "";
  let courseCreated = false;

  if (!courseId) {
    const created = await pb.collection("courses").create<Course>({
      user: userId,
      name: extracted.course.name || "Untitled course",
      code: extracted.course.code || "",
      semester: extracted.course.semester || "",
      color: DEFAULT_COURSE_COLOR,
    });
    courseId = created.id;
    courseCreated = true;
  }

  const code = extracted.course.code || extracted.course.name;

  let eventsCreated = 0;
  for (const item of extracted.schedule) {
    try {
      await pb.collection("calendar_events").create({
        user: userId,
        title: prefixTitle(code, item.title),
        start_at: item.start,
        end_at: item.end,
        notes: `${item.kind} — imported from syllabus`,
        color: KIND_COLORS[item.kind] ?? KIND_COLORS.other,
        external_href: "",
      });
      eventsCreated++;
    } catch {
      // skip rows the server rejects
    }
  }

  let flashcardsCreated = 0;
  let decksCreated = 0;
  for (const topic of extracted.topics) {
    const cards = buildFlashcardsForTopic(topic);
    if (cards.length === 0) continue;
    const deckName = `${code ? `${code} — ` : ""}${topic.name}`;
    let any = false;
    for (const c of cards) {
      try {
        await pb.collection("flashcards").create<Flashcard>({
          user: userId,
          lecture: "",
          deck_name: deckName,
          front: c.front,
          back: c.back,
          front_image: "",
          back_image: "",
          tags: ["syllabus", code, topic.name].filter(Boolean),
          difficulty: "medium",
          source: "auto_generated",
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
        });
        flashcardsCreated++;
        any = true;
      } catch {
        // skip
      }
    }
    if (any) decksCreated++;
  }

  return {
    courseId,
    courseCreated,
    eventsCreated,
    flashcardsCreated,
    decksCreated,
  };
}

function prefixTitle(code: string, title: string): string {
  if (!code) return title;
  if (title.toLowerCase().startsWith(code.toLowerCase())) return title;
  return `${code} · ${title}`;
}

// Cheap deterministic flashcard generator from the topic summary + key terms.
// We don't make a second LLM call per topic — the syllabus pass already gave
// us enough signal, and a card-per-key-term plus a "what is the topic" front
// gets the user a usable starter deck without burning more tokens.
function buildFlashcardsForTopic(
  topic: ExtractedSyllabus["topics"][number],
): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = [];
  if (topic.summary) {
    cards.push({
      front: `Summarize: ${topic.name}`,
      back: topic.summary,
    });
  }
  for (const term of topic.key_terms) {
    cards.push({
      front: `Define "${term}" (in the context of ${topic.name}).`,
      back: `Review your notes for ${term}.`,
    });
  }
  return cards.slice(0, 8);
}
