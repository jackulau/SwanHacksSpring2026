// Toaster — visual surface for the toast pub/sub. Mounts a fixed
// bottom-right column of cards. Each card shows the variant-coloured
// title, optional description, and an X to dismiss. Stack cap at 5;
// older toasts age out via the auto-dismiss timer in toasts.ts.

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  dismiss,
  subscribeToasts,
  type Toast,
  type ToastVariant,
} from "../../lib/toasts";

const VARIANT_ICON: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: "border-[var(--color-border)]",
  success: "border-[var(--color-success)]/40",
  warning: "border-[var(--color-warning)]/40",
  error: "border-[var(--color-error)]/40",
};

const VARIANT_ICON_CLASS: Record<ToastVariant, string> = {
  info: "text-[var(--color-text-muted)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  error: "text-[var(--color-error)]",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  if (toasts.length === 0) return null;
  const visible = toasts.slice(-5);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-50 bottom-4 right-4 w-80 max-w-[90vw] flex flex-col gap-2 pointer-events-none"
    >
      {visible.map((t) => {
        const Icon = VARIANT_ICON[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-md border bg-[var(--color-surface)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.6)] px-3 py-2.5 text-sm text-[var(--color-text)] flex items-start gap-2 ${VARIANT_CLASS[t.variant]}`}
          >
            <Icon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${VARIANT_ICON_CLASS[t.variant]}`}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="font-medium leading-tight text-left hover:underline focus:outline-none focus:underline"
                >
                  {t.title}
                </button>
              ) : (
                <div className="font-medium leading-tight">{t.title}</div>
              )}
              {t.description && (
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                  {t.description}
                </div>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] focus:outline-none focus:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
