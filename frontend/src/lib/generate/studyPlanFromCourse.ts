// Flow: Course -> Study plan NotePage.
//
// Pulls the course's lectures (and optional assignment titles) into a
// single context payload, asks the LLM for a structured plan as a list
// of NoteBlocks, and writes a fresh `note_pages` row scoped to the course
// so it shows up under the course's Notes tab. The plan blocks are a mix
// of headings + todos + paragraphs — exactly what the existing PageEditor
// already renders without any extra surface work.
//
// Determinism: the Stub seeds off input length, so the same course always
// produces the same plan. Real providers may drift, which is fine — that's
// the whole point of running an LLM.

import { pb } from "../pocketbase";
import { resolveProvider, type LlmProvider, type LlmProviderId } from "../llm/providers";
import type { Assignment, Course, Lecture, NoteBlock, NotePage } from "../types";
import { ingestNote } from "../knowledge/ingest";

export interface StudyPlanFromCourseOptions {
  provider?: LlmProviderId;
  /** Override the new page's title (default: derived from course). */
  title?: string;
  /** Optional icon glyph for the page. */
  icon?: string;
  abortSignal?: AbortSignal;
}

export async function studyPlanFromCourse(
  courseId: string,
  opts: StudyPlanFromCourseOptions = {},
): Promise<NotePage> {
  const course = await pb.collection("courses").getOne<Course>(courseId);
  if (!course) throw new Error("Course not found");

  const lectures = await pb
    .collection("lectures")
    .getFullList<Lecture>({
      filter: `course = "${courseId}"`,
      sort: "recorded_at",
      requestKey: `study-plan-lectures-${courseId}`,
    })
    .catch(() => [] as Lecture[]);

  const assignments = await pb
    .collection("assignments")
    .getFullList<Assignment>({
      filter: `course = "${courseId}"`,
      sort: "due_at",
      requestKey: `study-plan-assignments-${courseId}`,
    })
    .catch(() => [] as Assignment[]);

  const text = buildCourseContext(course, lectures, assignments);
  const provider = await resolveProvider(opts.provider);
  let blocks = await runStudyPlanCompletion(provider, text, opts.abortSignal);

  // Belt and braces — if the model returned nothing usable, drop in a
  // minimal scaffold so the user still gets a page to edit.
  if (blocks.length === 0) {
    blocks = fallbackPlanBlocks(course, lectures);
  }

  const title = opts.title ?? `${course.code || course.name} study plan`;
  const written = await pb.collection("note_pages").create<NotePage>({
    user: course.user,
    title,
    icon: opts.icon ?? "list-checks",
    parent: "",
    course: course.id,
    lecture: "",
    blocks,
    properties: { tags: ["study-plan", "auto-generated"], status: "in_progress" },
    archived: false,
  });
  // Best-effort knowledge ingest so the new plan is searchable.
  void ingestNote(course.user, written).catch(() => undefined);
  return written;
}

/**
 * Run the chosen provider for a NoteBlock[] response. We instruct the model
 * on the exact block shape we need; the Stub matches the marker and returns
 * its deterministic plan. The validator below tolerates loose shapes (e.g.
 * a model might send a flat array vs. {blocks: [...]}).
 */
async function runStudyPlanCompletion(
  provider: LlmProvider,
  text: string,
  abortSignal?: AbortSignal,
): Promise<NoteBlock[]> {
  const system =
    "You are a study planner. Produce a study plan as a JSON object " +
    '{"blocks": NoteBlock[]} where each NoteBlock is one of: ' +
    '{"id": string, "type": "heading", "level": 1|2|3, "text": string}, ' +
    '{"id": string, "type": "paragraph", "text": string}, ' +
    '{"id": string, "type": "todo", "text": string, "checked": false}, ' +
    '{"id": string, "type": "divider"}. Cover modules drawn from the ' +
    "lectures, weekly checklists, and a final cumulative review. JSON only.";
  const completion = await provider.complete(
    [
      { role: "system", content: system },
      { role: "user", content: `__flow:study_plan\n${text}` },
    ],
    { json: true, temperature: 0.4, abortSignal, maxTokens: 3072 },
  );
  return shapeBlocks(completion.json ?? completion.text);
}

