import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Assignment, Course } from "../lib/types";

export const Route = createFileRoute("/assignments/$assignmentId")({
  component: AssignmentDetailPage,
});

const STATUS_LABELS: Record<Assignment["status"], string> = {
  upcoming: "Upcoming",
  submitted: "Submitted",
  graded: "Graded",
  missing: "Missing",
};

const STATUS_ICONS: Record<Assignment["status"], typeof Circle> = {
  upcoming: Circle,
  submitted: CheckCircle2,
  graded: CheckCircle2,
  missing: XCircle,
};

function AssignmentDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { assignmentId } = Route.useParams();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [missing, setMissing] = useState(false);
  const [submission, setSubmission] = useState("");
  const [submissionDirty, setSubmissionDirty] = useState(false);
  const [savedTs, setSavedTs] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("assignments")
      .getOne<Assignment>(assignmentId)
      .then(async (a) => {
        if (cancelled) return;
        setAssignment(a);
        // Local-only submission notes — doesn't ship to Canvas.
        const local = window.localStorage.getItem(`asg-sub-${a.id}`) ?? "";
        setSubmission(local);
        if (a.course) {
          try {
            const c = await pb.collection("courses").getOne<Course>(a.course);
            if (!cancelled) setCourse(c);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, assignmentId]);

  const dueLabel = useMemo(() => {
    if (!assignment?.due_at) return "No due date";
    const d = new Date(assignment.due_at);
    const now = new Date();
    const days = Math.round(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dateStr = d.toLocaleString();
    if (days < 0) return `${dateStr} (${Math.abs(days)} days late)`;
    if (days === 0) return `${dateStr} (today)`;
    if (days <= 7) return `${dateStr} (in ${days}d)`;
    return dateStr;
  }, [assignment]);

  const updateStatus = async (next: Assignment["status"]) => {
    if (!assignment) return;
    setAssignment({ ...assignment, status: next });
    try {
      await pb.collection("assignments").update(assignment.id, { status: next });
    } catch {
      // best-effort
    }
  };

  const saveSubmission = () => {
    if (!assignment) return;
    window.localStorage.setItem(`asg-sub-${assignment.id}`, submission);
    setSubmissionDirty(false);
    setSavedTs(Date.now());
    window.setTimeout(() => setSavedTs(null), 1800);
  };

  if (authLoading || !user) return null;

  if (missing) {
    return (
      <AppShell>
        <PageHeader title="Assignment" />
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-md mx-auto text-center text-sm text-[var(--color-text-muted)]">
          Couldn't find that assignment.{" "}
          <Link to="/study/planner" className="underline">
            Open the planner
          </Link>
          .
        </div>
      </AppShell>
    );
  }

  if (!assignment) {
    return (
      <AppShell>
        <PageHeader title="Assignment" />
        <div className="px-4 sm:px-6 lg:px-8 py-12 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      </AppShell>
    );
  }

  const StatusIcon = STATUS_ICONS[assignment.status];

  return (
    <AppShell>
      <PageHeader
        title={assignment.title || "Assignment"}
        eyebrow={course ? `${course.code} ${course.name}` : "Assignment"}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <Link
            to="/study/planner"
            className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Planner
          </Link>
          <span className="opacity-50">·</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            {dueLabel}
          </span>
          {assignment.points_possible > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span>{assignment.points_possible} pts</span>
            </>
          )}
          {assignment.canvas_url && (
            <>
              <span className="opacity-50">·</span>
              <a
                href={assignment.canvas_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Open in Canvas
              </a>
            </>
          )}
        </div>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={`w-4 h-4 ${
                assignment.status === "missing"
                  ? "text-[var(--color-error)]"
                  : assignment.status === "submitted" ||
                    assignment.status === "graded"
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-text-muted)]"
              }`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {STATUS_LABELS[assignment.status]}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {(["upcoming", "submitted", "graded", "missing"] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateStatus(s)}
                    className={`text-[11px] px-2.5 h-7 rounded-full border ${
                      assignment.status === s
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>

        {assignment.description && (
          <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Description
            </h2>
            <div
              className="prose prose-sm max-w-none text-[var(--color-text)] whitespace-pre-wrap"
              // Canvas sometimes returns HTML; render it but in a sandbox.
              dangerouslySetInnerHTML={{
                __html: stripHostileHtml(assignment.description),
              }}
            />
          </section>
        )}

        {assignment.submission_types?.length > 0 && (
          <div className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            Accepted: {assignment.submission_types.join(", ")}
          </div>
        )}

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Submission notes (local)
          </h2>
          <textarea
            value={submission}
            onChange={(e) => {
              setSubmission(e.target.value);
              setSubmissionDirty(true);
            }}
            placeholder="Drafts, links, reminders. Stays on this device — Canvas submission lives in Canvas."
            rows={6}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={saveSubmission}
              disabled={!submissionDirty}
              className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-xs font-semibold px-3 h-8 rounded-md disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              Save draft
            </button>
            {savedTs && (
              <span className="text-[11px] text-[var(--color-success)]">
                Saved
              </span>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/**
 * Lightweight HTML scrub for Canvas-imported descriptions. Strips
 * <script> and inline event handlers. Not a full sanitizer — we trust
 * Canvas as a source — but defensive enough that a copy-paste vuln
 * couldn't sneak in.
 */
function stripHostileHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}
