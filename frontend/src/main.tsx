import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createRouter,
  Link,
  ErrorComponentProps,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "./lib/auth";
import { PreferencesProvider } from "./lib/preferences";
import { AudioPlayerProvider } from "./lib/audioPlayer";
import { ToastProvider } from "./lib/toast";

function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)] mb-2">
          Page error
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          Converge ran into a problem
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] break-words mb-6">
          {message}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Try again
          </button>
          <Link
            to="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundFallback() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)] mb-2">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          We couldn't find that page
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          The link may be stale or the page may have moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: NotFoundFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PreferencesProvider>
      <AudioPlayerProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AudioPlayerProvider>
    </PreferencesProvider>
  </AuthProvider>,
);
