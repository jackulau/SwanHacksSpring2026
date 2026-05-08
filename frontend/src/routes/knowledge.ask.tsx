import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { retrieve, type Retrieved } from "../lib/knowledge/retrieve";
import { sourceHref } from "./knowledge";

export const Route = createFileRoute("/knowledge/ask")({
  component: AskPage,
});

interface Turn {
  id: string;
  question: string;
  answer: string;
  citations: Retrieved[];
  pending: boolean;
}

const HISTORY_STORAGE_KEY = "converge:knowledge:ask:history";
const HISTORY_MAX = 20;

function loadHistory(): Turn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    return parsed
      .filter((t) => t && typeof t.question === "string")
      .map((t) => ({ ...t, pending: false }));
  } catch {
    return [];
  }
}

function saveHistory(turns: Turn[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = turns.slice(-HISTORY_MAX).map((t) => ({
      ...t,
      pending: false,
    }));
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(trimmed),
    );
  } catch {
    // ignore quota
  }
}

function AskPage() {
  const { user } = useAuth();
  const [turns, setTurns] = useState<Turn[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  // Persist conversation history so a refresh doesn't drop the
  // user's recent threads. Keep it bounded so localStorage doesn't
  // blow up on long sessions.
  useEffect(() => {
    saveHistory(turns);
  }, [turns]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !input.trim() || loading) return;
    const question = input.trim();
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setInput("");
    setLoading(true);
    setTurns((prev) => [
      ...prev,
      {
        id,
        question,
        answer: "",
        citations: [],
        pending: true,
      },
    ]);
    try {
      const citations = await retrieve(user.id, question, {
        topK: 8,
        expandGraph: true,
      });
      const answer = await answerWith(question, citations);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, answer, citations, pending: false } : t,
        ),
      );
    } catch {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                answer:
                  "Couldn't reach an LLM provider. Configured providers will surface here once a server-side hook is wired.",
                pending: false,
              }
            : t,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto">
      <div
        ref={scrollRef}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 max-h-[60vh] overflow-y-auto space-y-5 mb-4"
      >
        {turns.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-text-muted)] py-8 flex flex-col items-center gap-2">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            <p>
              Ask anything you've captured — notes, lectures, flashcards. The
              answer cites the source rows it pulled.
            </p>
          </div>
        ) : (
          turns.map((t) => <TurnRow key={t.id} turn={t} />)
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Ask your knowledge"
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 h-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-10 rounded-md disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
          Ask
        </button>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear the conversation?")) setTurns([]);
            }}
            aria-label="Clear conversation"
            className="inline-flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] text-sm w-10 h-10 rounded-md"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}

function TurnRow({ turn }: { turn: Turn }) {
  const [copied, setCopied] = useState(false);
  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };
  return (
    <div className="space-y-3 group">
      <div className="rounded bg-[var(--color-surface-raised)]/60 px-3 py-2 text-sm text-[var(--color-text)]">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-2">
          You
        </span>
        {turn.question}
      </div>
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] relative">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mr-2">
          Converge
        </span>
        {turn.pending ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            Searching your library…
          </span>
        ) : (
          <span className="whitespace-pre-wrap leading-relaxed">{turn.answer}</span>
        )}
        {!turn.pending && turn.answer && (
          <button
            type="button"
            onClick={copyAnswer}
            aria-label="Copy answer"
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" />
            ) : (
              <Copy className="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {turn.citations.length > 0 && (
        <div className="pl-2 border-l border-[var(--color-border)] text-xs">
          <div className="uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
            Sources
          </div>
          <ul className="space-y-1">
            {turn.citations.slice(0, 6).map((c, i) => {
              const href = sourceHref(c.chunk.source_type, c.chunk.source_id);
              const inner = (
                <span className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  [{i + 1}] {c.chunk.title || "Untitled"}
                  <span className="text-[var(--color-text-subtle)] ml-1.5">
                    {c.chunk.source_type}
                  </span>
                </span>
              );
              return (
                <li key={c.chunk.id} className="truncate">
                  {href ? <a href={href}>{inner}</a> : inner}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Answer the question — either via a configured LLM hook or, when
 * none exists, by composing a deterministic stub answer that quotes
 * the top retrievals so the surface is still useful. The endpoint
 * `/api/knowledge/ask` is reserved for the real implementation.
 */
async function answerWith(question: string, citations: Retrieved[]): Promise<string> {
  // Probe the server-side hook. 404 means it's not wired yet.
  try {
    const { pbAuthedHeaders } = await import("../lib/http");
    const res = await fetch("/api/knowledge/ask", {
      method: "POST",
      headers: pbAuthedHeaders(),
      body: JSON.stringify({
        question,
        citations: citations.slice(0, 6).map((c, i) => ({
          index: i + 1,
          source_type: c.chunk.source_type,
          source_id: c.chunk.source_id,
          title: c.chunk.title,
          text: c.chunk.text,
        })),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answer?: string };
      if (data.answer) return data.answer;
    }
  } catch {
    // fall through
  }
  // Stub: synthesize a readable response from retrievals.
  if (citations.length === 0) {
    return "I couldn't find anything in your library that matches. Try rephrasing or running a backfill from the Search tab so this is up-to-date.";
  }
  const lines: string[] = [];
  lines.push(`Here's what your library says about "${question}":`);
  lines.push("");
  for (let i = 0; i < Math.min(citations.length, 4); i++) {
    const c = citations[i];
    const snippet = (c.chunk.text || "").slice(0, 280).trim();
    lines.push(`[${i + 1}] ${c.chunk.title || "Untitled"} — ${snippet}…`);
  }
  lines.push("");
  lines.push(
    "(No LLM provider configured; this fallback shows top retrievals verbatim. Wire /api/knowledge/ask in pb_hooks to enable streamed synthesis.)",
  );
  return lines.join("\n");
}
