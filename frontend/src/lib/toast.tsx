import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toast: (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => {
      idRef.current += 1;
      const id = idRef.current;
      const next: Toast = {
        id,
        message,
        variant: opts?.variant ?? "info",
        durationMs: opts?.durationMs ?? DEFAULT_DURATION_MS,
      };
      setToasts((prev) => [...prev, next]);
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft-fail in tests / SSR: return a no-op so callers don't crash.
    return { toast: () => undefined };
  }
  return ctx;
}

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none"
      style={{
        bottom:
          "calc(1.5rem + var(--audio-player-height, 0px) + var(--mobile-nav-height, 0px))",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.durationMs, onDismiss]);

  const accent =
    toast.variant === "success"
      ? "border-[var(--color-primary)] text-[var(--color-text)]"
      : toast.variant === "error"
        ? "border-[var(--color-record)] text-[var(--color-text)]"
        : "border-[var(--color-border-strong)] text-[var(--color-text)]";

  const Icon =
    toast.variant === "success" ? Check : toast.variant === "error" ? AlertCircle : Info;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 min-w-[220px] max-w-sm bg-[var(--color-surface-elevated)] border ${accent} rounded-md shadow-lg px-3 py-2 text-sm`}
    >
      <Icon
        className={`w-4 h-4 mt-0.5 shrink-0 ${
          toast.variant === "success"
            ? "text-[var(--color-primary)]"
            : toast.variant === "error"
              ? "text-[var(--color-record)]"
              : "text-[var(--color-text-muted)]"
        }`}
        aria-hidden="true"
      />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors -mr-1 -mt-0.5"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
