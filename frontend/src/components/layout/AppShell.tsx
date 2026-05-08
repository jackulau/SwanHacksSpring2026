/**
 * App shell — Converge dark scheme.
 *
 * Layout:
 *   ┌──────────┬──────────────────────────────────────────────────────────┐
 *   │ sidebar  │  header band (greeting / page title + user dropdown)     │
 *   │  (#000)  ├──────────────────────────────────────────────────────────┤
 *   │          │  page content                                            │
 *   └──────────┴──────────────────────────────────────────────────────────┘
 *
 * The header is rendered by the page (via `<HeroHeader>` on the dashboard,
 * `<PageHeader>` everywhere else) so each page owns its own greeting/title
 * surface — that mirrors the mockup where the grey "band" extends through
 * the greeting card.
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../lib/auth";
import { ReadingRuler } from "../accessibility/ReadingRuler";
import { FocusMode } from "../accessibility/FocusMode";
import { A11yPanel } from "../accessibility/A11yPanel";
import { AudioPlayer } from "./AudioPlayer";
import { CommandPalette } from "./CommandPalette";
import { QuickCapture } from "./QuickCapture";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Toaster } from "./Toaster";
import { useReadingAidsShortcuts } from "../../hooks/useReadingAidsShortcuts";
import { ConvergeLogo } from "./ConvergeLogo";
import { RecentNotesDropdown } from "../dashboard/RecentNotesDropdown";
import { pb } from "../../lib/pocketbase";
import { useInstallPrompt, useOnlineStatus } from "../../lib/pwa";
import type { Lecture } from "../../lib/types";
import {
  Home,
  Mic,
  Settings,
  Accessibility,
  BookOpen,
  ListTodo,
  Glasses,
  Trash2,
  Calendar,
  LogOut,
  Search,
  FileText,
  Download,
  CloudOff,
  Sparkles,
} from "lucide-react";

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

/**
 * Sidebar items (top group + bottom group). The Notes entry is rendered
 * separately because its dropdown chevron has its own toggle behaviour.
 */
const TOP_NAV: readonly NavItem[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/capture", icon: Mic, label: "Record" },
  { to: "/notes", icon: FileText, label: "Notes" },
];

