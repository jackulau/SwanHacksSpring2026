// Weekly digest generator.
//
// Pulls the last 7 days of activity across the user's notes, lectures,
// quizzes, ASL segments, completed calendar events, and completed
// assignments, hands the LLM a compact prompt, and asks it to return a
// short structured digest with study recommendations. With no real LLM
// hooked up the resolver falls through to the StubProvider; when that
// happens we skip the prompt round-trip entirely and synthesize a digest
// from the raw counts so the page is still useful on a fresh checkout.
//
// The DailySummary shape is a flat headline + grouped sections. It maps
// naturally into NoteBlocks (one heading per section, one bullet per
// item) which is what the "Save as note page" button on /digest does.

import { pb } from "./pocketbase";
import { resolveProvider, safeJsonParse } from "./llm/providers";
import type {
  Assignment,
  AslSegmentRecord,
  CalendarEventRecord,
  Lecture,
  NotePage,
  QuizAttempt,
} from "./types";

export interface DailySummary {
  headline: string;
  sections: { title: string; bullets: string[] }[];
}

interface ActivityBuckets {
  notes: NotePage[];
  lectures: Lecture[];
  attempts: QuizAttempt[];
  asl: AslSegmentRecord[];
  events: CalendarEventRecord[];
  assignments: Assignment[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_CHAR_BUDGET = 3000;

/**
 * Build a weekly digest for `userId`. Pulls the activity rows from PB,
 * composes a prompt, and asks the LLM provider for a JSON-shaped reply.
 * If the provider is the stub (no real LLM) or the parse fails, falls
 * back to a deterministic structured rendering of the raw counts.
 */
export async function generateDigest(userId: string): Promise<DailySummary> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const buckets = await pullActivity(userId, since);
  const provider = await resolveProvider("anthropic");

  // Stub means there's no real LLM behind the curtain — skip the round
  // trip and just render the counts. The Stub's `none`-branch reply is a
  // generic echo we can't usefully turn into a digest.
  if (provider.id === "stub") {
    return fallbackDigest(buckets);
  }

  try {
    const prompt = composePrompt(buckets);
    const completion = await provider.complete(
      [
        {
          role: "system",
          content:
            "You are a study coach. Read the user's last-7-days activity " +
            "and produce a short weekly digest as JSON: " +
            '{"headline": string, "sections": [{"title": string, ' +
            '"bullets": [string]}]}. Pick 2-4 sections (e.g. ' +
            '"Highlights", "Where you struggled", "Recommendations"). ' +
            "Bullets must be terse (<= 140 chars), concrete, and " +
            "actionable. JSON only — no markdown, no commentary.",
        },
        { role: "user", content: prompt },
      ],
      { json: true, temperature: 0.5, maxTokens: 1024 },
    );
    const parsed = parseDigest(completion.json ?? completion.text);
    if (parsed) return parsed;
  } catch {
    // Provider errored mid-flight — fall through to the deterministic
    // fallback so the page still renders something useful.
  }
  return fallbackDigest(buckets);
}

// ──────────────────────────────────────────────
// Activity pulls
// ──────────────────────────────────────────────

async function pullActivity(
  userId: string,
  sinceIso: string,
): Promise<ActivityBuckets> {
  // Each pull is wrapped in `.catch(() => …)` so a single missing or
  // misconfigured collection (e.g. canvas not connected, ASL never used)
  // doesn't take the whole digest down.
  const [notes, lectures, attempts, asl, events, assignments] =
    await Promise.all([
      pb
        .collection("note_pages")
        .getList<NotePage>(1, 30, {
          filter: `user = "${userId}" && archived = false && updated >= "${sinceIso}"`,
          sort: "-updated",
          requestKey: "digest-notes",
        })
        .then((r) => r.items)
        .catch(() => [] as NotePage[]),
      pb
        .collection("lectures")
        .getList<Lecture>(1, 30, {
          filter: `user = "${userId}" && updated >= "${sinceIso}"`,
          sort: "-updated",
          requestKey: "digest-lectures",
        })
        .then((r) => r.items)
        .catch(() => [] as Lecture[]),
      pb
        .collection("quiz_attempts")
        .getList<QuizAttempt>(1, 30, {
          filter: `user = "${userId}" && completed_at >= "${sinceIso}"`,
          sort: "-completed_at",
          requestKey: "digest-attempts",
        })
        .then((r) => r.items)
        .catch(() => [] as QuizAttempt[]),
      pb
        .collection("asl_segments")
        .getList<AslSegmentRecord>(1, 30, {
          filter: `user = "${userId}" && created >= "${sinceIso}"`,
          sort: "-created",
          requestKey: "digest-asl",
        })
        .then((r) => r.items)
        .catch(() => [] as AslSegmentRecord[]),
      pb
        .collection("calendar_events")
        .getList<CalendarEventRecord>(1, 30, {
          filter: `user = "${userId}" && end_at >= "${sinceIso}" && end_at <= "${new Date().toISOString()}"`,
          sort: "-end_at",
          requestKey: "digest-cal",
        })
        .then((r) => r.items)
        .catch(() => [] as CalendarEventRecord[]),
      pb
        .collection("assignments")
        .getList<Assignment>(1, 30, {
          filter: `user = "${userId}" && (status = "submitted" || status = "graded") && updated >= "${sinceIso}"`,
          sort: "-updated",
          requestKey: "digest-asg",
        })
        .then((r) => r.items)
        .catch(() => [] as Assignment[]),
    ]);
  return { notes, lectures, attempts, asl, events, assignments };
}

// ──────────────────────────────────────────────
// Prompt composition
// ──────────────────────────────────────────────

function composePrompt(b: ActivityBuckets): string {
  const lines: string[] = [];
  lines.push(
    `User activity, last 7 days. Counts: notes=${b.notes.length}, ` +
      `lectures=${b.lectures.length}, quiz_attempts=${b.attempts.length}, ` +
      `asl_segments=${b.asl.length}, completed_events=${b.events.length}, ` +
      `completed_assignments=${b.assignments.length}.`,
  );
  if (b.notes.length) {
    lines.push("\nNotes updated:");
    for (const n of b.notes.slice(0, 8)) {
      lines.push(`- ${truncate(n.title || "Untitled", 80)}`);
    }
  }
  if (b.lectures.length) {
    lines.push("\nLectures touched:");
    for (const l of b.lectures.slice(0, 8)) {
      lines.push(
        `- ${truncate(l.title || "Untitled lecture", 80)} [${l.status}]`,
      );
    }
  }
  if (b.attempts.length) {
    const avg =
      b.attempts.reduce((s, a) => s + (a.percentage ?? 0), 0) /
      b.attempts.length;
    lines.push(`\nQuiz attempts (avg ${Math.round(avg)}%):`);
    for (const a of b.attempts.slice(0, 8)) {
      lines.push(`- ${a.score}/${a.max_score} (${a.percentage}%)`);
    }
  }
  if (b.asl.length) {
    lines.push("\nASL segments:");
    for (const s of b.asl.slice(0, 6)) {
      lines.push(
        `- "${truncate(s.transcription || "[unclear]", 60)}" ` +
          `${Math.round((s.confidence ?? 0) * 100)}% conf`,
      );
    }
  }
  if (b.assignments.length) {
    lines.push("\nAssignments completed:");
    for (const a of b.assignments.slice(0, 6)) {
      lines.push(`- ${truncate(a.title || "Untitled", 80)} (${a.status})`);
    }
  }
  if (b.events.length) {
    lines.push("\nCalendar events finished:");
    for (const e of b.events.slice(0, 6)) {
      lines.push(`- ${truncate(e.title || "Untitled", 80)}`);
    }
  }
  let text = lines.join("\n");
  if (text.length > PROMPT_CHAR_BUDGET) {
    text = text.slice(0, PROMPT_CHAR_BUDGET - 1) + "…";
  }
  return text;
}

// ──────────────────────────────────────────────
// Parsing + fallback
// ──────────────────────────────────────────────

function parseDigest(raw: unknown): DailySummary | null {
  const candidate = (() => {
    if (!raw) return null;
    if (typeof raw === "string") return safeJsonParse(raw);
    return raw;
  })();
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  const headline = String(obj.headline ?? obj.title ?? "").trim();
  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const sections: DailySummary["sections"] = [];
  for (const s of rawSections) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const title = String(sec.title ?? sec.heading ?? "").trim();
    const bulletsRaw = Array.isArray(sec.bullets)
      ? sec.bullets
      : Array.isArray(sec.items)
        ? sec.items
        : [];
    const bullets = bulletsRaw
      .map((b) => String(b ?? "").trim())
      .filter((b) => b.length > 0);
    if (title && bullets.length) sections.push({ title, bullets });
  }
  if (!headline || !sections.length) return null;
  return { headline, sections };
}

