import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw, Sparkles, FileText, Save } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { generateDigest, type DailySummary } from "../lib/digest";
import { toast } from "../lib/toasts";
import type { NoteBlock, NotePage } from "../lib/types";

export const Route = createFileRoute("/digest")({
  component: DigestPage,
});

function DigestPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [running, setRunning] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  // Guard so React 18 strict-mode double-mount doesn't fire two LLM calls.
  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const run = async () => {
    if (!user || running) return;
    setRunning(true);
    try {
      const next = await generateDigest(user.id);
      setSummary(next);
    } catch {
      toast.error(
        "Couldn't build the digest",
        "Try again — the LLM provider may be unavailable.",
      );
    } finally {
      setRunning(false);
    }
  };

  // Auto-run once on mount.
  useEffect(() => {
    if (!user) return;
    if (ranOnceRef.current) return;
    ranOnceRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveAsNote = async () => {
    if (!user || !summary || savingNote) return;
    setSavingNote(true);
    try {
      const blocks = digestToBlocks(summary);
      const page = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title: `Weekly digest — ${new Date().toLocaleDateString()}`,
        icon: "sparkles",
        parent: "",
        course: "",
        lecture: "",
        blocks,
        properties: { tags: ["digest"] },
        archived: false,
      });
      toast.success("Saved as note page", page.title);
      navigate({ to: "/notes/$pageId", params: { pageId: page.id } });
    } catch {
      toast.error("Couldn't save the note", "Try again in a moment.");
    } finally {
      setSavingNote(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Weekly digest"
        subtitle="A short LLM-written read on what you actually did this week."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : summary ? (
                <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {summary ? "Reroll" : running ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={saveAsNote}
              disabled={!summary || savingNote}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-sm text-white disabled:opacity-50"
            >
              {savingNote ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Save as note page
            </button>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        {!summary && running && (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Pulling your last 7 days and asking the LLM…
          </div>
        )}

        {!summary && !running && (
          <p className="text-sm text-[var(--color-text-subtle)]">
            Press Generate to build your digest.
          </p>
        )}

        {summary && (
          <article className="space-y-6">
            <header className="flex items-start gap-3">
              <FileText
                className="w-5 h-5 text-[var(--color-text-muted)] mt-1 flex-shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text)] leading-snug">
                {summary.headline}
              </h2>
            </header>

            {summary.sections.map((s, i) => (
              <section key={`${i}-${s.title}`} className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">
                  {s.title}
                </h3>
                <ul className="space-y-1.5">
                  {s.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="flex gap-2 text-sm text-[var(--color-text)]"
                    >
                      <span
                        className="text-[var(--color-text-subtle)] select-none"
                        aria-hidden="true"
                      >
                        •
                      </span>
                      <span className="flex-1">{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Convert a DailySummary into NoteBlocks: one H1 with the headline, then
 * for each section an H2 + a bullet_item per bullet. Keeps the digest
 * shape recognisable inside the notes editor while letting the user edit
 * it freely.
 */
function digestToBlocks(summary: DailySummary): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let counter = 0;
  const id = () => `dg-${Date.now().toString(36)}-${(counter++).toString(36)}`;
  blocks.push({ id: id(), type: "heading", level: 1, text: summary.headline });
  for (const s of summary.sections) {
    blocks.push({ id: id(), type: "heading", level: 2, text: s.title });
    for (const b of s.bullets) {
      blocks.push({ id: id(), type: "bullet_item", text: b });
    }
  }
  return blocks;
}