const BOTTOM_NAV: readonly NavItem[] = [
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/study", icon: Glasses, label: "Study" },
  { to: "/study/planner", icon: ListTodo, label: "To-do" },
  { to: "/trash", icon: Trash2, label: "Trash" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [a11yOpen, setA11yOpen] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState<boolean>(false);

  // Recent lectures for the sidebar Notes dropdown.
  const [recentLectures, setRecentLectures] = useState<Lecture[]>([]);
  const [recentLoading, setRecentLoading] = useState<boolean>(true);

  // PWA: install prompt + online status.
  const { canInstall, prompt: promptInstall } = useInstallPrompt();
  const online = useOnlineStatus();

  // Reset main scroll on route change so users don't land mid-page after
  // navigating from a long page like a transcript.
  useEffect(() => {
    const main = document.getElementById("main");
    if (main) main.scrollTop = 0;
  }, [location.pathname]);

  useReadingAidsShortcuts();

  // Global shortcuts: cmd/ctrl+K palette, ? overlay, g-then-X navigation.
  useEffect(() => {
    let chordPending = false;
    let chordTimer: number | undefined;

    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        node.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the palette regardless of focus context.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // Cmd/Ctrl+J opens the quick-capture composer. Like the palette,
      // it should fire even while typing so users can stash a thought
      // without breaking flow.
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setQuickCaptureOpen((o) => !o);
        return;
      }
      if (isTyping(e.target)) return;

      // ? opens shortcuts (Shift+/ on US layouts).
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // g-then-X chord nav.
      if (chordPending) {
        const k = e.key.toLowerCase();
        chordPending = false;
        if (chordTimer) window.clearTimeout(chordTimer);
        const map: Record<string, string> = {
          h: "/",
          c: "/calendar",
          s: "/study",
          r: "/capture",
          t: "/study/planner",
          o: "/courses",
          n: "/notes",
        };
        const target = map[k];
        if (target) {
          e.preventDefault();
          navigate({ to: target });
        }
        return;
      }
      if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        chordPending = true;
        chordTimer = window.setTimeout(() => {
          chordPending = false;
        }, 900);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (chordTimer) window.clearTimeout(chordTimer);
    };
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setRecentLectures([]);
      setRecentLoading(false);
      return;
    }
    let cancelled = false;
    setRecentLoading(true);
    pb.collection("lectures")
      .getList<Lecture>(1, 6, {
        filter: `user = "${user.id}"`,
        sort: "-recorded_at",
        // Distinct key keeps PB's auto-cancellation from dropping the
        // sidebar's fetch when the dashboard is also fetching lectures.
        requestKey: "shell-recent-lectures",
      })
      .then((res) => {
        if (cancelled) return;
        setRecentLectures(res.items);
        setRecentLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRecentLectures([]);
        setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen text-[var(--color-text)] flex bg-[var(--color-bg)]">
      {/* Skip link — visible only on focus, jumps over the entire sidebar */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-[var(--color-primary)] focus:text-black focus:font-medium"
      >
        Skip to main content
      </a>

      {/* ── Sidebar (desktop only) ── */}
      <aside className="w-64 hidden lg:flex flex-col bg-[var(--color-sidebar)] shrink-0">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 px-5 pt-6 pb-3 text-white hover:opacity-90 transition-opacity"
        >
          <ConvergeLogo className="w-8 h-8 shrink-0" />
          <span className="font-semibold text-2xl tracking-tight">Converge</span>
        </Link>

        {/* Command palette opener — visible affordance. */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-2 flex items-center gap-2 px-2.5 h-8 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white text-xs transition-colors"
          aria-label="Open command palette"
        >
          <span className="flex-1 text-left">Search or jump…</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/[0.12] text-white/80 border border-white/10">
            {isMacPlatform() ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>

        {/* Quick capture opener — sibling to the palette button. Kept
         * subtle (matching weight) so it doesn't fight the primary
         * search affordance for attention. */}
        <button
          type="button"
          onClick={() => setQuickCaptureOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 px-2.5 h-8 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white text-xs transition-colors"
          aria-label="Open quick capture"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="flex-1 text-left">Quick capture…</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/[0.12] text-white/80 border border-white/10">
            {isMacPlatform() ? "⌘J" : "Ctrl J"}
          </kbd>
        </button>

        {/* Nav links */}
        <nav className="flex-1 px-2 overflow-y-auto pb-4">
          <NavGroup items={TOP_NAV} pathname={location.pathname} />

          {/* Notes dropdown — caret-only toggle, label routes to /courses */}
          <div className="my-1">
            <RecentNotesDropdown
              lectures={recentLectures}
              loading={recentLoading}
              variant="sidebar"
            />
          </div>

          <NavGroup items={BOTTOM_NAV} pathname={location.pathname} />
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim top utility bar — only houses the user dropdown.
         * The greeting / page header lives inside the page body so the
         * grey "band" can extend across the greeting card per the mockup. */}
        <header className="h-12 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:hidden bg-[var(--color-sidebar)]">
          <Link to="/" className="flex items-center gap-2 text-white">
            <ConvergeLogo className="w-6 h-6" />
            <span className="font-semibold tracking-tight">Converge</span>
          </Link>
          <div className="flex items-center gap-2">
            {!online && <OfflinePill />}
            {canInstall && <InstallButton onClick={() => void promptInstall()} />}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="w-10 h-10 grid place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/[0.12] transition-colors"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
            <UserMenu
              email={user?.email}
              displayName={user?.display_name}
              open={userMenuOpen}
              onToggle={() => setUserMenuOpen((o) => !o)}
              onClose={() => setUserMenuOpen(false)}
              onLogout={logout}
            />
          </div>
        </header>

        {/* Floating user menu (desktop) — sits on top of the page header band */}
        <div className="hidden lg:flex absolute top-4 right-6 z-30 items-center gap-2">
          {!online && <OfflinePill />}
          {canInstall && <InstallButton onClick={() => void promptInstall()} />}
          <UserMenu
            email={user?.email}
            displayName={user?.display_name}
            open={userMenuOpen}
            onToggle={() => setUserMenuOpen((o) => !o)}
            onClose={() => setUserMenuOpen(false)}
            onLogout={logout}
          />
        </div>

        {/* Page content */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-auto relative focus:outline-none"
          data-focus-zone
          style={{
            paddingBottom: "calc(var(--audio-player-height, 0px))",
          }}
        >
          {children}
        </main>
      </div>

      {/* ── Reading aids ── */}
      <ReadingRuler />
      <FocusMode />
      <A11yPanel isOpen={a11yOpen} onClose={() => setA11yOpen(false)} />
      <AudioPlayer />

      {/* ── Global overlays ── */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onShowShortcuts={() => {
          setPaletteOpen(false);
          setShortcutsOpen(true);
        }}
        onOpenQuickCapture={() => {
          setPaletteOpen(false);
          setQuickCaptureOpen(true);
        }}
      />
      <QuickCapture
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        userId={user?.id}
      />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster />

      {/* Floating accessibility button */}
      <button
        type="button"
        onClick={() => setA11yOpen((open) => !open)}
        className="fixed right-6 w-12 h-12 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-full flex items-center justify-center shadow-lg shadow-black/15 transition-colors z-50"
        style={{
          bottom:
            "calc(1.5rem + var(--mobile-nav-height, 0px) + var(--audio-player-height, 0px))",
        }}
        aria-label="Accessibility settings"
        aria-expanded={a11yOpen}
      >
        <Accessibility className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Nav primitives                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function NavGroup({
  items,
  pathname,
}: {
  items: readonly NavItem[];
  pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isNavItemActive(item.to, pathname);
        return (
          <NavRow
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            active={active}
          />
        );
      })}
    </div>
  );
}

/**
 * Lecture detail (/lectures/:id) and standalone trash/study sub-pages have no
 * exact match in the sidebar — without this, the sidebar reads as if the user
 * is "outside" any section. Treat lectures as a child of Courses, and prefer
 * the most-specific match so /study/planner doesn't also light up "Study".
 */
const NAV_TARGETS = [
  "/",
  "/capture",
  "/courses",
  "/calendar",
  "/study",
  "/study/planner",
  "/trash",
  "/settings",
] as const;

function bestNavMatch(pathname: string): string | null {
  if (pathname.startsWith("/lectures")) return "/courses";
  let best: string | null = null;
  for (const t of NAV_TARGETS) {
    if (pathname === t || (t !== "/" && pathname.startsWith(t))) {
      if (!best || t.length > best.length) best = t;
    }
  }
  if (pathname === "/") return "/";
  return best;
}

function isNavItemActive(to: string, pathname: string): boolean {
  return bestNavMatch(pathname) === to;
}

interface NavRowProps {
  to: string;
  icon: typeof Home;
  label: string;
  active: boolean;
}

function NavRow({ to, icon: Icon, label, active }: NavRowProps) {
  return (
    <Link
      to={to as string}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 pl-5 pr-3 py-2.5 mx-1 rounded-md text-sm transition-colors group ${
        active
          ? "text-white bg-white/[0.12]"
          : "text-white/70 hover:text-white hover:bg-white/[0.08]"
      }`}
    >
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-[var(--color-primary)]"
          aria-hidden="true"
        />
      )}
      <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* User menu                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function UserMenu({
  email,
  displayName,
  open,
  onToggle,
  onClose,
  onLogout,
}: {
  email: string | undefined;
  displayName?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const friendly =
    (displayName && displayName.trim()) || email?.split("@")[0] || "User";
  const initial = (friendly[0] || email?.[0] || "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 bg-[var(--color-surface)] text-[var(--color-text)] text-sm px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors shadow-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-5 h-5 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-primary-strong)]">
          {initial}
        </span>
        <span className="max-w-[140px] truncate">{friendly}</span>
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <div
            role="menu"
            className="absolute right-0 top-10 w-56 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl py-1 z-50"
          >
            <div className="px-3 py-2 text-xs text-[var(--color-text-subtle)] border-b border-[var(--color-border)] truncate">
              {email}
            </div>
            <Link
              to="/settings"
              role="menuitem"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)] transition-colors"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              Settings
            </Link>
            <Link
              to="/capture"
              role="menuitem"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)] transition-colors"
            >
              <Mic className="w-4 h-4" aria-hidden="true" />
              Start recording
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)] transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* PWA affordances                                                        */
/* ─────────────────────────────────────────────────────────────────────── */

function InstallButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-medium shadow-sm transition-colors"
      aria-label="Install Converge as an app"
      title="Install Converge"
    >
      <Download className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Install</span>
    </button>
  );
}

function OfflinePill() {
  return (
    <span
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-medium border border-amber-500/30"
      title="You're offline. Previously viewed pages are still available."
    >
      <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Offline</span>
    </span>
  );
}
