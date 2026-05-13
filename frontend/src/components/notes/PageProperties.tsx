import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  CircleDashed,
  CircleDot,
  CircleCheck,
  Plus,
  Tag as TagIcon,
  X,
} from "lucide-react";
import type { Course, PageProperties as PageProps } from "../../lib/types";

interface PagePropertiesProps {
  properties: PageProps;
  onChange: (next: PageProps) => void;
  course: string;
  onCourseChange: (courseId: string) => void;
  courses: Course[];
}

/**
 * Compact properties strip — sits between the title and the editor.
 * Each property is a small inline control: a status pill, a course
 * picker, a due-date input, and a free-form tag chip list.
 *
 * The strip stays out of the way until you interact with it; clicks
 * open inline poppers rather than modal dialogs so the writing flow
 * isn't broken.
 */
export function PagePropertiesPanel({
  properties,
  onChange,
  course,
  onCourseChange,
  courses,
}: PagePropertiesProps) {
  const status = properties.status ?? "draft";
  const [tagInput, setTagInput] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const tags = properties.tags ?? [];

  const setStatus = (next: PageProps["status"]) => onChange({ ...properties, status: next });
  const setDue = (next: string) =>
    onChange({ ...properties, due_at: next || undefined });
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, "");
    if (!t) return;
    if (tags.includes(t)) return;
    onChange({ ...properties, tags: [...tags, t] });
  };
  const removeTag = (t: string) =>
    onChange({ ...properties, tags: tags.filter((x) => x !== t) });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 text-xs text-[var(--color-text-muted)]">
      <StatusPill status={status} onChange={setStatus} />

      <CoursePicker
        value={course}
        courses={courses}
        onChange={onCourseChange}
      />

      <DuePicker value={properties.due_at ?? ""} onChange={setDue} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[var(--color-surface-raised)] text-[11px] text-[var(--color-text)]"
          >
            <TagIcon className="w-3 h-3 text-[var(--color-text-subtle)]" aria-hidden="true" />
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              aria-label={`Remove tag ${t}`}
              className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            >
              <X className="w-2.5 h-2.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput);
                setTagInput("");
              }
              if (e.key === "Escape") {
                setAdding(false);
                setTagInput("");
              }
            }}
            onBlur={() => {
              addTag(tagInput);
              setTagInput("");
              setAdding(false);
            }}
            placeholder="Tag"
            className="px-2 h-6 rounded-full bg-[var(--color-input)] text-[11px] outline-none focus:ring-1 focus:ring-[var(--color-primary)] w-24"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
            Tag
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  status,
  onChange,
}: {
  status: NonNullable<PageProps["status"]>;
  onChange: (next: PageProps["status"]) => void;
}) {
  const cycle = () => {
    const order: PageProps["status"][] = ["draft", "in_progress", "done"];
    const idx = order.indexOf(status);
    const next = order[(idx + 1) % order.length];
    onChange(next);
  };
  const styles: Record<NonNullable<PageProps["status"]>, { label: string; icon: typeof CircleDot; tone: string }> = {
    draft: { label: "Draft", icon: CircleDashed, tone: "text-[var(--color-text-muted)]" },
    in_progress: { label: "In progress", icon: CircleDot, tone: "text-[var(--color-info)]" },
    done: { label: "Done", icon: CircleCheck, tone: "text-[var(--color-success)]" },
  };
  const s = styles[status];
  const Icon = s.icon;
  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] ${s.tone}`}
      aria-label="Change status"
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{s.label}</span>
    </button>
  );
}

function CoursePicker({
  value,
  courses,
  onChange,
}: {
  value: string;
  courses: Course[];
  onChange: (next: string) => void;
}) {
  const current = courses.find((c) => c.id === value);
  return (
    <label className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] cursor-pointer">
      <span className="text-[var(--color-text-subtle)]">Course</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-[var(--color-text)] cursor-pointer"
      >
        <option value="">— None —</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code ? `${c.code} ${c.name}` : c.name}
          </option>
        ))}
      </select>
      {current?.color && (
        <span
          className="w-2 h-2 rounded-full ml-0.5"
          style={{ backgroundColor: current.color }}
          aria-hidden="true"
        />
      )}
    </label>
  );
}

function DuePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  // Strip time component for the date input — page-level due dates are
  // calendar-day granularity, not time-of-day.
  const dateOnly = value ? value.slice(0, 10) : "";
  return (
    <label className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] cursor-pointer">
      <CalendarIcon className="w-3 h-3 text-[var(--color-text-subtle)]" aria-hidden="true" />
      <input
        type="date"
        value={dateOnly}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T23:59:59Z` : "")}
        className="bg-transparent outline-none text-[var(--color-text)] cursor-pointer text-[11px]"
        aria-label="Due date"
      />
    </label>
  );
}
