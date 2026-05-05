import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  FileText,
  NotebookPen,
  Brain,
  FileQuestion,
  Play,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/layout/Skeleton";
import { EmptyState } from "../components/layout/EmptyState";
import { TranscriptViewer } from "../components/workspace/TranscriptViewer";
import { NoteEditor } from "../components/workspace/NoteEditor";
import { useAudioPlayer } from "../lib/audioPlayer";
import { pb } from "../lib/pocketbase";
import type {
  Lecture,
  Transcript,
  Note,
  NoteBlock,
  Course,
  Flashcard,
  Quiz,
} from "../lib/types";

export const Route = createFileRoute("/lectures/$lectureId")({
  component: LectureDetailPage,
});

type View = "transcript" | "notes" | "flashcards" | "quiz";

function LectureDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { lectureId } = Route.useParams();
  const { setSrc, seek, currentTime, src } = useAudioPlayer();

  const [view, setView] = useState<View>("transcript");
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [notes, setNotes] = useState<Note | null>(null);
  // Tracks whether the GET completed (success OR truly empty result). We only
  // allow `create` to fire after this is true — otherwise a failed GET would
  // silently spawn duplicate rows on every save (P0 #3).
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Reflect the lecture title in the browser tab so multi-tab users can find it.
  useEffect(() => {
    const previous = document.title;
    if (lecture?.title) {
      document.title = `${lecture.title} · Converge`;
    }
    return () => {
      document.title = previous;
    };
  }, [lecture?.title]);

  // Load all lecture-scoped data from PocketBase
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const lec = await pb
          .collection("lectures")
          .getOne<Lecture>(lectureId);
        if (cancelled) return;
        setLecture(lec);

        if (lec.course) {
          try {
            const c = await pb
              .collection("courses")
              .getOne<Course>(lec.course);
            if (!cancelled) setCourse(c);
          } catch {
            /* course may have been deleted */
          }
        }

        try {
          const transcripts = await pb
            .collection("transcripts")
            .getFullList<Transcript>({
              filter: `lecture = "${lectureId}"`,
              // `-created` 400s when autodate fields aren't backfilled on
              // seeded rows (P0 #1). `-id` is monotonic in PocketBase and
              // works regardless of the autodate state.
              sort: "-id",
            });
          if (!cancelled && transcripts.length > 0) {
            setTranscript(transcripts[0]);
          }
        } catch {
          /* no transcript */
        }

        try {
          const notesList = await pb
            .collection("notes")
            .getFullList<Note>({
              filter: `lecture = "${lectureId}"`,
              sort: "-id",
            });
          if (!cancelled) {
            if (notesList.length > 0) {
              setNotes(notesList[0]);
            }
            // Mark "GET succeeded" so the save handler knows it's safe to
            // create a row when none exists. If the GET threw above, we leave
            // notesLoaded=false and the save handler will refuse to create.
            setNotesLoaded(true);
          }
        } catch {
          /* no notes — leave notesLoaded=false to prevent dup creates */
        }

        try {
          const cards = await pb
            .collection("flashcards")
            .getList<Flashcard>(1, 100, {
              filter: `lecture = "${lectureId}"`,
            });
          if (!cancelled) setFlashcards(cards.items);
        } catch {
          /* no flashcards */
        }

        try {
          const quizzes = await pb
            .collection("quizzes")
            .getList<Quiz>(1, 1, {
              filter: `lecture = "${lectureId}"`,
            });
          if (!cancelled && quizzes.items.length > 0) {
            setQuiz(quizzes.items[0]);
          }
        } catch {
          /* no quiz */
        }
      } catch {
        /* lecture not found */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user, lectureId]);

  // Wire the lecture's audio into the global AudioPlayer so a click on a
  // transcript timestamp seeks it. We only call setSrc when it actually
  // changes to avoid resetting playback on re-renders.
  const audioUrl = useMemo(() => {
    if (!lecture?.audio_file) return null;
    try {
      return pb.files.getUrl(lecture, lecture.audio_file);
    } catch {
      return null;
    }
  }, [lecture]);

  useEffect(() => {
    if (!audioUrl) return;
    if (src === audioUrl) return;
    setSrc(audioUrl, lecture?.title);
  }, [audioUrl, lecture?.title, setSrc, src]);

  // Click-to-seek from transcript -> AudioPlayer (single-click depth).
  const handleSeek = (seconds: number) => {
    if (!audioUrl) return;
    if (src !== audioUrl) setSrc(audioUrl, lecture?.title);
    seek(seconds);
  };

  // Single primary action: regenerate AI study set for this lecture.
  const handleGenerateStudySet = async () => {
    if (!lecture || generating) return;
    setGenerating(true);
    try {
      await pb.collection("lectures").update(lecture.id, {
        status: "generating",
      });
      const fresh = await pb
        .collection("lectures")
        .getOne<Lecture>(lecture.id);
      setLecture(fresh);
    } catch {
      /* surfaced via lecture status next refresh */
    } finally {
      setGenerating(false);
    }
  };

  // 1/2/3/4 jumps between tabs when not typing — but yields to the inner
  // surface when the user is already on Flashcards or Quiz, where 1-4 are
  // bound to rating/answer choices. Without this guard, pressing "1" to
  // mark a card "Again" would also kick the user back to the transcript.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const node = e.target as HTMLElement | null;
      const tag = node?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (view === "flashcards" || view === "quiz") return;
      const map: Record<string, View> = { "1": "transcript", "2": "notes", "3": "flashcards", "4": "quiz" };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        setView(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const handlePersonalNotesChange = async (next: string) => {
    if (!user || !lecture) return;
    const summary = next;
    try {
      if (notes) {
        // Existing record — switch to update from the very first save after
        // create so we never spawn duplicate rows.
        const updated = await pb
          .collection("notes")
          .update<Note>(notes.id, { summary });
        setNotes(updated);
        return;
      }
      // No record in state. Only safe to create if the initial GET actually
      // succeeded and was truly empty — otherwise we'd be racing the load and
      // could create one row per keystroke (the P0 #3 duplicate-row bug).
      if (!notesLoaded) return;
      const created = await pb.collection("notes").create<Note>({
        lecture: lecture.id,
        user: user.id,
        title: lecture.title,
        content: [],
        content_type: "manual",
        key_concepts: [],
        summary,
      });
      setNotes(created);
    } catch {
      /* swallow — surfaced by next read */
    }
  };

  // ── Loading shell ────────────────────────────────────────────────────────
  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <PageHeader title="Lecture" subtitle="Loading lecture details…" />
        <div className="px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!lecture) {
    return (
      <AppShell>
        <PageHeader
          title="Lecture not found"
          subtitle="It may have been deleted, or the link is from a different account."
        />
        <div className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-3xl mx-auto mt-6 flex flex-wrap items-center gap-4 text-sm">
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
            >
              ← Back to courses
            </Link>
            <Link
              to="/capture"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Record a new lecture
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const recordedDate = lecture.recorded_at
    ? new Date(lecture.recorded_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const durationMin = lecture.duration_secs
    ? `${Math.ceil(lecture.duration_secs / 60)} min`
    : "";
  const inFlightStatus =
    lecture.status === "transcribing"
      ? "Transcribing…"
      : lecture.status === "generating"
        ? "Generating notes & flashcards…"
        : lecture.status === "uploading"
          ? "Uploading audio…"
          : lecture.status === "processing"
            ? "Processing…"
            : lecture.status === "error"
              ? "Last run failed — generate again to retry."
              : null;
  const subtitleParts = [recordedDate, durationMin, inFlightStatus].filter(
    Boolean,
  );
  const eyebrow = course
    ? [course.code, course.name].filter(Boolean).join(" · ") || undefined
    : undefined;

  const blocks = (notes?.content as NoteBlock[]) || [];
  const segments = transcript?.segments;
  const speakers = transcript?.speakers;

  // Cards whose `next_review` is now-or-earlier are "due" for SM-2 review.
  const nowIso = new Date().toISOString();
  const dueCount = flashcards.filter(
    (c) => !c.next_review || c.next_review <= nowIso,
  ).length;

  const primaryAction = (
    <button
      type="button"
      onClick={handleGenerateStudySet}
      disabled={generating || lecture.status === "generating"}
      className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 transition-colors"
    >
      <Sparkles className="w-4 h-4" aria-hidden="true" />
      {generating || lecture.status === "generating"
        ? "Generating…"
        : "Generate study set"}
    </button>
  );

  return (
    <AppShell>
      <PageHeader
        title={lecture.title}
        subtitle={subtitleParts.join(" · ")}
        eyebrow={eyebrow}
        actions={primaryAction}
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        {/* Course breadcrumb — single-click back to course view. */}
        {course && (
          <nav
            aria-label="Breadcrumb"
            className="max-w-3xl mx-auto mb-4 text-sm"
          >
            <ol className="flex items-center gap-2 text-[var(--color-text-subtle)]">
              <li>
                <Link
                  to="/courses"
                  className="hover:text-[var(--color-text)] focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 rounded-sm"
                >
                  Courses
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="hover:text-[var(--color-text)] focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 rounded-sm"
                >
                  {course.code}
                </Link>
              </li>
            </ol>
          </nav>
        )}

        {/* View toggle — Transcript / Notes / Flashcards / Quiz. */}
        <div
          role="tablist"
          aria-label="Lecture content"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const order: View[] = ["transcript", "notes", "flashcards", "quiz"];
            const idx = order.indexOf(view);
            const next =
              e.key === "ArrowRight"
                ? order[(idx + 1) % order.length]
                : order[(idx - 1 + order.length) % order.length];
            e.preventDefault();
            setView(next);
            // Move focus to the freshly-activated tab so the focus ring follows.
            window.setTimeout(() => {
              document.getElementById(`tab-${next}`)?.focus();
            }, 0);
          }}
          className="max-w-3xl mx-auto mb-8 flex items-center gap-1 border-b border-[var(--color-border)]"
        >
          <ViewTab
            id="transcript"
            label="Transcript"
            icon={FileText}
            active={view === "transcript"}
            onSelect={() => setView("transcript")}
          />
          <ViewTab
            id="notes"
            label="Notes"
            icon={NotebookPen}
            active={view === "notes"}
            onSelect={() => setView("notes")}
          />
          <ViewTab
            id="flashcards"
            label="Flashcards"
            icon={Brain}
            active={view === "flashcards"}
            onSelect={() => setView("flashcards")}
          />
          <ViewTab
            id="quiz"
            label="Quiz"
            icon={FileQuestion}
            active={view === "quiz"}
            onSelect={() => setView("quiz")}
          />
        </div>

        {/* The reading surface itself — one calm column. */}
        <main
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          tabIndex={-1}
        >
          {view === "transcript" && (
            <TranscriptViewer
              cleanText={transcript?.clean_text || ""}
              rawText={transcript?.raw_text || ""}
              segments={segments}
              speakers={speakers}
              onSeek={audioUrl ? handleSeek : undefined}
              currentTime={currentTime}
            />
          )}
          {view === "notes" && (
            <NoteEditor
              blocks={blocks}
              title={notes?.title}
              personalNotes={notes?.summary}
              onPersonalNotesChange={handlePersonalNotesChange}
            />
          )}
          {view === "flashcards" && (
            <FlashcardsTab
              total={flashcards.length}
              due={dueCount}
              lectureId={lecture.id}
              // The /study/flashcards route doesn't (yet) validate a `lecture`
              // search param, so we just send the user to the global review
              // queue. Lecture-scoped filtering can be added by extending the
              // study route's validateSearch + getDueCards filter.
              onStart={() => navigate({ to: "/study/flashcards" })}
              onGenerate={handleGenerateStudySet}
              generating={generating || lecture.status === "generating"}
            />
          )}
          {view === "quiz" && (
            <QuizTab
              quiz={quiz}
              onStart={(quizId) =>
                navigate({ to: "/study/quiz/$quizId", params: { quizId } })
              }
              onGenerate={handleGenerateStudySet}
              generating={generating || lecture.status === "generating"}
            />
          )}
        </main>
      </div>
    </AppShell>
  );
}

