import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Gamepad2, Loader2 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { findSessionByCode, joinSession } from "../lib/multiplayer";

export const Route = createFileRoute("/play")({
  component: PlayJoinPage,
  validateSearch: (search): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
});

function PlayJoinPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [code, setCode] = useState<string>(search.code?.toUpperCase() ?? "");
  const [displayName, setDisplayName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user && !displayName) {
      setDisplayName(user.display_name || user.email?.split("@")[0] || "Player");
    }
  }, [user, displayName]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Codes are 6 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const session = await findSessionByCode(trimmed);
      if (!session) {
        setError("No game with that code. Double-check with the host.");
        return;
      }
      if (session.state === "complete") {
        setError("That game already ended.");
        return;
      }
      await joinSession({
        sessionId: session.id,
        userId: user.id,
        displayName: displayName.trim() || "Player",
      });
      navigate({ to: "/game/$sessionId", params: { sessionId: session.id } });
    } catch {
      setError("Could not join the session. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader title="Join a game" subtitle="Enter the 6-character code" />
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-md mx-auto">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="mb-5 inline-flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
            <Gamepad2 className="w-4 h-4" aria-hidden="true" />
            <span>The host will share a code with you.</span>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                Code
              </span>
              <input
                inputMode="text"
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                placeholder="A2X4P9"
                className="w-full bg-transparent border border-[var(--color-border)] rounded px-3 h-11 text-center font-mono text-2xl tracking-[0.4em] text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                Display name
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
                className="w-full bg-transparent border border-[var(--color-border)] rounded px-3 h-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
                placeholder="Your name"
              />
            </label>

            {error && (
              <div className="text-sm text-[var(--color-error)]">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-10 rounded-md disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              )}
              {submitting ? "Joining…" : "Join"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-xs text-[var(--color-text-subtle)] text-center">
          Hosting a game? Open a quiz from{" "}
          <a className="underline" href="/study">
            Study
          </a>{" "}
          and choose Multiplayer.
        </p>
      </div>
    </AppShell>
  );
}
