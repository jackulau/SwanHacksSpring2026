import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Dice5,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import type { Flashcard, NotePage, Quiz } from "../lib/types";

export const Route = createFileRoute("/random")({
  component: RandomPage,
});

interface RandomPick {
  kind: "card" | "note" | "quiz";
  id: string;
  title: string;
  detail: string;
  href: { to: string; params?: Record<string, string>; search?: Record<string, unknown> };
}

function RandomPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pick, setPick] = useState<RandomPick | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const reroll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tracks = ["card", "note", "quiz"] as const;
      const order = [...tracks].sort(() => Math.random() - 0.5);
      for (const track of order) {
        const result = await pickFor(track, user.id);
        if (result) {
          setPick(result);
          return;
        }
      }
      setPick(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void reroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Random pick"
        subtitle="Roll the dice on something to study right now."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-xl mx-auto space-y-4">
        {loading ? (
          <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Picking…
          </div>
        ) : pick === null ? (
          <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-6 text-center text-sm text-[var(--color-text-muted)] flex flex-col items-center gap-2">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            <p>
              No flashcards, notes, or quizzes yet. Generate some content
              and come back.
            </p>
          </div>
        ) : (
          <PickCard pick={pick} onReroll={reroll} />
        )}
      </div>
    </AppShell>
  );
}

function PickCard({
  pick,
  onReroll,
}: {
  pick: RandomPick;
  onReroll: () => void;
}) {
  const navigate = useNavigate();
  const Icon =
    pick.kind === "card" ? Layers : pick.kind === "note" ? FileText : HelpCircle;
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {pick.kind}
      </div>
      <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
        {pick.title}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] line-clamp-3">
        {pick.detail}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: pick.href.to,
              params: pick.href.params,
              search: pick.href.search,
            } as Parameters<typeof navigate>[0])
          }
          className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md"
        >
          Open
        </button>
        <button
          type="button"
          onClick={onReroll}
          className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
        >
          <Dice5 className="w-4 h-4" aria-hidden="true" />
          Reroll
        </button>
        <button
          type="button"
          onClick={onReroll}
          aria-label="Reroll"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

async function pickFor(
  kind: "card" | "note" | "quiz",
  userId: string,
): Promise<RandomPick | null> {
  if (kind === "card") {
    const page = await pb
      .collection("flashcards")
      .getList<Flashcard>(1, 1, {
        filter: `user = "${userId}"`,
        requestKey: `random-card-count`,
      })
      .catch(() => null);
    if (!page || page.totalItems === 0) return null;
    const idx = Math.floor(Math.random() * page.totalItems);
    const cards = await pb
      .collection("flashcards")
      .getList<Flashcard>(idx + 1, 1, {
        filter: `user = "${userId}"`,
        requestKey: `random-card-pick-${idx}`,
      })
      .catch(() => null);
    const card = cards?.items[0];
    if (!card) return null;
    return {
      kind: "card",
      id: card.id,
      title: card.front || "Untitled card",
      detail: card.back || "",
      href: { to: "/study/flashcards", search: { deck: card.deck_name } },
    };
  }
  if (kind === "note") {
    const page = await pb
      .collection("note_pages")
      .getList<NotePage>(1, 1, {
        filter: `user = "${userId}" && archived = false`,
        requestKey: `random-note-count`,
      })
      .catch(() => null);
    if (!page || page.totalItems === 0) return null;
    const idx = Math.floor(Math.random() * page.totalItems);
    const notes = await pb
      .collection("note_pages")
      .getList<NotePage>(idx + 1, 1, {
        filter: `user = "${userId}" && archived = false`,
        requestKey: `random-note-pick-${idx}`,
      })
      .catch(() => null);
    const note = notes?.items[0];
    if (!note) return null;
    const preview =
      ((note.blocks?.[0] as { text?: string })?.text ?? "")?.slice(0, 240) ?? "";
    return {
      kind: "note",
      id: note.id,
      title: note.title || "Untitled note",
      detail: preview,
      href: { to: "/notes/$pageId", params: { pageId: note.id } },
    };
  }
  // quiz
  const page = await pb
    .collection("quizzes")
    .getList<Quiz>(1, 1, {
      filter: `user = "${userId}"`,
      requestKey: `random-quiz-count`,
    })
    .catch(() => null);
  if (!page || page.totalItems === 0) return null;
  const idx = Math.floor(Math.random() * page.totalItems);
  const quizzes = await pb
    .collection("quizzes")
    .getList<Quiz>(idx + 1, 1, {
      filter: `user = "${userId}"`,
      requestKey: `random-quiz-pick-${idx}`,
    })
    .catch(() => null);
  const quiz = quizzes?.items[0];
  if (!quiz) return null;
  return {
    kind: "quiz",
    id: quiz.id,
    title: quiz.title || "Untitled quiz",
    detail: `${(quiz.questions ?? []).length} questions · ${quiz.total_points ?? 0} pts`,
    href: { to: "/study/quiz/$quizId", params: { quizId: quiz.id } },
  };
}
