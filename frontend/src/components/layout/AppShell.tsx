import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "../../lib/auth";
import {
  Home,
  Mic,
  BookOpen,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Accessibility,
  Calendar,
} from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/capture", icon: Mic, label: "Capture" },
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* ── Sidebar ── */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-56"
        } flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200 shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-800">
          <GraduationCap className="w-6 h-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">HackStack</span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-zinc-800 text-zinc-500 hover:text-white transition-colors"
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
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-medium text-zinc-400">HackStack</h2>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300">
                {user?.email?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span className="hidden sm:inline">{user?.email}</span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800">
                  {user?.email}
                </div>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* ── Floating accessibility button ── */}
      <Link
        to="/settings/accessibility"
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-lg transition-colors z-50"
        aria-label="Accessibility settings"
      >
        <Accessibility className="w-5 h-5" />
      </Link>
    </div>
  );
}
