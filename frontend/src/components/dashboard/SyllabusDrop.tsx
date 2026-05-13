// Bottom-of-dashboard syllabus uploader.
//
// Visual: a single dashed-border block (not a card, not a pill) that fills
// the dashboard column. Drag-and-drop or click to choose a PDF/DOCX. Flow:
//   parse  →  LLM-extract  →  match against existing courses  →  confirm
//   →  write course (if new) + calendar_events + flashcards.
//
// The match confirmation is a small inline modal, not an alert(); the user
// always has final say even on a strong match.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileUp, Loader2, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { pb } from "../../lib/pocketbase";
import { toast } from "../../lib/toasts";
import { parseSyllabus, detectKind } from "../../lib/syllabus/parse";
import { extractSyllabus } from "../../lib/syllabus/extract";
import { findCourseMatches } from "../../lib/syllabus/match";
import type { CourseMatch } from "../../lib/syllabus/match";
import { importSyllabus } from "../../lib/syllabus/import";
import type { ExtractedSyllabus } from "../../lib/syllabus/extract";
import type { Course } from "../../lib/types";

type Phase =
  | "idle"
  | "parsing"
  | "extracting"
  | "awaiting-confirm"
  | "importing"
  | "done";

interface ConfirmState {
  extracted: ExtractedSyllabus;
  matches: CourseMatch[];
}

interface DoneSummary {
  courseName: string;
  events: number;
  flashcards: number;
  decks: number;
}

export function SyllabusDrop() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState<string>("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [done, setDone] = useState<DoneSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!user) return null;
  const userId = user.id;

  const reset = () => {
    setPhase("idle");
    setStatusText("");
    setConfirm(null);
  };

  const handleFile = async (file: File) => {
    const kind = detectKind(file);
    if (!kind) {
      toast.error("Unsupported file", "Use a PDF, DOCX, or TXT syllabus.");
      return;
    }
    try {
      setDone(null);
      setPhase("parsing");
      setStatusText(`Reading ${file.name}…`);
      const parsed = await parseSyllabus(file);
      if (!parsed.text || parsed.text.length < 40) {
        toast.error("Empty file", "Couldn't read text from that document.");
        reset();
        return;
      }
      setPhase("extracting");
      setStatusText("Asking the model to summarize the syllabus…");
      const extracted = await extractSyllabus(parsed.text);

      const courses = await pb
        .collection("courses")
        .getFullList<Course>({ filter: `user = "${userId}"` });
      const matches = findCourseMatches(extracted.course, courses);

      setConfirm({ extracted, matches });
      setPhase("awaiting-confirm");
      setStatusText("");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't process syllabus", String(err));
      reset();
    }
  };

  const runImport = async (existingCourseId: string | undefined) => {
    if (!confirm) return;
    setPhase("importing");
    setStatusText(
      existingCourseId
        ? "Attaching schedule and study sets to existing course…"
        : "Creating course, schedule, and study sets…",
    );
    try {
      const result = await importSyllabus({
        userId,
        existingCourseId,
        extracted: confirm.extracted,
      });
      const courseName =
        existingCourseId
          ? confirm.matches.find((m) => m.course.id === existingCourseId)
              ?.course.name ?? confirm.extracted.course.name
          : confirm.extracted.course.name;
      setDone({
        courseName,
        events: result.eventsCreated,
        flashcards: result.flashcardsCreated,
        decks: result.decksCreated,
      });
      setPhase("done");
      setConfirm(null);
      setStatusText("");
      toast.success(
        result.courseCreated ? "Course created" : "Course updated",
        `${result.eventsCreated} calendar events · ${result.flashcardsCreated} flashcards`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Import failed", String(err));
      reset();
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const busy =
    phase === "parsing" || phase === "extracting" || phase === "importing";

  return (
    <section aria-label="Upload syllabus" className="mt-2">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
          Add a syllabus
        </h2>
        <span className="text-xs text-[var(--color-text-subtle)]">
          PDF, DOCX, or TXT
        </span>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`block w-full cursor-pointer rounded-md border border-dashed transition-colors px-6 py-8 text-center
          ${
            dragOver
              ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40"
              : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-surface-raised)]/40"
          }
          ${busy ? "opacity-70 pointer-events-none" : ""}`}
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain"
          onChange={onInputChange}
          className="sr-only"
        />
        <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
          ) : (
            <FileUp className="w-5 h-5 text-[var(--color-primary)]" />
          )}
          <p className="text-sm">
            {busy
              ? statusText || "Working…"
              : "Drop a syllabus here or click to choose a file"}
          </p>
          {!busy && (
            <p className="text-xs text-[var(--color-text-subtle)]">
              Converge will pull out the course, propagate the calendar, and
              create starter study sets.
            </p>
          )}
        </div>
      </label>

      {phase === "awaiting-confirm" && confirm && (
        <ConfirmDialog
          state={confirm}
          onPickExisting={(id) => void runImport(id)}
          onCreateNew={() => void runImport(undefined)}
          onCancel={reset}
        />
      )}

      {phase === "done" && done && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 px-4 py-3">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-[var(--color-primary)]" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-[var(--color-text)]">
              {done.courseName} ready.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {done.events} calendar event{done.events === 1 ? "" : "s"} ·{" "}
              {done.flashcards} flashcard{done.flashcards === 1 ? "" : "s"}{" "}
              across {done.decks} deck{done.decks === 1 ? "" : "s"}.{" "}
              <Link
                to="/calendar"
                className="text-[var(--color-primary)] hover:underline"
              >
                Open calendar
              </Link>{" "}
              ·{" "}
              <Link
                to="/decks"
                className="text-[var(--color-primary)] hover:underline"
              >
                Open decks
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}

interface ConfirmDialogProps {
  state: ConfirmState;
  onPickExisting: (courseId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  state,
  onPickExisting,
  onCreateNew,
  onCancel,
}: ConfirmDialogProps) {
  const { extracted, matches } = state;
  const top = matches[0];
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-subtle)]">
              Confirm course
            </p>
            <h3 className="text-lg font-semibold tracking-tight mt-1">
              {top
                ? `Is this ${top.course.name}?`
                : `Create new course "${extracted.course.name}"?`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-[var(--color-text-muted)] mb-5 space-y-1">
          <p>
            Extracted:{" "}
            <span className="text-[var(--color-text)] font-medium">
              {extracted.course.name}
            </span>
            {extracted.course.code ? ` (${extracted.course.code})` : ""}
            {extracted.course.semester
              ? ` — ${extracted.course.semester}`
              : ""}
          </p>
          <p className="text-xs">
            {extracted.schedule.length} dated item
            {extracted.schedule.length === 1 ? "" : "s"} ·{" "}
            {extracted.topics.length} topic
            {extracted.topics.length === 1 ? "" : "s"}
          </p>
        </div>

        {matches.length > 0 && (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
              Possible match{matches.length === 1 ? "" : "es"}
            </p>
            <ul className="space-y-1.5">
              {matches.map((m) => (
                <li key={m.course.id}>
                  <button
                    type="button"
                    onClick={() => onPickExisting(m.course.id)}
                    className="w-full text-left rounded border border-[var(--color-border)] hover:border-[var(--color-primary)] px-3 py-2 transition-colors"
                  >
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {m.course.name}
                    </span>
                    {m.course.code ? (
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        {m.course.code}
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-[var(--color-text-subtle)] mt-0.5">
                      {m.reason} · attach syllabus to this course
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="text-sm font-semibold px-4 py-1.5 rounded bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
          >
            {matches.length > 0
              ? "No — create new course"
              : "Create course"}
          </button>
        </div>
      </div>
    </div>
  );
}
