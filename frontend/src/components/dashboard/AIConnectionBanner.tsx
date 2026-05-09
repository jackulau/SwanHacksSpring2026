import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { testLLMConnection } from "../../lib/ai-pipeline";

const LAST_OK_KEY = "converge_ai_last_ok_ts";
const DISMISS_KEY = "converge_ai_banner_dismissed_ts";
const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Non-blocking banner that warns the user if the configured LLM provider
 * isn't reachable. Runs `testLLMConnection` on mount, but only when the last
 * successful check is older than 24 hours — we don't want to ping the
 * provider every render.
 *
 * Dismissals are remembered for 24 hours so users on intentionally-offline
 * setups (e.g. recording without AI) aren't pestered.
 */
export function AIConnectionBanner() {
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) ?? "");
      return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) return;

    let cancelled = false;
    let lastOk = 0;
    try {
      lastOk = Number(localStorage.getItem(LAST_OK_KEY) ?? "0");
    } catch {
      lastOk = 0;
    }
    if (Number.isFinite(lastOk) && Date.now() - lastOk < RECHECK_INTERVAL_MS) {
      return;
    }

    testLLMConnection()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          try {
            localStorage.setItem(LAST_OK_KEY, String(Date.now()));
          } catch {
            /* unavailable */
          }
          setError(null);
        } else {
          setError(res.error || "AI provider not reachable");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "AI provider not reachable");
      });

    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  if (dismissed || !error) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm"
    >
      <AlertTriangle
        className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]"
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-[var(--color-text)] font-medium">
          AI model isn't reachable
        </p>
        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
          Generation (notes, flashcards, quizzes) will fail until this is fixed.{" "}
          <Link
            to="/settings"
            className="underline underline-offset-2 hover:text-[var(--color-text)] transition-colors"
          >
            Configure in Settings → AI Model
          </Link>
          .
        </p>
        <p className="text-[var(--color-text-subtle)] text-[11px] mt-0.5">
          {error}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
          } catch {
            /* unavailable */
          }
        }}
        aria-label="Dismiss for 24 hours"
        className="-mr-1 -mt-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
