import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Download,
  FileArchive,
  FileText,
  Loader2,
  Layers,
  Sparkles,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import {
  downloadJson,
  downloadText,
  exportCourseMarkdown,
  exportDeckJson,
} from "../lib/export";
import { toast } from "../lib/toasts";
import type { Course, Flashcard } from "../lib/types";

export const Route = createFileRoute("/export")({
  component: ExportPage,
});

function ExportPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<{ name: string; count: number }[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      pb
        .collection("flashcards")
        .getFullList<Flashcard>({
          filter: `user = "${user.id}"`,
          requestKey: "export-cards-list",
        })
        .catch(() => [] as Flashcard[]),
      pb
        .collection("courses")
        .getFullList<Course>({
          filter: `user = "${user.id}"`,
          sort: "name",
          requestKey: "export-courses-list",
        })
        .catch(() => [] as Course[]),
    ]).then(([cards, cs]) => {
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const c of cards) {
        const k = c.deck_name || "Default";
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      setDecks(
        Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCourses(cs);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const exportDeck = async (deckName: string) => {
    if (!user) return;
    setBusy(`deck:${deckName}`);
    setFeedback(null);
    try {
      const payload = await exportDeckJson(user.id, deckName);
      const safe = deckName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadJson(`${safe}.deck.json`, payload);
      const msg = `Exported ${payload.cards.length} card${payload.cards.length === 1 ? "" : "s"} from "${deckName}".`;
      setFeedback(msg);
      toast.success("Deck exported", msg);
    } catch {
      setFeedback("Export failed.");
      toast.error("Export failed", deckName);
    } finally {
      setBusy(null);
    }
  };

  const exportCourse = async (course: Course) => {
    if (!user) return;
    setBusy(`course:${course.id}`);
    setFeedback(null);
    try {
      const out = await exportCourseMarkdown(user.id, course.id);
      downloadText(out.filename, out.content);
      const msg = `Exported ${course.code || course.name} to ${out.filename}.`;
      setFeedback(msg);
      toast.success("Course bundled", msg);
    } catch {
      setFeedback("Export failed.");
      toast.error("Export failed", course.name);
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Export"
        subtitle="Download your decks and courses as portable files."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-8">
        {feedback && (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs px-3 py-2">
            {feedback}
          </div>
        )}

        <section>
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            Decks (JSON, anki-importable)
          </h2>
          {decks.length === 0 ? (
            <p className="text-xs text-[var(--color-text-subtle)]">
              No decks yet. Generate flashcards from a note or lecture first.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {decks.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                    {d.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    {d.count} card{d.count === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => exportDeck(d.name)}
                    className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-xs px-2.5 h-7 rounded hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {busy === `deck:${d.name}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="w-3 h-3" aria-hidden="true" />
                    )}
                    Export
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            Courses (single bundled markdown)
          </h2>
          {courses.length === 0 ? (
            <p className="text-xs text-[var(--color-text-subtle)]">
              No courses yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {courses.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                    {c.code ? `${c.code} · ` : ""}
                    {c.name}
                  </span>
                  {c.semester && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {c.semester}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => exportCourse(c)}
                    className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-xs px-2.5 h-7 rounded hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {busy === `course:${c.id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileArchive className="w-3 h-3" aria-hidden="true" />
                    )}
                    Bundle
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-4 text-xs text-[var(--color-text-muted)] flex items-start gap-3">
          <Sparkles
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            Note pages export individually from the page itself —
            <br />
            open a page and use the <FileText className="inline w-3 h-3" aria-hidden="true" /> Copy MD or download buttons in the topbar.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
