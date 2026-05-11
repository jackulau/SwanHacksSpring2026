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
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { useReadingAidsShortcuts } from "../../hooks/useReadingAidsShortcuts";
import { RecentNotesDropdown } from "../dashboard/RecentNotesDropdown";
import { pb } from "../../lib/pocketbase";
import type { Lecture, UserBadge } from "../../lib/types";
import {
  Home,
  Settings,
  Accessibility,
  ListTodo,
  Glasses,
  Trash2,
  LogOut,
  Search,
  GraduationCap,
  ChevronDown,
} from "lucide-react";

const SIDEBAR_LOGO_SRC = "/assets/converge_logo_vert.png";
const DEFAULT_USER_BADGE: Required<UserBadge> = {
  label: "Administrator",
  backgroundColor: "#42a36e",
  textColor: "#ffffff",
  borderColor: "transparent",
};

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
];

const BOTTOM_NAV: readonly NavItem[] = [
  { to: "/courses", icon: GraduationCap, label: "Courses" },
  { to: "/study/planner", icon: ListTodo, label: "To-do" },
  { to: "/study", icon: Glasses, label: "Study" },
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
  const userMenuInSidebar = location.pathname !== "/";

  // Recent lectures for the sidebar Notes dropdown.
  const [recentLectures, setRecentLectures] = useState<Lecture[]>([]);
  const [recentLoading, setRecentLoading] = useState<boolean>(true);

  // Reset main scroll on route change so users don't land mid-page after
  // navigating from a long page like a transcript.
  useEffect(() => {
    const main = document.getElementById("main");
    if (main) main.scrollTop = 0;
    setUserMenuOpen(false);
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
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Skip link — visible only on focus, jumps over the entire sidebar */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-[var(--color-primary)] focus:text-black focus:font-medium"
      >
        Skip to main content
      </a>

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden lg:flex w-[21.5rem] shrink-0 flex-col overflow-hidden bg-[#438937] text-white">
        <Link
          to="/"
          className="px-7 pt-7 pb-8 hover:opacity-90 transition-opacity"
          aria-label="Converge home"
        >
          <img
            src={SIDEBAR_LOGO_SRC}
            alt="Converge"
            className="w-[288px] max-w-full h-auto"
          />
        </Link>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-7 mb-8 flex h-[58px] items-center gap-3 rounded-[14px] bg-[#232622] px-4 text-left text-white/80 shadow-sm transition-colors hover:bg-[#1c201c] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label={`Open command palette (${isMacPlatform() ? "Command K" : "Control K"})`}
        >
          <Search className="h-8 w-8 shrink-0 text-white" strokeWidth={3} aria-hidden="true" />
          <span className="text-lg font-normal">Search</span>
        </button>

        <nav className="flex-1 overflow-y-auto pb-8">
          <NavGroup items={TOP_NAV} pathname={location.pathname} />

          {/* Notes dropdown — caret-only toggle, label routes to /courses */}
          <div>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Slim top utility bar — only houses the user dropdown.
         * The greeting / page header lives inside the page body so the
         * grey "band" can extend across the greeting card per the mockup. */}
        <header className="h-12 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:hidden bg-[var(--color-sidebar)]">
          <Link to="/" className="flex items-center gap-2 text-white">
            <img src={SIDEBAR_LOGO_SRC} alt="Converge" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
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
              badges={user?.badges}
              open={userMenuOpen}
              onToggle={() => setUserMenuOpen((o) => !o)}
              onClose={() => setUserMenuOpen(false)}
              onLogout={logout}
            />
          </div>
        </header>

        {/* Floating user menu (desktop) — sits on top of the page header band */}
        <div
          className={`fixed z-30 hidden w-max max-w-[18rem] transition-[left,top,transform] duration-700 ease-[var(--motion-ease-emphasis)] lg:block ${
            userMenuInSidebar
              ? "left-7 top-[calc(100vh-5.75rem)] translate-x-0"
              : "left-[calc(100vw-3rem)] top-10 -translate-x-full"
          }`}
        >
          <UserMenu
            email={user?.email}
            displayName={user?.display_name}
            badges={user?.badges}
            menuPlacement={userMenuInSidebar ? "up" : "down"}
            constrained
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
          className="flex-1 overflow-y-auto overflow-x-hidden relative focus:outline-none"
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
      />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
    <div>
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
  "/courses",
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
      className={`group relative flex h-16 items-center gap-5 pl-7 pr-6 text-[21px] transition-[background-color,color,transform] duration-200 ease-[var(--motion-ease)] hover:translate-x-1 ${
        active
          ? "font-bold text-white"
          : "font-normal text-white/90 hover:text-white hover:bg-white/[0.08]"
      }`}
    >
      {active && (
        <span
          className="absolute left-0 top-0 bottom-0 w-2 bg-[#8ee95f]"
          aria-hidden="true"
        />
      )}
      <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* User menu                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function normalizeBadges(badges: UserBadge[] | undefined): Required<UserBadge>[] {
  if (!Array.isArray(badges) || badges.length === 0) return [DEFAULT_USER_BADGE];
  const normalized = badges
    .map((badge) => {
      const label = typeof badge.label === "string" ? badge.label.trim() : "";
      if (!label) return null;
      return {
        label,
        backgroundColor: safeBadgeColor(badge.backgroundColor, "#42a36e"),
        textColor: safeBadgeColor(badge.textColor, "#ffffff"),
        borderColor: safeBadgeColor(badge.borderColor, "transparent"),
      };
    })
    .filter((badge): badge is Required<UserBadge> => Boolean(badge));
  return normalized.length > 0 ? normalized : [DEFAULT_USER_BADGE];
}

function safeBadgeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const color = value.trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\([\d\s.,%]+\)$/i.test(color) ||
    /^hsla?\([\d\s.,%]+\)$/i.test(color) ||
    /^var\(--[a-z0-9-_]+\)$/i.test(color) ||
    /^[a-z]+$/i.test(color)
  ) {
    return color;
  }
  return fallback;
}

function UserMenu({
  email,
  displayName,
  badges = [],
  menuPlacement = "down",
  constrained = false,
  open,
  onToggle,
  onClose,
  onLogout,
}: {
  email: string | undefined;
  displayName?: string;
  badges?: UserBadge[];
  menuPlacement?: "up" | "down";
  constrained?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const friendly =
    (displayName && displayName.trim()) || email?.split("@")[0] || "User";
  const visibleBadges = normalizeBadges(badges);
  const menuPositionClass =
    menuPlacement === "up" ? "bottom-full right-0 mb-2" : "right-0 top-full mt-2";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="relative max-w-full">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 max-w-full items-center gap-2 rounded-full border border-white bg-white px-5 py-2 text-black shadow-sm transition-colors hover:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#438937]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={`truncate text-lg font-bold leading-none ${
            constrained ? "min-w-0 max-w-[8.5rem]" : "max-w-[140px]"
          }`}
        >
          {friendly}
        </span>
        {visibleBadges.map((badge) => (
          <span
            key={`${badge.label}-${badge.backgroundColor}`}
            className="hidden max-w-[8rem] items-center truncate px-2.5 py-1 text-xs font-bold uppercase leading-none sm:inline-flex"
            style={{
              backgroundColor: badge.backgroundColor,
              color: badge.textColor,
              border: `1px solid ${badge.borderColor}`,
            }}
          >
            {badge.label}
          </span>
        ))}
        <ChevronDown
          className={`h-6 w-6 shrink-0 text-black transition-transform duration-200 ease-[var(--motion-ease)] ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={4}
          aria-hidden="true"
        />
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
            data-placement={menuPlacement}
            className={`menu-pop absolute ${menuPositionClass} z-50 w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1 shadow-xl`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-200 ease-[var(--motion-ease)] hover:bg-[var(--color-primary-soft)]"
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
