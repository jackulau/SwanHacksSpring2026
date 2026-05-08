import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Database,
  Download,
  Loader2,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { downloadJson } from "../lib/export";
import { toast } from "../lib/toasts";
import { ingestNote, ingestFlashcard, ingestQuiz } from "../lib/knowledge/ingest";
import type {
  Course,
  Flashcard,
  Lecture,
  NotePage,
  Quiz,
  Transcript,
} from "../lib/types";

export const Route = createFileRoute("/backup")({
  component: BackupPage,
});

interface BackupPayload {
  format: "converge.backup.v1";
  exported_at: string;
  user: { id: string; email: string; display_name: string };
  courses: Course[];
  lectures: Lecture[];
  transcripts: Transcript[];
  notes: NotePage[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

function BackupPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const onExport = async () => {
    if (!user || busy) return;
    setBusy("export");
    try {
      const [courses, lectures, transcripts, notes, flashcards, quizzes] =
        await Promise.all([
          pb.collection("courses").getFullList<Course>({
            filter: `user = "${user.id}"`,
            requestKey: "backup-courses",
          }),
          pb.collection("lectures").getFullList<Lecture>({
            filter: `user = "${user.id}"`,
            requestKey: "backup-lectures",
          }),
          pb
            .collection("transcripts")
            .getFullList<Transcript>({ requestKey: "backup-transcripts" })
            .catch(() => [] as Transcript[]),
          pb.collection("note_pages").getFullList<NotePage>({
            filter: `user = "${user.id}"`,
            requestKey: "backup-notes",
          }),
          pb.collection("flashcards").getFullList<Flashcard>({
            filter: `user = "${user.id}"`,
            requestKey: "backup-flashcards",
          }),
          pb.collection("quizzes").getFullList<Quiz>({
            filter: `user = "${user.id}"`,
            requestKey: "backup-quizzes",
          }),
        ]);
      const payload: BackupPayload = {
        format: "converge.backup.v1",
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
        },
        courses,
        lectures,
        transcripts,
        notes,
        flashcards,
        quizzes,
      };
      downloadJson(`converge-backup-${user.id}.json`, payload);
      toast.success(
        "Backup ready",
        `${notes.length} notes, ${flashcards.length} cards, ${quizzes.length} quizzes`,
      );
    } catch {
      toast.error("Backup failed", "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || busy) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      if (payload.format !== "converge.backup.v1") {
        toast.error(
          "Unsupported backup",
          "Expected converge.backup.v1 format.",
        );
        return;
      }
      let created = 0;
      // We re-create rows for the current user — ids will be regenerated
      // by PB so collisions don't matter. Skipping courses/lectures
      // because the id-graph for those is intricate; only notes,
      // flashcards, quizzes are restored.
      for (const n of payload.notes) {
        try {
          const np = await pb.collection("note_pages").create<NotePage>({
            user: user.id,
            title: n.title || "",
            icon: n.icon ?? "",
            parent: "",
            course: "",
            lecture: "",
            blocks: n.blocks ?? [],
            properties: {
              ...(n.properties ?? {}),
              tags: [...((n.properties?.tags ?? []) as string[]), "restored"],
            },
            archived: false,
          });
          created++;
          void ingestNote(user.id, np).catch(() => undefined);
        } catch {
          // ignore
        }
      }
      for (const c of payload.flashcards) {
        try {
          const f = await pb
            .collection("flashcards")
            .create<Flashcard>({
              user: user.id,
              lecture: "",
              deck_name: c.deck_name || "Restored",
              front: c.front,
              back: c.back,
              front_image: "",
              back_image: "",
              tags: ["restored", ...(c.tags ?? [])],
              difficulty: c.difficulty ?? "medium",
              source: c.source ?? "manual",
              ease_factor: c.ease_factor ?? 2.5,
              interval_days: c.interval_days ?? 0,
              repetitions: c.repetitions ?? 0,
            });
          created++;
          void ingestFlashcard(user.id, f).catch(() => undefined);
        } catch {
          // ignore
        }
      }
      for (const q of payload.quizzes) {
        try {
          const qz = await pb.collection("quizzes").create<Quiz>({
            user: user.id,
            lecture: "",
            title: q.title || "Restored quiz",
            questions: q.questions ?? [],
            total_points: q.total_points ?? 0,
            source: q.source ?? "auto_generated",
          });
          created++;
          void ingestQuiz(user.id, qz).catch(() => undefined);
        } catch {
          // ignore
        }
      }
      toast.success("Restore complete", `${created} records added`);
    } catch {
      toast.error("Restore failed", "Bad backup file?");
    } finally {
      setBusy(null);
      e.target.value = "";
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Backup"
        subtitle={
          busy === "export"
            ? "Bundling your library…"
            : busy === "import"
              ? "Restoring rows…"
              : "One-shot export and restore of your library to a single JSON."
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-6">
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Database className="w-4 h-4" aria-hidden="true" />
            Export everything
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Bundles your courses, lectures, transcripts, notes, flashcards,
            and quizzes into one converge.backup.v1 JSON. ASL segments,
            calendar events, and study sessions are intentionally
            omitted — they're per-device or per-deployment ephemera.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onExport}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
          >
            {busy === "export" ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4" aria-hidden="true" />
            )}
            Download backup
          </button>
        </section>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Save className="w-4 h-4" aria-hidden="true" />
            Restore from backup
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Restores notes, flashcards, and quizzes from a previous
            backup file. Records are recreated under the current user
            with the 'restored' tag for easy filtering. Courses and
            lectures aren't restored automatically — pick them up by
            re-uploading audio.
          </p>
          <label className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)] cursor-pointer disabled:opacity-50">
            {busy === "import" ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Choose backup JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              disabled={busy !== null}
              className="hidden"
            />
          </label>
        </section>

        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            For per-deck or per-course exports, see{" "}
            <a className="underline" href="/export">
              /export
            </a>
            .
          </div>
        </div>
      </div>
    </AppShell>
  );
}
