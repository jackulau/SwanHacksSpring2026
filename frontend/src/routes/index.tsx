import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { ConvergeLogo } from "../components/layout/ConvergeLogo";
import { pb } from "../lib/pocketbase";
import { useStudyStreak } from "../hooks/useStudyStreak";
import { HeroHeader } from "../components/dashboard/HeroHeader";
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentNotesDropdown } from "../components/dashboard/RecentNotesDropdown";
import { UpcomingClasses } from "../components/dashboard/UpcomingClasses";
import type { Lecture } from "../lib/types";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LandingPage />;
  return (
    <AppShell>
      <Dashboard
        userId={user.id}
        email={user.email}
        displayName={user.display_name}
      />
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════
   Landing Page (public)
   ───────────────────────────────────────────────
   Cream / forest-green academic landing page.
   Restrained typography, no gradients, no glass.
   ═══════════════════════════════════════════════ */

function LandingPage() {
  return (
    <div className="min-h-screen text-[var(--color-text)] bg-[var(--color-bg)] font-atkinson">
      <LandingHeader />
      <HeroSection />
      <WorkflowSection />
      <FeatureGrid />
      <AccessibilityBlock />
      <DemoMockup />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────── */

function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 text-[var(--color-primary)]">
          <ConvergeLogo className="w-6 h-6" />
          <span className="text-lg font-brand font-semibold tracking-tight text-[var(--color-text)]">
            Converge
          </span>
        </a>
        <nav aria-label="Primary" className="hidden md:flex items-center gap-8 text-sm text-[var(--color-text-muted)]">
          <a href="#features" className="hover:text-[var(--color-text)] transition-colors">Features</a>
          <a href="#workflow" className="hover:text-[var(--color-text)] transition-colors">Workflow</a>
          <a href="#accessibility" className="hover:text-[var(--color-text)] transition-colors">Accessibility</a>
          <a href="#demo" className="hover:text-[var(--color-text)] transition-colors">Demo</a>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
        >
          Try Converge
        </Link>
      </div>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section id="top" className="px-6 lg:px-10 pt-20 pb-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)] mb-6">
            For students, by students
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-brand font-semibold tracking-tight leading-[1.05]">
            Turn lectures into{" "}
            <span className="text-[var(--color-primary)]">study systems.</span>
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] mt-7 max-w-xl leading-relaxed">
            Converge captures class content, organizes it by course, and turns it
            into notes, flashcards, quizzes, and accessible study tools — without
            forcing students to switch between five different apps.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-10">
            <Link
              to="/login"
              className="inline-flex items-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold px-7 py-3 rounded-md text-sm transition-colors"
            >
              Start studying
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center border border-[var(--color-border-strong)] text-[var(--color-text)] font-semibold px-7 py-3 rounded-md text-sm hover:bg-[var(--color-surface-raised)] transition-colors"
            >
              View demo
            </a>
          </div>
        </div>
        <div className="lg:col-span-5">
          <HeroAppPreview />
        </div>
      </div>
    </section>
  );
}

/* Compact static product preview, mirrors AppShell layout. */
function HeroAppPreview() {
  const sidebarItems = ["Today", "Record", "Notes", "Calendar", "Study"];
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_48px_-30px_rgba(47,93,79,0.35)] overflow-hidden">
      <div className="grid grid-cols-[140px_1fr] min-h-[360px]">
        {/* Sidebar */}
        <aside className="bg-[var(--color-sidebar)] text-white px-4 py-5 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-6">
            <ConvergeLogo className="w-4 h-4 text-white" />
            <span className="text-xs font-brand font-semibold tracking-tight">
              Converge
            </span>
          </div>
          {sidebarItems.map((label, i) => (
            <div
              key={label}
              className={`px-2 py-1.5 rounded text-[11px] tracking-wide ${
                i === 0 ? "bg-white/15 text-white" : "text-white/60"
              }`}
            >
              {label}
            </div>
          ))}
        </aside>
        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">Today</p>
            <p className="text-base font-semibold mt-1">Cognitive Science · Lecture 7</p>
          </div>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--color-error)]" />
            <span className="text-xs text-[var(--color-text-muted)] flex-1">Recording · 14:22</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Live captions</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded bg-[var(--color-surface-raised)]" />
            <div className="h-2 rounded bg-[var(--color-surface-raised)] w-[88%]" />
            <div className="h-2 rounded bg-[var(--color-surface-raised)] w-[72%]" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Notes</p>
              <p className="text-sm font-semibold mt-1">8 blocks</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Cards</p>
              <p className="text-sm font-semibold mt-1">22 due</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Quiz</p>
              <p className="text-sm font-semibold mt-1">10 q</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Workflow (node visual) ──────────────────────────────────────────── */

