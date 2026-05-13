import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "../components/layout/AppShell";

/**
 * Pure layout for the /notes tree. Wraps children in AppShell and renders
 * the matched child route via <Outlet />. The index page lives in
 * notes.index.tsx; the detail editor lives in notes.$pageId.tsx. Keeping
 * this file dumb means the router (not a useLocation hook) decides what to
 * render — no conditional render, no edge cases.
 */
function NotesLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/notes")({
  component: NotesLayout,
});