function fallbackDigest(b: ActivityBuckets): DailySummary {
  const total =
    b.notes.length +
    b.lectures.length +
    b.attempts.length +
    b.asl.length +
    b.events.length +
    b.assignments.length;

  const headline =
    total === 0
      ? "Quiet week — nothing logged in the last 7 days."
      : `Last 7 days: ${total} activity ${total === 1 ? "row" : "rows"} across your study tools.`;

  const sections: DailySummary["sections"] = [];

  const highlights: string[] = [];
  if (b.notes.length)
    highlights.push(
      `Updated ${b.notes.length} note ${b.notes.length === 1 ? "page" : "pages"} (latest: ${truncate(b.notes[0].title || "Untitled", 60)}).`,
    );
  if (b.lectures.length)
    highlights.push(
      `Worked on ${b.lectures.length} ${b.lectures.length === 1 ? "lecture" : "lectures"} (latest: ${truncate(b.lectures[0].title || "Untitled lecture", 60)}).`,
    );
  if (b.attempts.length) {
    const avg =
      b.attempts.reduce((s, a) => s + (a.percentage ?? 0), 0) /
      b.attempts.length;
    highlights.push(
      `Took ${b.attempts.length} quiz ${b.attempts.length === 1 ? "attempt" : "attempts"} (avg ${Math.round(avg)}%).`,
    );
  }
  if (b.asl.length)
    highlights.push(
      `Captured ${b.asl.length} ASL ${b.asl.length === 1 ? "segment" : "segments"}.`,
    );
  if (b.assignments.length)
    highlights.push(
      `Closed out ${b.assignments.length} ${b.assignments.length === 1 ? "assignment" : "assignments"}.`,
    );
  if (b.events.length)
    highlights.push(
      `Completed ${b.events.length} calendar ${b.events.length === 1 ? "event" : "events"}.`,
    );
  if (highlights.length === 0)
    highlights.push("No activity recorded in any tracked collection.");
  sections.push({ title: "Highlights", bullets: highlights });

  const recs: string[] = [];
  if (b.attempts.length) {
    const weakest = [...b.attempts].sort(
      (x, y) => (x.percentage ?? 0) - (y.percentage ?? 0),
    )[0];
    if (weakest && weakest.percentage < 80) {
      recs.push(
        `Revisit the quiz where you scored ${weakest.percentage}% — try a re-take or refresh flashcards.`,
      );
    }
  }
  if (b.notes.length === 0)
    recs.push("Open a note page or capture a quick thought to keep momentum.");
  if (b.lectures.length === 0)
    recs.push("Record or upload a lecture if you have one queued.");
  if (b.asl.length > 0 && b.notes.length === 0)
    recs.push("Promote your ASL segments into a note page for review.");
  if (recs.length === 0)
    recs.push("Keep the streak going — schedule one more study block this week.");
  sections.push({ title: "Recommendations", bullets: recs });

  return { headline, sections };
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
