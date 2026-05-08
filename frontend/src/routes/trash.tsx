import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { pb } from "../lib/pocketbase";
import { toast } from "../lib/toasts";
import type { NotePage } from "../lib/types";

export const Route = createFileRoute("/trash")({
  component: TrashPage,
});

function TrashPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState<NotePage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("note_pages")
      .getFullList<NotePage>({
        filter: `user = "${user.id}" && archived = true`,
        sort: "-updated",
        requestKey: "trash-pages",
      })
      .then((rows) => {
        if (!cancelled) setPages(rows);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const restore = async (page: NotePage) => {
    setBusy(`r-${page.id}`);
    try {
      await pb.collection("note_pages").update(page.id, { archived: false });
      setPages((prev) => prev?.filter((p) => p.id !== page.id) ?? null);
      toast.success("Restored", page.title || "Untitled");
    } catch {
      toast.error("Couldn't restore", page.title);
    } finally {
      setBusy(null);
    }
  };

  const purge = async (page: NotePage) => {
    if (
      !window.confirm(
        `Permanently delete "${page.title || "Untitled"}"? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(`p-${page.id}`);
    try {
      await pb.collection("note_pages").delete(page.id);
      setPages((prev) => prev?.filter((p) => p.id !== page.id) ?? null);
      toast.success("Deleted", page.title || "Untitled");
    } catch {
      toast.error("Couldn't delete", page.title);
    } finally {
      setBusy(null);
    }
  };

  if (loading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Trash"
        subtitle="Archived note pages recover here before permanent removal."
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-3xl mx-auto mt-6 space-y-4">
          {pages === null ? (
            <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          ) : pages.length === 0 ? (
            <EmptyState
              size="lg"
              icon={Trash2}
              title="Trash is empty"
              description="No archived pages right now. Archive a note from its top bar to send it here."
              action={
                <Link
                  to="/notes"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
                >
                  Browse notes
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {pages.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <FileText
                    className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                    {p.title || "Untitled"}
                  </span>
                  <span className="text-xs text-[var(--color-text-subtle)]">
                    {new Date(p.updated || p.created).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => restore(p)}
                    className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {busy === `r-${p.id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    )}
                    Restore
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => purge(p)}
                    className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] disabled:opacity-50"
                  >
                    {busy === `p-${p.id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    )}
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