function WorkflowSection() {
  // Five children fanning out from the Converge hub.
  const children: { label: string; caption: string }[] = [
    { label: "Capture", caption: "Live audio or uploaded lecture material." },
    { label: "Transcribe", caption: "Real-time captions and clean, searchable transcripts." },
    { label: "Generate", caption: "Structured notes, flashcards, and quizzes automatically." },
    { label: "Connect", caption: "Links study material to courses and assignments." },
    { label: "Access", caption: "ASL fingerspelling-to-text, reading ruler, focus mode, and TTS." },
  ];
  // Card-center x positions (in viewBox %) used for both the SVG lines
  // and the small endpoint dots — keeps the geometry in one place.
  const anchors = [10, 30, 50, 70, 90];
  return (
    <section
      id="workflow"
      className="px-6 lg:px-10 py-24 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl sm:text-5xl font-brand font-semibold tracking-tight max-w-3xl">
          Everything converges into one study flow.
        </h2>
        <p className="text-[var(--color-text-muted)] mt-5 max-w-2xl text-base leading-relaxed">
          A single pipeline takes class content from your microphone or upload
          to a finished study system you can actually use the night before.
        </p>

        <div className="mt-16 flex flex-col items-center">
          {/* Central hub — Converge logo + wordmark, the convergence point. */}
          <div className="relative z-10 inline-flex flex-col items-center gap-2 rounded-2xl bg-[var(--color-primary)] text-white px-12 py-6 shadow-[0_22px_44px_-26px_rgba(47,93,79,0.55)]">
            <ConvergeLogo className="w-9 h-9 text-white" />
            <span className="text-2xl font-brand font-semibold tracking-tight">
              Converge
            </span>
          </div>

          {/* Connector area — fanning lines visible md+. Mobile collapses to a thin spacer. */}
          <div className="relative w-full h-8 md:h-24" aria-hidden="true">
            <svg
              className="absolute inset-0 w-full h-full text-[var(--color-primary)]/40 hidden md:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {anchors.map((x) => (
                <line
                  key={x}
                  x1={50}
                  y1={0}
                  x2={x}
                  y2={100}
                  stroke="currentColor"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {/* Single anchor dot at the hub side. */}
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--color-primary)] hidden md:block" />
            {/* Five anchor dots — one above each child card. */}
            {anchors.map((x) => (
              <span
                key={x}
                style={{ left: `${x}%` }}
                className="absolute bottom-0 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[var(--color-primary)] hidden md:block"
              />
            ))}
          </div>

          {/* Five child cards — fan endpoints. */}
          <ol className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-5">
            {children.map((node, i) => (
              <li
                key={node.label}
                style={{ animationDelay: `${i * 90}ms` }}
                className="workflow-card group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--color-primary)]/45 hover:shadow-[0_18px_36px_-22px_rgba(47,93,79,0.4)]"
              >
                <h3 className="text-lg font-brand font-semibold tracking-tight transition-colors duration-300 group-hover:text-[var(--color-primary)]">
                  {node.label}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-2">
                  {node.caption}
                </p>
                {/* Small accent dot — fades in on hover. */}
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                {/* Underline accent — grows from 0 to short width on hover. */}
                <span
                  aria-hidden="true"
                  className="block mt-3 h-px w-0 bg-[var(--color-primary)] transition-[width] duration-400 ease-out group-hover:w-10"
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── Feature section ─────────────────────────────────────────────────── */

const features: { title: string; caption: string }[] = [
  { title: "Recording", caption: "Live audio in the browser." },
  { title: "Transcripts", caption: "Searchable and time-coded." },
  { title: "Notes", caption: "Structured automatically." },
  { title: "Cards & quizzes", caption: "Spaced repetition built in." },
  { title: "Calendar", caption: "Lectures and assignments together." },
  { title: "Due-aware studying", caption: "Surfaces what's next." },
  { title: "Accessibility", caption: "Ruler, focus, TTS, contrast." },
  { title: "Sign language", caption: "ASL fingerspelling to text." },
];

function FeatureGrid() {
  return (
    <section
      id="features"
      className="px-6 lg:px-10 py-24 border-t border-[var(--color-border)] scroll-mt-20"
    >
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl sm:text-5xl font-brand font-semibold tracking-tight">
          Features.
        </h2>
        <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">
          {features.map((f) => (
            <li key={f.title}>
              <h3 className="text-base font-brand font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mt-1.5">
                {f.caption}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Accessibility ───────────────────────────────────────────────────── */

function AccessibilityBlock() {
  const aids: { label: string; body: string }[] = [
    { label: "Captions & transcripts", body: "Live captions during recording. Searchable transcripts after." },
    { label: "Text-to-speech", body: "Listen to any note or transcript with adjustable voice and pace." },
    { label: "Reading ruler & focus mode", body: "Quiet the page so the only thing on screen is what you're reading." },
    { label: "ASL fingerspelling", body: "Sign letters into your webcam, see them in the live caption stream." },
  ];
  return (
    <section id="accessibility" className="px-6 lg:px-10 py-24 border-t border-[var(--color-border)] scroll-mt-20">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-primary)] mb-5">
            Built in, not bolted on
          </p>
          <h2 className="text-4xl sm:text-5xl font-brand font-semibold tracking-tight leading-tight">
            Accessibility is not a side feature.
          </h2>
          <p className="text-[var(--color-text-muted)] mt-6 text-base leading-relaxed">
            Converge is designed for students who need different ways to process
            class content. Captions, text-to-speech, focus mode, reading ruler,
            and sign-language support are part of the product — not an add-on
            you have to ask for.
          </p>
        </div>
        <dl className="lg:col-span-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {aids.map((aid) => (
            <div
              key={aid.label}
              className="grid sm:grid-cols-[200px_1fr] gap-y-1 gap-x-8 py-5"
            >
              <dt className="text-base font-brand font-semibold tracking-tight text-[var(--color-text)]">
                {aid.label}
              </dt>
              <dd className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {aid.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Demo mockup ─────────────────────────────────────────────────────── */

function DemoMockup() {
  return (
    <section id="demo" className="px-6 lg:px-10 py-24 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-4xl sm:text-5xl font-brand font-semibold tracking-tight">
              See how it fits together.
            </h2>
            <p className="text-[var(--color-text-muted)] mt-4 max-w-xl text-base leading-relaxed">
              The Converge workspace mirrors how a class week actually unfolds —
              record, organize, and study without leaving the page.
            </p>
          </div>
          <Link
            to="/login"
            className="self-start sm:self-end text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline-offset-4 hover:underline"
          >
            Open the live app →
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_60px_-40px_rgba(47,93,79,0.35)] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] min-h-[480px]">
            <DemoSidebar />
            <div className="grid grid-rows-[auto_1fr]">
              <DemoTopRow />
              <DemoBottomRow />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoSidebar() {
  const items: { label: string; active?: boolean }[] = [
    { label: "Today", active: true },
    { label: "Record" },
    { label: "Notes" },
    { label: "Calendar" },
    { label: "Assignments" },
    { label: "Accessibility" },
  ];
  return (
    <aside className="bg-[var(--color-sidebar)] text-white/85 p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-6 text-white">
        <ConvergeLogo className="w-5 h-5" />
        <span className="text-sm font-brand font-semibold">Converge</span>
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className={`px-2.5 py-1.5 rounded text-xs ${
            item.active ? "bg-white/15 text-white" : "text-white/65"
          }`}
        >
          {item.label}
        </div>
      ))}
    </aside>
  );
}

function DemoTopRow() {
  return (
    <div className="grid md:grid-cols-2 border-b border-[var(--color-border)]">
      <div className="p-5 border-r border-[var(--color-border)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Record</p>
        <p className="text-sm font-semibold mt-1">Cognitive Science · Lecture 7</p>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 mt-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--color-error)] animate-pulse" />
          <span className="text-xs text-[var(--color-text-muted)] flex-1">14:22 · live captions on</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">EN</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 rounded bg-[var(--color-surface-raised)]" />
          <div className="h-2 rounded bg-[var(--color-surface-raised)] w-[78%]" />
          <div className="h-2 rounded bg-[var(--color-primary-soft)] w-[64%]" />
        </div>
      </div>
      <div className="p-5">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Calendar · This week</p>
        <p className="text-sm font-semibold mt-1">May 4 — May 10</p>
        <div className="grid grid-cols-7 gap-1 mt-3 text-[10px] text-[var(--color-text-subtle)]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="text-center font-semibold">
              {d}
            </div>
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-md border ${
                i === 2
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                  : i === 4
                    ? "bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30"
                    : "border-[var(--color-border)]"
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
          Lecture
          <span className="w-2 h-2 rounded-full bg-[var(--color-primary-soft)] ml-2" />
          Assignment
        </div>
      </div>
    </div>
  );
}

function DemoBottomRow() {
  return (
    <div className="grid md:grid-cols-2">
      <div className="p-5 border-r border-[var(--color-border)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Notes · Auto-generated</p>
        <p className="text-sm font-semibold mt-1">Memory & encoding</p>
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-[var(--color-border)] p-3">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-primary)]">Key term</p>
            <p className="text-xs text-[var(--color-text)] mt-1">Working memory: limited-capacity store for active processing.</p>
          </div>
          <div className="rounded-md border border-[var(--color-border)] p-3">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">Example</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Phone number rehearsed silently before dialing.</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Study · Cards due</p>
        <p className="text-sm font-semibold mt-1">22 cards · 3 courses</p>
        <div className="mt-3 space-y-2">
          {[
            { course: "COGS 200", count: 12 },
            { course: "BIO 201", count: 7 },
            { course: "MATH 301", count: 3 },
          ].map((row) => (
            <div
              key={row.course}
              className="flex items-center justify-between rounded-md border border-[var(--color-border)] p-2.5"
            >
              <span className="text-xs font-semibold">{row.course}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{row.count} due</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="px-6 lg:px-10 py-28 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-brand font-semibold tracking-tight leading-tight">
          One place for class, notes, and studying.
        </h2>
        <p className="text-[var(--color-text-muted)] mt-5 max-w-xl mx-auto text-base leading-relaxed">
          Try Converge with your next lecture. It's free for students and works
          in any modern browser.
        </p>
        <div className="mt-10">
          <Link
            to="/login"
            className="inline-flex items-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold px-8 py-3.5 rounded-md text-sm transition-colors"
          >
            Try Converge
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */

function LandingFooter() {
  return (
    <footer className="px-6 lg:px-10 py-10 border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[var(--color-text-subtle)] text-sm">
          <ConvergeLogo className="w-4 h-4" />
          <span>Converge — built around how students actually learn.</span>
        </div>
        <p className="text-xs text-[var(--color-text-subtle)]">
          © {new Date().getFullYear()} Converge
        </p>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════
   Dashboard (authenticated)
   ═══════════════════════════════════════════════ */

interface DashboardProps {
  userId: string;
  email: string;
  displayName?: string;
}

function Dashboard({ userId, email, displayName }: DashboardProps) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [dueCount, setDueCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const streak = useStudyStreak();

  useEffect(() => {
    let cancelled = false;
    const nowIso = new Date().toISOString();
    Promise.all([
      pb
        .collection("lectures")
        .getList<Lecture>(1, 8, {
          filter: `user = "${userId}"`,
          sort: "-recorded_at",
        })
        .then((r) => r.items)
        .catch(() => [] as Lecture[]),
      pb
        .collection("flashcards")
        .getList(1, 1, {
          // Match the rule used by useSM2.getDueCards — new cards (empty
          // next_review) also count as due, otherwise the dashboard hides
          // brand-new cards and the hub disagrees with the deck.
          filter: `user = "${userId}" && (next_review <= "${nowIso}" || next_review = "")`,
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ]).then(([l, d]) => {
      if (cancelled) return;
      setLectures(l);
      setDueCount(d);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const greetingName =
    (displayName && displayName.trim()) || email.split("@")[0];

  return (
    <div>
      <HeroHeader
        name={greetingName}
        streak={streak.streak}
        todayCompleted={streak.todayCompleted}
        streakLoading={streak.loading}
      />

      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          <QuickActions
            dueCount={loading ? null : dueCount}
            loading={loading}
          />

          <hr className="border-[var(--color-border)]" />

          <UpcomingClasses userId={userId} />

          <hr className="border-[var(--color-border)]" />

          <RecentNotesDropdown
            lectures={lectures}
            loading={loading}
            variant="card"
          />
        </div>
      </div>
    </div>
  );
}
