import { createFileRoute } from "@tanstack/react-router";
import { Lock, Server, Shield, Sparkles, UserCheck } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

interface Section {
  icon: typeof Lock;
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    icon: UserCheck,
    title: "Who can see your data",
    body: [
      "Every collection in Converge is user-scoped: list/view/update/delete rules require @request.auth.id = user.id (see backend/pb_migrations/1777570000_security_rules.js). Other authenticated users cannot read your records — even an admin would have to log in as you to see them.",
      "Multiplayer quiz sessions are the one exception: any authenticated user can read a session row by code so /play can resolve it before the user is enrolled. Their participant + answer rows are still scoped to themselves and the host.",
    ],
  },
  {
    icon: Server,
    title: "Where your data lives",
    body: [
      "Converge runs against a PocketBase instance you control. Notes, lectures, transcripts, flashcards, quizzes, ASL clip frames, knowledge chunks, and goal records are stored in pb_data/ on that machine.",
      "Audio captured during /capture is processed locally (Whisper-on-device) by default. The transcript is what lands in the database; the audio file is associated with the lecture row.",
    ],
  },
  {
    icon: Sparkles,
    title: "When AI providers see your data",
    body: [
      "AI features (inline writing assistance, generate flows, the knowledge ask, the daily digest) only call an LLM provider if a server-side API key is configured. Your Converge server proxies the call so the API key never reaches the browser.",
      "The exact data sent to the provider is the request payload — usually the page or selection text, plus retrieved citation snippets. ASL frames, only when /asl is set to a vision-capable provider, are sent as base64 JPEGs to that provider's vision API. Stub providers keep everything local.",
    ],
  },
  {
    icon: Lock,
    title: "What's stored client-side",
    body: [
      "Authentication tokens are kept in PocketBase's standard authStore (localStorage). A handful of small UI preferences also live in localStorage under the converge:* prefix — knowledge filter selection, recent searches, ASL provider choice, journal drafts, focus length, and the onboarding checklist. Clearing site data resets these without affecting the server.",
    ],
  },
  {
    icon: Shield,
    title: "Exporting and deleting",
    body: [
      "Use /backup to bundle every supported collection into a single converge.backup.v1 JSON. /export gives per-deck and per-course downloads. Deleting a course / lecture / note via the UI is immediate and permanent (no soft delete except for archived note pages, which surface in /trash).",
    ],
  },
];

function PrivacyPage() {
  return (
    <AppShell>
      <PageHeader
        title="Privacy"
        subtitle="What Converge stores, where, and who can see it."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-6">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section
              key={s.title}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                {s.title}
              </h2>
              <div className="space-y-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
