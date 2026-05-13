// LLM call that converts raw syllabus text into a structured course payload.
// Routes through the same provider stack as every other Generate flow, so it
// works against Anthropic/OpenAI/Google/Ollama if configured and falls back
// to the deterministic Stub on a fresh checkout.

import { resolveProvider, safeJsonParse } from "../llm/providers";
import type { LlmMessage } from "../llm/providers";

export interface SyllabusScheduleItem {
  /** Short label, e.g. "Lecture 3: Working memory" or "Midterm". */
  title: string;
  /** ISO datetime; the LLM is asked to emit yyyy-mm-ddThh:mm in local time. */
  start: string;
  /** ISO datetime; defaults to start + 1h when the syllabus omits a duration. */
  end: string;
  /** Lightweight category — used to color the calendar entry. */
  kind: "lecture" | "assignment" | "exam" | "reading" | "other";
}

export interface SyllabusTopic {
  /** Module / unit name, e.g. "Encoding & retrieval". */
  name: string;
  /** 1-2 sentence summary the LLM derives from the syllabus body. */
  summary: string;
  /** 4-8 key terms; we use these to seed flashcards. */
  key_terms: string[];
}

export interface ExtractedSyllabus {
  course: {
    name: string;
    /** Short code like "COGS 200"; "" when the syllabus doesn't list one. */
    code: string;
    /** Free text like "Spring 2026"; "" when not present. */
    semester: string;
  };
  schedule: SyllabusScheduleItem[];
  topics: SyllabusTopic[];
}

const SYSTEM = `You extract course metadata from a class syllabus. Reply with a single JSON object and nothing else. Schema:
{
  "course": { "name": string, "code": string, "semester": string },
  "schedule": [ { "title": string, "start": "YYYY-MM-DDTHH:MM", "end": "YYYY-MM-DDTHH:MM", "kind": "lecture"|"assignment"|"exam"|"reading"|"other" } ],
  "topics":   [ { "name": string, "summary": string, "key_terms": string[] } ]
}
Rules:
- If the syllabus lists weekly meetings (e.g. "MWF 10:00-10:50"), expand them into per-occurrence schedule items across the listed semester window. Cap at 60 items.
- If only a date is given (no time), use 09:00-10:00 local.
- topics: 4-10 modules drawn from the schedule / topic outline. key_terms: 4-8 noun phrases per topic.
- Omit fields you can't infer; never invent dates.`;

export async function extractSyllabus(
  rawText: string,
): Promise<ExtractedSyllabus> {
  const provider = await resolveProvider("anthropic");
  // Trim — most syllabi fit easily; cap to keep the prompt reasonable.
  const text = rawText.length > 18000 ? rawText.slice(0, 18000) : rawText;
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `__flow:syllabus\nSyllabus text follows.\n---\n${text}\n---`,
    },
  ];
  const reply = await provider.complete(messages, {
    json: true,
    temperature: 0.2,
    maxTokens: 4096,
  });
  const parsed =
    (reply.json as ExtractedSyllabus | null) ??
    (safeJsonParse(reply.text) as ExtractedSyllabus | null);
  return normalize(parsed, rawText);
}

// Coerce whatever the provider returned into a safe ExtractedSyllabus.
// The Stub provider doesn't recognize __flow:syllabus, so we always have to
// be defensive: missing arrays default to empty, missing course defaults
// to a derived name, dates that won't parse get dropped silently.
function normalize(
  raw: ExtractedSyllabus | null,
  fallbackText: string,
): ExtractedSyllabus {
  const course = raw?.course ?? { name: "", code: "", semester: "" };
  const schedule = Array.isArray(raw?.schedule) ? raw!.schedule : [];
  const topics = Array.isArray(raw?.topics) ? raw!.topics : [];

  const cleanSchedule: SyllabusScheduleItem[] = [];
  for (const s of schedule) {
    if (!s || typeof s !== "object") continue;
    const startIso = toIso(s.start);
    const endIso = toIso(s.end) ?? plusOneHour(startIso);
    if (!startIso || !endIso) continue;
    cleanSchedule.push({
      title: String(s.title ?? "Untitled").slice(0, 200),
      start: startIso,
      end: endIso,
      kind:
        s.kind === "lecture" ||
        s.kind === "assignment" ||
        s.kind === "exam" ||
        s.kind === "reading"
          ? s.kind
          : "other",
    });
  }
  cleanSchedule.sort((a, b) => a.start.localeCompare(b.start));

  const cleanTopics: SyllabusTopic[] = topics
    .filter((t): t is SyllabusTopic => !!t && typeof t === "object")
    .slice(0, 12)
    .map((t) => ({
      name: String(t.name ?? "").slice(0, 120) || "Untitled module",
      summary: String(t.summary ?? "").slice(0, 600),
      key_terms: Array.isArray(t.key_terms)
        ? t.key_terms.map((k) => String(k)).filter(Boolean).slice(0, 12)
        : [],
    }));

  return {
    course: {
      name:
        String(course.name ?? "").trim() ||
        deriveCourseNameFromText(fallbackText),
      code: String(course.code ?? "").trim(),
      semester: String(course.semester ?? "").trim(),
    },
    schedule: cleanSchedule.slice(0, 80),
    topics: cleanTopics,
  };
}

function toIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  // Accept "YYYY-MM-DD", "YYYY-MM-DDTHH:MM", or full ISO; reject garbage.
  const s = v.trim();
  // Bare date → 09:00 local.
  const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const candidate = bareDate ? `${s}T09:00` : s;
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function plusOneHour(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function deriveCourseNameFromText(text: string): string {
  // Best-effort fallback: first non-empty line, trimmed to a reasonable length.
  const first = text
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.length > 4);
  return (first ?? "Untitled course").slice(0, 80);
}
