import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "../../lib/auth";
import { ReadingRuler } from "../accessibility/ReadingRuler";
import { FocusMode } from "../accessibility/FocusMode";
import { A11yPanel } from "../accessibility/A11yPanel";
import { AudioPlayer } from "./AudioPlayer";
import { MobileNav } from "./MobileNav";
import { useReadingAidsShortcuts } from "../../hooks/useReadingAidsShortcuts";
import { RecentNotesDropdown } from "../dashboard/RecentNotesDropdown";
import { pb } from "../../lib/pocketbase";
import type { Lecture } from "../../lib/types";
import {
  Home,
  Mic,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Accessibility,
  BookOpen,
  Bell,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

const navItems: readonly NavItem[] = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/capture", icon: Mic, label: "Capture" },
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [a11yOpen, setA11yOpen] = useState<boolean>(false);

  // Recent lectures fed into the sidebar's Notes dropdown.
  const [recentLectures, setRecentLectures] = useState<Lecture[]>([]);
  const [recentLoading, setRecentLoading] = useState<boolean>(true);

  useReadingAidsShortcuts();

  // Fetch the user's most-recently-touched lectures for the sidebar dropdown.
  // Re-fetches on user change. Best-effort — if it fails, the dropdown shows
  // an explicit empty state.
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
        sort: "-updated",
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
    <div className="min-h-screen text-zinc-100 flex bg-[var(--color-bg)]">
      {/* ── Sidebar (desktop only; <lg uses bottom MobileNav) ── */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-60"
        } hidden lg:flex flex-col border-r border-zinc-800/80 bg-[var(--color-surface)]/60 backdrop-blur transition-all duration-200 shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-800/80">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">HackStack</span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active =
              location.pathname === to ||
              (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}

          {/* Notes dropdown — arrow-only opens the list; the label is a Link
           * that navigates to /courses (the notes / lectures index). Hidden
           * when sidebar is collapsed because there's no room for the caret. */}
          {!collapsed && (
            <div className="pt-3 mt-3 border-t border-zinc-800/60">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Recent
              </p>
              <RecentNotesDropdown
                lectures={recentLectures}
                loading={recentLoading}
                variant="sidebar"
              />
            </div>
          )}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center h-10 border-t border-zinc-800/80 text-zinc-500 hover:text-white transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with subtle vibe band */}
        <header className="relative h-14 shrink-0 border-b border-zinc-800/80 overflow-hidden">
          {/* Faint vibe gradient — adds atmosphere without competing with content */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-fuchsia-500/5 to-sky-500/10 pointer-events-none" />
          <div className="relative h-full flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-zinc-100">
                HackStack
              </span>
            </div>
            <h2 className="hidden lg:block text-sm font-medium text-zinc-400">
              {pageTitle(location.pathname)}
            </h2>

            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <Bell className="w-4 h-4" />
              </Link>

              {/* User menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 border border-white/10 flex items-center justify-center text-xs font-medium text-zinc-100">
                    {user?.email?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <span className="hidden sm:inline max-w-[160px] truncate">
                    {user?.email}
                  </span>
                </button>

                {userMenuOpen && (
                  <>
                    {/* Click-outside scrim */}
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-10 w-56 glass-strong rounded-xl shadow-xl py-1 z-50"
                    >
                      <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 truncate">
                        {user?.email}
                      </div>
                      <Link
                        to="/settings"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content — bottom padding reserves space for MobileNav (<lg)
         * and the AudioPlayer (when a track is loaded). */}
        <main
          className="flex-1 overflow-auto"
          data-focus-zone
          style={{
            paddingBottom:
              "calc(var(--mobile-nav-height, 0px) + var(--audio-player-height, 0px))",
          }}
        >
          {children}
        </main>
      </div>

      {/* ── Reading aids (mounted globally; render null when off) ── */}
      <ReadingRuler />
      <FocusMode />

      {/* ── Accessibility panel (overlay; closes in place) ── */}
      <A11yPanel isOpen={a11yOpen} onClose={() => setA11yOpen(false)} />

      {/* ── Persistent audio player (renders null when no src) ── */}
      <AudioPlayer />

      {/* ── Mobile bottom nav (<lg only) ── */}
      <MobileNav />

      {/* ── Floating accessibility button — lifted on mobile so MobileNav
       * doesn't overlap, and lifted again when AudioPlayer is active. ── */}
      <button
        type="button"
        onClick={() => setA11yOpen((open) => !open)}
        className="fixed right-6 w-12 h-12 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/40 transition-colors z-50"
        style={{
          bottom:
            "calc(1.5rem + var(--mobile-nav-height, 0px) + var(--audio-player-height, 0px))",
        }}
        aria-label="Accessibility settings"
        aria-expanded={a11yOpen}
      >
        <Accessibility className="w-5 h-5" />
      </button>
    </div>
  );
}

/** Map a pathname to a human-readable header title. */
function pageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/capture/upload")) return "Upload";
  if (pathname.startsWith("/capture")) return "Capture";
  if (pathname.startsWith("/courses")) return "Courses";
  if (pathname.startsWith("/lectures")) return "Lecture";
  if (pathname.startsWith("/study/flashcards")) return "Flashcards";
  if (pathname.startsWith("/study/planner")) return "Planner";
  if (pathname.startsWith("/study/quiz")) return "Quiz";
  if (pathname.startsWith("/study")) return "Study";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/notifications")) return "Notifications";
  return "HackStack";
}
