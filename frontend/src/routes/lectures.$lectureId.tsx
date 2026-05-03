import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, NotebookPen } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/layout/Skeleton";
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
} from "../lib/types";

export const Route = createFileRoute("/lectures/$lectureId")({
  component: LectureDetailPage,
});

type View = "transcript" | "notes";

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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

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
              sort: "-created",
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
              sort: "-created",
            });
          if (!cancelled && notesList.length > 0) {
            setNotes(notesList[0]);
          }
        } catch {
          /* no notes */
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

  const handlePersonalNotesChange = async (next: string) => {
    if (!user || !lecture) return;
    const summary = next;
    try {
      if (notes) {
        const updated = await pb
          .collection("notes")
          .update<Note>(notes.id, { summary });
        setNotes(updated);
      } else {
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
      }
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
          subtitle="We couldn't find that lecture in your library."
        />
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
  const subtitleParts = [recordedDate, durationMin].filter(Boolean);
  const eyebrow = course ? `${course.code} · ${course.name}` : undefined;

  const blocks = (notes?.content as NoteBlock[]) || [];
  const segments = transcript?.segments;
  const speakers = transcript?.speakers;

  const primaryAction = (
    <button
      type="button"
      onClick={handleGenerateStudySet}
      disabled={generating || lecture.status === "generating"}
      className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 transition-colors"
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
                  className="hover:text-white focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 rounded-sm"
                >
                  Courses
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="hover:text-white focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-2 rounded-sm"
                >
                  {course.code}
                </Link>
              </li>
            </ol>
          </nav>
        )}

        {/* View toggle — transcript vs notes, never both fighting for screen. */}
        <div
          role="tablist"
          aria-label="Lecture content"
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
        </div>

        {/* The reading surface itself — one calm column. */}
        <main
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          tabIndex={-1}
        >
          {view === "transcript" ? (
            <TranscriptViewer
              cleanText={transcript?.clean_text || ""}
              rawText={transcript?.raw_text || ""}
              segments={segments}
              speakers={speakers}
              onSeek={audioUrl ? handleSeek : undefined}
              currentTime={currentTime}
            />
          ) : (
            <NoteEditor
              blocks={blocks}
              title={notes?.title}
              personalNotes={notes?.summary}
              onPersonalNotesChange={handlePersonalNotesChange}
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
          ? "border-[var(--color-primary)] text-white"
          : "border-transparent text-[var(--color-text-muted)] hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}
