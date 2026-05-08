import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FlaskConical,
  HelpCircle,
  Layers,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { resolveProvider } from "../lib/llm/providers";
import { flashcardsFromText } from "../lib/generate";
import { toast } from "../lib/toasts";

export const Route = createFileRoute("/sandbox")({
  component: SandboxPage,
});

type Mode = "summary" | "flashcards" | "questions";

function SandboxPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("summary");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const run = async () => {
    if (!user || !text.trim() || busy) return;
    setBusy(true);
    setOutput("");
    try {
      if (mode === "flashcards") {
        const out = await flashcardsFromText(text, {
          userId: user.id,
          deckName: `Sandbox ${new Date().toLocaleDateString()}`,
          provider: "anthropic",
          maxCards: 8,
        });
        setOutput(`Created ${out.cardsCreated} cards in deck "${out.deckName}".`);
        toast.success(
          `${out.cardsCreated} cards`,
          `Deck: ${out.deckName}`,
        );
        return;
      }
      const provider = await resolveProvider("anthropic");
      const prompt =
        mode === "summary"
          ? `Summarize the following passage in one tight paragraph.\n\n${text}`
          : `Read the following and generate 5 study questions, one per line, no numbering.\n\n${text}`;
      const completion = await provider.complete(
        [
          {
            role: "system",
            content:
              "You are a focused study tool. Output only the requested artifact. No preamble.",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.4, maxTokens: 600 },
      );
      setOutput(completion.text || "");
    } catch {
      toast.error("Generation failed", "Try again later.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Sandbox"
        subtitle="Paste any text. Pick a mode. Generate."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-4">
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <FlaskConical
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            Sandbox is the no-commit version of Generate. Nothing persists
            unless you choose Flashcards (which writes a deck so you can
            review the cards later).
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          autoFocus
          placeholder="Paste a passage, transcript fragment, anything you want to chew on…"
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] outline-none"
        />

        <div className="flex flex-wrap gap-1.5">
          {(["summary", "flashcards", "questions"] as const).map((m) => {
            const Icon =
              m === "summary"
                ? Sparkles
                : m === "flashcards"
                  ? Layers
                  : HelpCircle;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`text-[11px] px-2.5 h-7 rounded-full border inline-flex items-center gap-1 ${
                  mode === m
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {m}
              </button>
            );
          })}
          <button
            type="button"
            onClick={run}
            disabled={busy || !text.trim()}
            className="ml-auto inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-8 rounded-md disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="w-4 h-4" aria-hidden="true" />
            )}
            Run
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {output && (
          <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed font-sans">
            {output}
          </pre>
        )}
      </div>
    </AppShell>
  );
}
