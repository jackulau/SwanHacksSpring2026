import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  BookOpen,
  CalendarCheck,
  FileText,
  FlaskConical,
  GraduationCap,
  ListChecks,
  Loader2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { NOTE_TEMPLATES, type NoteTemplate } from "../lib/noteTemplates";
import { toast } from "../lib/toasts";
import { ingestNote } from "../lib/knowledge/ingest";
import type { NotePage } from "../lib/types";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
});

const ICON_MAP: Record<string, typeof FileText> = {
  FileText,
  GraduationCap,
  BookOpen,
  ListChecks,
  CalendarCheck,
  FlaskConical,
  BookmarkPlus,
};

function TemplatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const create = async (template: NoteTemplate) => {
    if (!user || busy) return;
    setBusy(template.id);
    try {
      const page = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title: template.initialTitle ?? "",
        icon: "",
        parent: "",
        course: "",
        lecture: "",
        blocks: template.build(),
        properties: { tags: template.tags ?? [] },
        archived: false,
      });
      toast.success("Page created", template.label);
      void ingestNote(user.id, page).catch(() => undefined);
      navigate({ to: "/notes/$pageId", params: { pageId: page.id } });
    } catch {
      toast.error("Couldn't create the page", "Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Templates"
        subtitle="Start a new note from a tested skeleton."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NOTE_TEMPLATES.map((t) => {
            const Icon = ICON_MAP[t.icon] ?? FileText;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => create(t)}
                  className="w-full text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] disabled:opacity-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon
                      className="w-4 h-4 text-[var(--color-text-muted)]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {t.label}
                    </span>
                    {busy === t.id && (
                      <Loader2
                        className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)] ml-auto"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {t.description}
                  </div>
                  {t.tags && t.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] uppercase tracking-wider rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
