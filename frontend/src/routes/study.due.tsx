import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle2, Layers, Play } from "lucide-react";
import { FlashcardDeck } from "../components/study/FlashcardDeck";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/layout/EmptyState";
import { Skeleton } from "../components/layout/Skeleton";
import { useSM2 } from "../hooks/useSM2";
import { useAuth } from "../lib/auth";
import type { Flashcard } from "../lib/types";
import type { QualityRating } from "../lib/sm2";

export const Route = createFileRoute("/study/due")({
  component: DueTodayPage,
});

type Stage = "loading" | "ready" | "reviewing" | "complete";

interface DeckGroup {
  name: string;
  count: number;
}

/**
 * Unified "Due today" surface — pulls every due flashcard across every deck
 * the user owns, regardless of source lecture, and walks them in a single
 * SM-2 review loop. Cards with no `next_review` are treated as due (they've
 * never been reviewed).
 */
function DueTodayPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { rateCard, getDueCards } = useSM2();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [reviewedCount, setReviewedCount] = useState<number>(0);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    if (!user) return;
    getDueCards(user.id)
      .then((c) => {
        setCards(c);
        setStage("ready");
      })
      .catch(() => setStage("ready"));
  }, [user, getDueCards]);

  const decks: DeckGroup[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      const name = c.deck_name?.trim() || "Untitled deck";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [cards]);

  const handleRate = useCallback(
    async (card: Flashcard, rating: QualityRating) => {
      // Persist the SM-2 update so the card leaves the queue server-side.
      await rateCard(card, rating);
      // Drop it from the local queue too — the next render is driven by
      // FlashcardDeck's internal index, but we keep `cards` in sync so the
      // counts shown elsewhere stay accurate if the user bails.
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    },
    [rateCard],
  );

  const handleComplete = useCallback(() => {
    setReviewedCount((prev) => (prev > 0 ? prev : cards.length));
    setStage("complete");
  }, [cards.length]);

  if (stage === "loading") {
    return (
      <>
        <PageHeader title="Due today" />
        <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto space-y-3">
          <Skeleton className="h-1 rounded-md" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </>
    );
  }

  if (stage === "complete") {
    return (
      <>
        <PageHeader title="Due today" />
        <div className="px-6 lg:px-8 py-16 max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mb-4">
            <CheckCircle2
              className="w-6 h-6 text-[var(--color-primary-strong)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-3xl font-semibold text-[var(--color-text)] tracking-tight mb-2">
            All caught up
          </p>
          <p className="text-[var(--color-text-muted)] mb-8">
            {reviewedCount > 0
              ? `Reviewed ${reviewedCount} ${reviewedCount === 1 ? "card" : "cards"} across every deck. New cards reappear here as their intervals come due.`
              : "Nothing due across any deck right now. New cards reappear here as their intervals come due."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate({ to: "/study" })}
              className="flex-1 h-11 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
            >
              Back to Study
            </button>
            <Link
              to="/study/planner"
              className="flex-1 h-11 rounded-md border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text)] font-medium transition-colors flex items-center justify-center"
            >
              Open planner
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <PageHeader
          title="Due today"
          subtitle="Spaced repetition across every deck."
        />
        <div className="px-6 lg:px-8 py-12 max-w-2xl mx-auto">
          <EmptyState
            icon={Layers}
            title="No cards due across any deck"
            description="You're caught up. New cards appear here as their review intervals come around, no matter which deck they're in."
            size="lg"
            action={
              <div className="flex items-center gap-3">
                <Link
                  to="/study"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Back to Study
                </Link>
                <Link
                  to="/courses"
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Or browse courses
                </Link>
              </div>
            }
          />
        </div>
      </>
    );
  }

  if (stage === "ready") {
    return (
      <>
        <PageHeader
          title="Due today"
          subtitle={`${cards.length} card${cards.length === 1 ? "" : "s"} across ${decks.length} deck${decks.length === 1 ? "" : "s"}.`}
        />
        <div className="px-6 lg:px-8 py-12 max-w-xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-5xl font-semibold text-[var(--color-text)] tracking-tight tabular-nums mb-2">
              {cards.length.toLocaleString()}
            </p>
            <p className="text-[var(--color-text-muted)]">
              due now across every deck
            </p>
          </div>

          <button
            onClick={() => setStage("reviewing")}
            className="w-full h-12 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors flex items-center justify-center gap-2 mb-8"
          >
            <Play className="w-4 h-4" aria-hidden="true" /> Review all
          </button>

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-subtle)]">
                By deck
              </h2>
              <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">
                {decks.length} deck{decks.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {decks.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between py-3 px-1"
                >
                  <span className="text-sm text-[var(--color-text)] truncate min-w-0 mr-3">
                    {d.name}
                  </span>
                  <span className="text-xs text-[var(--color-primary-strong)] tabular-nums shrink-0">
                    {d.count} due
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </>
    );
  }

  // stage === "reviewing" → full-bleed focus mode (no PageHeader chrome).
  return (
    <div className="px-6 lg:px-8 pt-8 pb-8 max-w-2xl mx-auto">
      <FlashcardDeck
        cards={cards}
        onRate={handleRate}
        onComplete={handleComplete}
      />
    </div>
  );
}
