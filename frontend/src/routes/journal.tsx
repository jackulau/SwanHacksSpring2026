import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Calendar, Loader2, Save } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { ingestNote } from "../lib/knowledge/ingest";
import { toast } from "../lib/toasts";
import type { NotePage } from "../lib/types";

export const Route = createFileRoute("/journal")({
  component: JournalPage,
});

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Daily journal — one note page per day, tagged 'journal'. The page
 * is shaped predictably ("YYYY-MM-DD" title) so we can find or
 * create on demand without a separate collection.
 */
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function JournalPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [todayPage, setTodayPage] = useState<NotePage | null>(null);
  const [recent, setRecent] = useState<NotePage[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const key = todayKey();
    const findOrLoad = async () => {
      try {
        const page = await pb
          .collection("note_pages")
          .getFirstListItem<NotePage>(
            `user = "${user.id}" && title = "${key}"`,
            { requestKey: `journal-today-${key}` },
          )
          .catch(() => null);
        if (cancelled) return;
        if (page) {
          setTodayPage(page);
          // Pull the first paragraph as today's draft.
          const first = (page.blocks ?? []).find(
            (b) => (b as { type?: string }).type === "paragraph",
          ) as { text?: string } | undefined;
          if (first?.text) setText(first.text);
        }
      } catch {
        // ignore
      }
    };
    void findOrLoad();
    pb.collection("note_pages")
      .getList<NotePage>(1, 10, {
        filter: `user = "${user.id}" && properties.tags ~ "journal" && title != "${key}"`,
        sort: "-created",
        requestKey: "journal-recent",
      })
      .then((r) => {
        if (!cancelled) setRecent(r.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    const key = todayKey();
    try {
      const blocks = [
        { id: rid(), type: "heading" as const, level: 1 as const, text: key },
        { id: rid(), type: "paragraph" as const, text },
      ];
      let page: NotePage;
      if (todayPage) {
        page = await pb.collection("note_pages").update<NotePage>(todayPage.id, {
          blocks,
        });
      } else {
        page = await pb.collection("note_pages").create<NotePage>({
          user: user.id,
          title: key,
          icon: "book-open",
          parent: "",
          course: "",
          lecture: "",
          blocks,
          properties: { tags: ["journal"] },
          archived: false,
        });
      }
      setTodayPage(page);
      void ingestNote(user.id, page).catch(() => undefined);
      toast.success("Journal saved", key);
    } catch {
      toast.error("Save failed", "Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Journal"
        subtitle="One paragraph a day. Tags itself, lands as a note page."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-5">
        <div className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          {todayKey()}
          {todayPage && (
            <span className="text-[var(--color-text-subtle)]">· editing today's entry</span>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          autoFocus
          placeholder="What did today surface?"
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none leading-relaxed"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || !text.trim()}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4" aria-hidden="true" />
            )}
            Save entry
          </button>
          {todayPage && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/notes/$pageId",
                  params: { pageId: todayPage.id },
                })
              }
              className="inline-flex items-center gap-1 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
            >
              Open as note <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {recent.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Recent entries
            </h2>
            <ul className="space-y-1">
              {recent.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/notes/$pageId",
                        params: { pageId: p.id },
                      })
                    }
                    className="w-full text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    {p.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
