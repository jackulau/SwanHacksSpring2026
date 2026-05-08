import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { listAllTags, type TagBucket } from "../lib/tags";

export const Route = createFileRoute("/tags")({
  component: TagsIndexPage,
});

function TagsIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagBucket[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listAllTags(user.id).then((rows) => {
      if (!cancelled) setTags(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Tags"
        subtitle="Every tag across notes, lectures, decks, and quizzes."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        {tags === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading tags…
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">
            No tags yet. Add tags to a note, deck, lecture, or quiz to see
            them here.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.tag}>
                <Link
                  to="/tags/$tag"
                  params={{ tag: t.tag }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 h-8 text-sm hover:border-[var(--color-primary)]"
                >
                  <TagIcon
                    className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--color-text)]">{t.tag}</span>
                  <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">
                    {t.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
