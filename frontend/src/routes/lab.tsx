import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  Hand,
  Loader2,
  ServerCrash,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import {
  ALL_LLM_PROVIDER_IDS,
  resolveProvider as resolveLlmProvider,
  type LlmProviderId,
} from "../lib/llm/providers";
import {
  ALL_PROVIDER_IDS as ALL_VLM_PROVIDER_IDS,
  resolveProvider as resolveVlmProvider,
  type VlmProviderId,
} from "../lib/asl/providers";

export const Route = createFileRoute("/lab")({
  component: LabPage,
});

interface ProviderStatus {
  id: string;
  available: boolean;
  resolved: string;
}

function LabPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [llm, setLlm] = useState<ProviderStatus[] | null>(null);
  const [vlm, setVlm] = useState<ProviderStatus[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const probe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const llmProbes: ProviderStatus[] = [];
      for (const id of ALL_LLM_PROVIDER_IDS) {
        const resolved = await resolveLlmProvider(id);
        llmProbes.push({
          id,
          available: resolved.id === id,
          resolved: resolved.id,
        });
      }
      setLlm(llmProbes);

      const vlmProbes: ProviderStatus[] = [];
      for (const id of ALL_VLM_PROVIDER_IDS) {
        const resolved = await resolveVlmProvider(id);
        vlmProbes.push({
          id,
          available: resolved.id === id,
          resolved: resolved.id,
        });
      }
      setVlm(vlmProbes);

      if (user) {
        const collections = [
          "note_pages",
          "lectures",
          "transcripts",
          "flashcards",
          "quizzes",
          "calendar_events",
          "asl_segments",
          "knowledge_chunks",
          "knowledge_edges",
          "course_modules",
          "note_comments",
          "quiz_session",
        ];
        const out: Record<string, number> = {};
        for (const c of collections) {
          try {
            const page = await pb.collection(c).getList(1, 1, {
              filter: collectionUserFilter(c, user.id),
              requestKey: `lab-count-${c}`,
            });
            out[c] = page.totalItems;
          } catch {
            out[c] = -1;
          }
        }
        setCounts(out);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user) void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Lab"
        subtitle="System status — providers, collections, and the knowledge index."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={probe}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-xs px-2.5 h-8 rounded hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Re-probe
          </button>
        </div>

        <ProviderSection
          title="LLM providers"
          icon={Sparkles}
          rows={llm}
          hint="The Generate flows, Inline AI, and Knowledge Ask use these."
        />

        <ProviderSection
          title="ASL vision providers"
          icon={Hand}
          rows={vlm}
          hint="The /asl chat surface routes frames through these."
        />

        <CollectionSection counts={counts} />
      </div>
    </AppShell>
  );
}

function ProviderSection({
  title,
  icon: Icon,
  rows,
  hint,
}: {
  title: string;
  icon: typeof Activity;
  rows: ProviderStatus[] | null;
  hint?: string;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {title}
      </h2>
      {hint && (
        <p className="text-xs text-[var(--color-text-subtle)] mb-2">{hint}</p>
      )}
      {rows === null ? (
        <p className="text-xs text-[var(--color-text-muted)]">Probing…</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs"
            >
              {r.available ? (
                <CheckCircle2
                  className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="w-3.5 h-3.5 text-[var(--color-text-subtle)] flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono text-[var(--color-text)] flex-1">
                {r.id}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {r.available ? "available" : `falls back to ${r.resolved}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CollectionSection({
  counts,
}: {
  counts: Record<string, number> | null;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" aria-hidden="true" />
        Collections (your records)
      </h2>
      {counts === null ? (
        <p className="text-xs text-[var(--color-text-muted)]">Counting…</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {Object.entries(counts).map(([name, count]) => (
            <li
              key={name}
              className={`rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs flex items-center gap-2 ${count < 0 ? "opacity-60" : ""}`}
            >
              {count < 0 && (
                <ServerCrash
                  className="w-3 h-3 text-[var(--color-error)]"
                  aria-hidden="true"
                />
              )}
              <span className="flex-1 truncate text-[var(--color-text)]">
                {name}
              </span>
              <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
                {count < 0 ? "?" : count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Per-collection filter that respects the field name used for the
 * user-scope. quiz_session uses `host_user`; the rest follow the
 * canonical `user`.
 */
function collectionUserFilter(name: string, userId: string): string {
  if (name === "quiz_session") return `host_user = "${userId}"`;
  return `user = "${userId}"`;
}
