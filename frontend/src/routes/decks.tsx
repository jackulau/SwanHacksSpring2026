import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  Layers,
  Loader2,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { downloadJson, exportDeckJson } from "../lib/export";
import { toast } from "../lib/toasts";
import type { Flashcard } from "../lib/types";

export const Route = createFileRoute("/decks")({
  component: DecksPage,
});

interface DeckSummary {
  name: string;
  total: number;
  due: number;
  newCards: number;
  matureCards: number;
  lastReview: number | null;
}

function DecksPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("flashcards")
      .getFullList<Flashcard>({
        filter: `user = "${user.id}"`,
        requestKey: "decks-list",
      })
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const decks: DeckSummary[] = useMemo(() => {
    if (!cards) return [];
    const now = Date.now();
    const map = new Map<string, DeckSummary>();
    for (const c of cards) {
      const name = c.deck_name || "Default";
      const summary = map.get(name) ?? {
        name,
        total: 0,
        due: 0,
        newCards: 0,
        matureCards: 0,
        lastReview: null,
      };
      summary.total += 1;
      const dueAt = c.next_review ? new Date(c.next_review).getTime() : 0;
      if (!c.next_review || dueAt <= now) summary.due += 1;
      if ((c.repetitions ?? 0) === 0) summary.newCards += 1;
      if ((c.interval_days ?? 0) >= 21) summary.matureCards += 1;
      if (c.last_review) {
        const ts = new Date(c.last_review).getTime();
        if (!summary.lastReview || ts > summary.lastReview)
          summary.lastReview = ts;
      }
      map.set(name, summary);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cards]);

  const exportDeck = async (name: string) => {
    if (!user) return;
    setBusy(`x:${name}`);
    try {
      const payload = await exportDeckJson(user.id, name);
      const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadJson(`${safe}.deck.json`, payload);
      toast.success("Deck exported", `${payload.cards.length} cards`);
    } catch {
      toast.error("Export failed", name);
    } finally {
      setBusy(null);
    }
  };

  const deleteDeck = async (name: string) => {
    if (!user) return;
    if (
      !window.confirm(
        `Delete every card in "${name}"? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(`d:${name}`);
    try {
      const ids = (cards ?? [])
        .filter((c) => (c.deck_name || "Default") === name)
        .map((c) => c.id);
      for (const id of ids) {
        await pb.collection("flashcards").delete(id).catch(() => undefined);
      }
      setCards((prev) =>
        prev?.filter((c) => (c.deck_name || "Default") !== name) ?? null,
      );
      toast.success("Deck deleted", name);
    } catch {
      toast.error("Couldn't delete deck", name);
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Decks"
        subtitle="Spaced-repetition decks across your library."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        {cards === null ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading decks…
          </div>
        ) : decks.length === 0 ? (
          <p className="text-sm text-[var(--color-text-subtle)]">
            No decks yet. Generate flashcards from a note or lecture, or
            make a deck from a quiz.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {decks.map((d) => (
              <li
                key={d.name}
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Layers
                    className="w-4 h-4 text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-text)]">
                    {d.name}
                  </span>
                  <Link
                    to="/study/flashcards"
                    search={{ deck: d.name }}
                    className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                  >
                    Review <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => exportDeck(d.name)}
                    className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {busy === `x:${d.name}` ? (
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download className="w-3 h-3" aria-hidden="true" />
                    )}
                    Export
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => deleteDeck(d.name)}
                    aria-label="Delete deck"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-50"
                  >
                    {busy === `d:${d.name}` ? (
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <dl className="grid grid-cols-4 gap-3 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                  <Stat label="Total" value={d.total} />
                  <Stat
                    label="Due"
                    value={d.due}
                    accent={d.due > 0 ? "warning" : undefined}
                  />
                  <Stat label="New" value={d.newCards} />
                  <Stat label="Mature" value={d.matureCards} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "warning" | "success";
}) {
  const valueClass =
    accent === "warning"
      ? "text-[var(--color-warning)]"
      : accent === "success"
        ? "text-[var(--color-success)]"
        : "text-[var(--color-text)]";
  return (
    <div>
      <dt className="text-[var(--color-text-subtle)]">{label}</dt>
      <dd className={`text-base font-semibold ${valueClass} tabular-nums`}>
        {value}
      </dd>
    </div>
  );
}
