import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Keyboard } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/shortcuts")({
  component: ShortcutsPage,
});

interface Group {
  title: string;
  rows: Array<{ keys: string[]; label: string }>;
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function ShortcutsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const cmd = isMacPlatform() ? "⌘" : "Ctrl";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  if (authLoading || !user) return null;

  const groups: Group[] = [
    {
      title: "Global",
      rows: [
        { keys: [cmd, "K"], label: "Open command palette" },
        { keys: [cmd, "J"], label: "Quick capture composer" },
        { keys: ["?"], label: "Show shortcuts overlay" },
      ],
    },
    {
      title: "Navigation (g, then…)",
      rows: [
        { keys: ["g", "h"], label: "Home" },
        { keys: ["g", "n"], label: "Notes" },
        { keys: ["g", "c"], label: "Calendar" },
        { keys: ["g", "s"], label: "Study" },
        { keys: ["g", "o"], label: "Courses" },
        { keys: ["g", "r"], label: "Capture" },
        { keys: ["g", "t"], label: "Planner" },
        { keys: ["g", "d"], label: "Today dashboard" },
        { keys: ["g", "k"], label: "Knowledge" },
        { keys: ["g", "a"], label: "ASL chat" },
        { keys: ["g", "v"], label: "Voice note" },
        { keys: ["g", "p"], label: "Multiplayer / Play" },
        { keys: ["g", "x"], label: "Activity feed" },
        { keys: ["g", "l"], label: "Lab — system status" },
      ],
    },
    {
      title: "Notes",
      rows: [
        { keys: [cmd, "F"], label: "Find inside the page" },
        { keys: ["/"], label: "Open the slash menu" },
        { keys: ["@"], label: "Mention page / lecture / course" },
      ],
    },
    {
      title: "Multiplayer game",
      rows: [
        { keys: ["1-9 / a-z"], label: "Pick multiple-choice option" },
        { keys: ["t / f"], label: "True / False answer" },
      ],
    },
    {
      title: "ASL",
      rows: [
        { keys: ["Click low-conf row"], label: "Re-sign that segment" },
        { keys: ["Frame thumbnail"], label: "Open frame replay" },
      ],
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Shortcuts"
        subtitle="Every keyboard shortcut Converge ships with."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2 inline-flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
              {g.title}
            </h2>
            <ul className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {g.rows.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="flex-1 text-[var(--color-text)]">
                    {r.label}
                  </span>
                  <span className="flex items-center gap-1">
                    {r.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