interface ViewTabProps {
  id: View;
  label: string;
  icon: typeof FileText;
  active: boolean;
  onSelect: () => void;
}

function ViewTab({ id, label, icon: Icon, active, onSelect }: ViewTabProps) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={`panel-${id}`}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2 rounded-sm ${
        active
          ? "border-[var(--color-primary)] text-[var(--color-text)]"
          : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}

interface FlashcardsTabProps {
  total: number;
  due: number;
  lectureId: string;
  onStart: () => void;
  onGenerate?: () => void;
  generating?: boolean;
}

function FlashcardsTab({ total, due, onStart, onGenerate, generating }: FlashcardsTabProps) {
  if (total === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyState
          icon={Brain}
          title="No flashcards yet"
          description="Run a study-set generation to turn this lecture into spaced-repetition cards."
          size="md"
          action={
            onGenerate && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {generating ? "Generating…" : "Generate study set"}
              </button>
            )
          }
        />
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
        <div className="flex items-center gap-6 mb-6">
          <div>
            <p className="text-3xl font-semibold text-[var(--color-text)] tabular-nums">
              {total}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {total === 1 ? "card" : "cards"} in deck
            </p>
          </div>
          <div className="h-10 w-px bg-[var(--color-border)]" aria-hidden="true" />
          <div>
            <p className="text-3xl font-semibold text-[var(--color-text)] tabular-nums">
              {due}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              due now
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={due === 0}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 transition-colors"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            {due === 0 ? "All caught up" : "Start review"}
          </button>
          {due === 0 && total > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Next cards become due as their interval expires.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuizTabProps {
  quiz: Quiz | null;
  onStart: (quizId: string) => void;
  onGenerate?: () => void;
  generating?: boolean;
}

function QuizTab({ quiz, onStart, onGenerate, generating }: QuizTabProps) {
  if (!quiz) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyState
          icon={FileQuestion}
          title="No quiz yet"
          description="Run a study-set generation to turn this lecture into a quiz."
          size="md"
          action={
            onGenerate && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {generating ? "Generating…" : "Generate study set"}
              </button>
            )
          }
        />
      </div>
    );
  }
  const questionCount = Array.isArray(quiz.questions)
    ? quiz.questions.length
    : 0;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
        <p className="text-base font-medium text-[var(--color-text)] mb-1">
          {quiz.title}
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          {questionCount} {questionCount === 1 ? "question" : "questions"}
          {quiz.total_points ? ` · ${quiz.total_points} pts` : ""}
        </p>
        <button
          type="button"
          onClick={() => onStart(quiz.id)}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 transition-colors"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          Take quiz
        </button>
      </div>
    </div>
  );
}
