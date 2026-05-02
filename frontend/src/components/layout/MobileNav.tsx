import { useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Mic,
  BookOpen,
  GraduationCap,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * MobileNav — fixed bottom-of-viewport navigation for screens <lg.
 *
 * Mounted by AppShell with a `lg:hidden` wrapper, so this component itself
 * does not need to gate its own visibility (it always renders when rendered).
 * It does the following side effects on mount:
 *   - sets `--mobile-nav-height` on `:root` so page content can pad-bottom
 *   - clears the var on unmount
 *
 * Tap targets are >=44px tall (min-h-14 → 56px). Each item is a TanStack
 * Router <Link>, with `aria-current="page"` on the active route. Animations
 * are subtle and respect prefers-reduced-motion via the global `.reduce-motion`
 * class already applied in app.css.
 */

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/capture", icon: Mic, label: "Capture" },
  { to: "/courses", icon: BookOpen, label: "Courses" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

/** Visible height of the nav (px). The `pb-[env(safe-area-inset-bottom)]`
 *  utility adds extra padding inside the nav for the iOS home indicator;
 *  the CSS var below is the *content offset* the page should reserve. */
const MOBILE_NAV_HEIGHT_PX = 56;

function isActiveRoute(pathname: string, target: string): boolean {
  if (target === "/") {
    return pathname === "/";
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function MobileNav() {
  const location = useLocation();

  // Expose the nav height via CSS var so AppShell / route padding can
  // reserve space without tightly coupling to this component.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--mobile-nav-height");
    root.style.setProperty("--mobile-nav-height", `${MOBILE_NAV_HEIGHT_PX}px`);
    return () => {
      if (previous) {
        root.style.setProperty("--mobile-nav-height", previous);
      } else {
        root.style.removeProperty("--mobile-nav-height");
      }
    };
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
        const active = isActiveRoute(location.pathname, to);
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-1 min-h-14 py-2 text-[11px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 ${
              active
                ? "text-indigo-400"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                active ? "scale-105" : ""
              }`}
            />
            <span className="leading-none">{label}</span>
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b-full bg-indigo-400"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
