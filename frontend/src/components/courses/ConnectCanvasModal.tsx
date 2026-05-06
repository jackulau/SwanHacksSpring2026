import { useEffect, useRef } from "react";
import { X, Download, ExternalLink, Check } from "lucide-react";

interface ConnectCanvasModalProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  n: number;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: "Download the extension",
    body: (
      <a
        href="/converge-canvas-extension.zip"
        download
        className="inline-flex items-center gap-2 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Download .zip
      </a>
    ),
  },
  {
    n: 2,
    title: "Unzip it somewhere you'll keep it",
    body: (
      <p className="text-sm text-[var(--color-text-muted)] mt-1">
        The folder needs to stay where you put it — Chrome loads the extension
        from disk each time you start the browser.
      </p>
    ),
  },
  {
    n: 3,
    title: "Open Chrome's extensions page and load it",
    body: (
      <div className="mt-1 space-y-2">
        <ol className="text-sm text-[var(--color-text-muted)] list-decimal pl-5 space-y-1">
          <li>
            Visit{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-mono">
              chrome://extensions
            </code>
          </li>
          <li>
            Toggle <strong className="text-[var(--color-text)]">Developer mode</strong> on
            (top-right corner)
          </li>
          <li>
            Click <strong className="text-[var(--color-text)]">Load unpacked</strong> and
            select the unzipped folder
          </li>
          <li>Pin the Converge icon to your toolbar so you can find it</li>
        </ol>
      </div>
    ),
  },
  {
    n: 4,
    title: "Sign in and sync",
    body: (
      <p className="text-sm text-[var(--color-text-muted)] mt-1">
        Click the Converge icon, sign in with the same email and password you
        use here, then visit your Canvas dashboard and click{" "}
        <strong className="text-[var(--color-text)]">Sync</strong>. Your courses
        and assignments will appear here within a few seconds.
      </p>
    ),
  },
];

export function ConnectCanvasModal({ open, onClose }: ConnectCanvasModalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-canvas-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--color-border)] shrink-0">
          <h2
            id="connect-canvas-title"
            className="text-sm font-semibold text-[var(--color-text)]"
          >
            Connect your Canvas account
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Converge syncs Canvas courses and assignments through a Chrome
            extension that uses your existing Canvas login. No API keys, no
            re-entering passwords.
          </p>

          <ol className="space-y-5">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-semibold grid place-items-center mt-0.5"
                >
                  {step.n}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {step.title}
                  </h3>
                  {step.body}
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-xs text-[var(--color-text-subtle)]">
            Only Firefox? Native macOS Safari? Reach out — we'll prioritize a
            build for the browser you use.
          </p>
        </div>

        <div className="px-5 h-12 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] shrink-0">
          <a
            href="https://www.google.com/search?q=chrome%3A%2F%2Fextensions"
            onClick={(e) => {
              // chrome:// links can't be opened from a regular page, but we
              // can hint at it. Instruct the user to copy-paste instead.
              e.preventDefault();
              navigator.clipboard
                ?.writeText("chrome://extensions")
                .catch(() => {});
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:underline"
            title="Copy chrome://extensions to clipboard"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Copy chrome://extensions URL
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-raised)]"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            I've installed it
          </button>
        </div>
      </div>
    </div>
  );
}
