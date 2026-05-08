// Note templates — reusable starter blocks for common page types.
//
// The /notes/$pageId surface already shows in-place "Empty page hints"
// templates; this lib factors them out and adds a few more so they can
// be picked from a global gallery (/templates) and from anywhere a
// "new from template" affordance lives.

import type { NoteBlock } from "./types";

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

export interface NoteTemplate {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name string — consumer maps to actual component. */
  icon: string;
  build(): NoteBlock[];
  initialTitle?: string;
  tags?: string[];
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    label: "Blank page",
    description: "Start with a single paragraph block.",
    icon: "FileText",
    build: () => [{ id: rid(), type: "paragraph", text: "" }],
  },
  {
    id: "lecture-summary",
    label: "Lecture summary",
    description: "Heading + key points + open questions skeleton.",
    icon: "GraduationCap",
    initialTitle: "Lecture summary",
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Lecture summary" },
      { id: rid(), type: "heading", level: 2, text: "Key points" },
      { id: rid(), type: "bullet_item", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Open questions" },
      { id: rid(), type: "bullet_item", text: "" },
    ],
  },
  {
    id: "reading-notes",
    label: "Reading notes",
    description: "Citation callout, highlights, takeaways.",
    icon: "BookOpen",
    initialTitle: "Reading notes",
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Reading notes" },
      { id: rid(), type: "callout", variant: "tip", text: "Citation:" },
      { id: rid(), type: "heading", level: 2, text: "Highlights" },
      { id: rid(), type: "quote", text: "" },
      { id: rid(), type: "heading", level: 2, text: "My takeaways" },
      { id: rid(), type: "paragraph", text: "" },
    ],
  },
  {
    id: "study-plan",
    label: "Study plan",
    description: "To-do list with deadlines and a review row.",
    icon: "ListChecks",
    initialTitle: "Study plan",
    tags: ["study-plan"],
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Study plan" },
      { id: rid(), type: "todo", text: "Review notes", checked: false },
      { id: rid(), type: "todo", text: "Build flashcards", checked: false },
      { id: rid(), type: "todo", text: "Take a practice quiz", checked: false },
    ],
  },
  {
    id: "weekly-review",
    label: "Weekly review",
    description: "What did I learn, struggle with, plan for next week.",
    icon: "CalendarCheck",
    initialTitle: "Weekly review",
    tags: ["review"],
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Weekly review" },
      { id: rid(), type: "heading", level: 2, text: "What I learned" },
      { id: rid(), type: "bullet_item", text: "" },
      { id: rid(), type: "heading", level: 2, text: "What I struggled with" },
      { id: rid(), type: "bullet_item", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Next week's focus" },
      { id: rid(), type: "todo", text: "", checked: false },
    ],
  },
  {
    id: "experiment-log",
    label: "Experiment log",
    description: "Hypothesis, method, results, follow-ups.",
    icon: "FlaskConical",
    initialTitle: "Experiment log",
    tags: ["experiment"],
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Experiment log" },
      { id: rid(), type: "heading", level: 2, text: "Hypothesis" },
      { id: rid(), type: "paragraph", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Method" },
      { id: rid(), type: "paragraph", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Results" },
      { id: rid(), type: "paragraph", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Follow-ups" },
      { id: rid(), type: "todo", text: "", checked: false },
    ],
  },
  {
    id: "concept-card",
    label: "Concept card",
    description: "Definition, example, why it matters.",
    icon: "BookmarkPlus",
    initialTitle: "Concept",
    tags: ["concept"],
    build: () => [
      { id: rid(), type: "heading", level: 1, text: "Concept" },
      {
        id: rid(),
        type: "key_term",
        term: "Term",
        definition: "Definition",
      },
      { id: rid(), type: "heading", level: 2, text: "Example" },
      { id: rid(), type: "example", text: "" },
      { id: rid(), type: "heading", level: 2, text: "Why it matters" },
      { id: rid(), type: "paragraph", text: "" },
    ],
  },
];

export function findTemplate(id: string): NoteTemplate | undefined {
  return NOTE_TEMPLATES.find((t) => t.id === id);
}