const ALLOWED_BLOCK_TYPES = new Set([
  "heading",
  "paragraph",
  "todo",
  "divider",
  "bullet_item",
  "numbered_item",
  "callout",
  "quote",
]);

function shapeBlocks(raw: unknown): NoteBlock[] {
  const parsed = (() => {
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
  if (!parsed) return [];
  const arr = Array.isArray(parsed)
    ? (parsed as unknown[])
    : Array.isArray((parsed as Record<string, unknown>).blocks)
      ? ((parsed as Record<string, unknown>).blocks as unknown[])
      : [];
  const out: NoteBlock[] = [];
  let idx = 0;
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = String(r.type ?? "");
    if (!ALLOWED_BLOCK_TYPES.has(type)) continue;
    const id = String(r.id ?? `b${idx++}`);
    const text = String(r.text ?? "").trim();
    switch (type) {
      case "heading": {
        const lvl = r.level === 2 || r.level === 3 ? r.level : 1;
        out.push({ id, type: "heading", level: lvl, text: text || "Section" });
        break;
      }
      case "paragraph":
        out.push({ id, type: "paragraph", text });
        break;
      case "todo":
        out.push({
          id,
          type: "todo",
          text: text || "TODO",
          checked: r.checked === true,
        });
        break;
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "bullet_item":
        out.push({ id, type: "bullet_item", text });
        break;
      case "numbered_item":
        out.push({ id, type: "numbered_item", text });
        break;
      case "callout":
        out.push({
          id,
          type: "callout",
          variant:
            r.variant === "important" || r.variant === "confusion" || r.variant === "tip"
              ? r.variant
              : "tip",
          text,
        });
        break;
      case "quote":
        out.push({ id, type: "quote", text });
        break;
    }
  }
  return out;
}

function buildCourseContext(
  course: Course,
  lectures: Lecture[],
  assignments: Assignment[],
): string {
  const lines: string[] = [];
  lines.push(`Course: ${course.code ? course.code + " — " : ""}${course.name}`);
  if (course.semester) lines.push(`Semester: ${course.semester}`);
  if (lectures.length > 0) {
    lines.push("", "Lectures:");
    for (const l of lectures) {
      const when = l.recorded_at
        ? new Date(l.recorded_at).toLocaleDateString()
        : "";
      lines.push(`- ${l.title}${when ? ` (${when})` : ""}`);
    }
  }
  if (assignments.length > 0) {
    lines.push("", "Assignments:");
    for (const a of assignments) {
      const due = a.due_at ? new Date(a.due_at).toLocaleDateString() : "";
      lines.push(`- ${a.title}${due ? ` (due ${due})` : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * Last-resort scaffold so the page is never empty. Intentionally short —
 * if we landed here, the model misbehaved and the user will edit anyway.
 */
function fallbackPlanBlocks(course: Course, lectures: Lecture[]): NoteBlock[] {
  let i = 0;
  const id = () => `fb-${i++}`;
  const blocks: NoteBlock[] = [
    { id: id(), type: "heading", level: 1, text: `${course.name} study plan` },
    {
      id: id(),
      type: "paragraph",
      text: "Auto-generated scaffold. Edit freely.",
    },
  ];
  if (lectures.length === 0) {
    blocks.push({
      id: id(),
      type: "todo",
      text: "Add a lecture to seed this plan",
      checked: false,
    });
    return blocks;
  }
  for (const l of lectures.slice(0, 6)) {
    blocks.push({ id: id(), type: "heading", level: 2, text: l.title });
    blocks.push({
      id: id(),
      type: "todo",
      text: `Review notes for ${l.title}`,
      checked: false,
    });
    blocks.push({
      id: id(),
      type: "todo",
      text: `Practice flashcards for ${l.title}`,
      checked: false,
    });
  }
  return blocks;
}
