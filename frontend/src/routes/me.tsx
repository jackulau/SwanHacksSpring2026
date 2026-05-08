import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Database,
  Loader2,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { useStudyStreak } from "../hooks/useStudyStreak";
import { pb } from "../lib/pocketbase";

export const Route = createFileRoute("/me")({
  component: MePage,
});

interface QuickCounts {
  notes: number;
  lectures: number;
  flashcards: number;
  quizzes: number;
}

function MePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const streak = useStudyStreak();
  const [counts, setCounts] = useState<QuickCounts | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      pb.collection("note_pages").getList(1, 1, {
        filter: `user = "${user.id}" && archived = false`,
        requestKey: "me-notes",
      }).then((r) => r.totalItems).catch(() => 0),
      pb.collection("lectures").getList(1, 1, {
        filter: `user = "${user.id}"`,
        requestKey: "me-lectures",
      }).then((r) => r.totalItems).catch(() => 0),
      pb.collection("flashcards").getList(1, 1, {
        filter: `user = "${user.id}"`,
        requestKey: "me-flashcards",
      }).then((r) => r.totalItems).catch(() => 0),
      pb.collection("quizzes").getList(1, 1, {
        filter: `user = "${user.id}"`,
        requestKey: "me-quizzes",
      }).then((r) => r.totalItems).catch(() => 0),
    ]).then(([notes, lectures, flashcards, quizzes]) => {
      if (cancelled) return;
      setCounts({ notes, lectures, flashcards, quizzes });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader title="Account" subtitle="Your profile and library at a glance." />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-6">
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] flex items-center justify-center">
            <UserIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              {user.display_name || user.email.split("@")[0]}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1">
              <Mail className="w-3 h-3" aria-hidden="true" />
              {user.email}
            </div>
          </div>
          <Award
            className="w-4 h-4 text-[var(--color-primary)]"
            aria-hidden="true"
          />
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            {streak.streak}d streak
          </span>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            Library
          </h2>
          {counts === null ? (
            <div className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
              <Loader2
                className="w-4 h-4 animate-spin"
                aria-hidden="true"
              />
              Counting…
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Tile label="Notes" value={counts.notes} to="/notes" />
              <Tile label="Lectures" value={counts.lectures} to="/courses" />
              <Tile label="Cards" value={counts.flashcards} to="/decks" />
              <Tile label="Quizzes" value={counts.quizzes} to="/study" />
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
            <SettingsIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Settings
          </h2>
          <ul className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            <Row to="/settings" label="Preferences" />
            <Row to="/settings/accessibility" label="Accessibility" />
            <Row to="/backup" label="Backup library" />
            <Row to="/lab" label="Lab — system status" />
          </ul>
        </section>

        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] text-sm px-3 h-9 rounded-md"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)] block"
      >
        <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
        <div className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
          {value.toLocaleString()}
        </div>
      </Link>
    </li>
  );
}

function Row({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
      >
        <span className="flex-1">{label}</span>
        <ArrowRight
          className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

