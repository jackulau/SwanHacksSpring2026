import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Loader2,
  Tag as TagIcon,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import {
  searchByTag,
  type TaggedKind,
  type TagSearchResult,
} from "../lib/tags";

export const Route = createFileRoute("/tags/$tag")({
  component: TagDetailPage,
});

const KIND_META: Record<
  TaggedKind,
  { label: string; icon: typeof FileText }
> = {
  note: { label: "Notes", icon: FileText },
  flashcard: { label: "Flashcards", icon: Layers },
  lecture: { label: "Lectures", icon: GraduationCap },
  quiz: { label: "Quizzes", icon: HelpCircle },
};

function TagDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { tag } = Route.useParams();
  const [result, setResult] = useState<TagSearchResult | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    searchByTag(user.id, tag).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tag]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title={tag}
        eyebrow="Tag"
        subtitle={
          result === null
            ? undefined
            : `${result.total} item${result.total === 1 ? "" : "s"}`
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-5">
        <Link
          to="/tags"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          All tags
        </Link>

        {result === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : result.total === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)] inline-flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Nothing tagged with{" "}
            <span className="font-mono">{tag}</span>.
          </p>
        ) : (
          (Object.keys(result.groups) as TaggedKind[])
            .filter((k) => result.groups[k].length > 0)
            .map((k) => {
              const meta = KIND_META[k];
              const Icon = meta.icon;
              const items = result.groups[k];
              return (
                <section key={k}>
                  <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {meta.label} <span>·</span> {items.length}
                  </h2>
                  <ul className="space-y-1.5">
                    {items.map((it) => (
                      <li key={`${k}-${it.id}`}>
                        {it.href ? (
                          <Link
                            to={it.href.to}
                            params={it.href.params}
                            className="block rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 hover:border-[var(--color-primary)]"
                          >
                            <div className="text-sm text-[var(--color-text)] truncate">
                              {it.title}
                            </div>
                            {it.subtitle && (
                              <div className="text-xs text-[var(--color-text-muted)] truncate">
                                {it.subtitle}
                              </div>
                            )}
                          </Link>
                        ) : (
                          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                            <div className="text-sm text-[var(--color-text)] truncate">
                              {it.title}
                            </div>
                            {it.subtitle && (
                              <div className="text-xs text-[var(--color-text-muted)] truncate">
                                {it.subtitle}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
        )}
      </div>
    </AppShell>
  );
}
