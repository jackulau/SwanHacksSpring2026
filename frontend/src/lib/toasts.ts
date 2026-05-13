// Toasts — minimal pub/sub the rest of the app can call to surface
// transient feedback (saved, ingested, exported, errored). The Toaster
// component subscribes and renders. Module-level state keeps the API
// surface tiny: any code can `import { toast } from "../lib/toasts"`
// and call `toast.success("...")` without prop drilling a context.

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs: number;
  createdAt: number;
  action?: ToastAction;
}

export interface ToastOptions {
  description?: string;
  durationMs?: number;
  action?: ToastAction;
}

type Listener = (toasts: Toast[]) => void;

const state: { toasts: Toast[]; listeners: Set<Listener> } = {
  toasts: [],
  listeners: new Set(),
};

function emit(): void {
  for (const l of state.listeners) l(state.toasts.slice());
}

function nextId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function push(
  variant: ToastVariant,
  title: string,
  description?: string,
  durationMs = 4000,
  action?: ToastAction,
): string {
  const id = nextId();
  const t: Toast = {
    id,
    variant,
    title,
    description,
    durationMs,
    createdAt: Date.now(),
    action,
  };
  state.toasts = [...state.toasts, t];
  emit();
  if (durationMs > 0) {
    window.setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

/**
 * Resolve a (description?, durationMs?) | options-object call signature
 * into the underlying primitive args. Lets callers either keep the
 * legacy positional form or pass `{ action, description, durationMs }`.
 */
function resolveOpts(
  descriptionOrOpts?: string | ToastOptions,
  durationMs?: number,
): { description?: string; durationMs?: number; action?: ToastAction } {
  if (descriptionOrOpts && typeof descriptionOrOpts === "object") {
    return {
      description: descriptionOrOpts.description,
      durationMs: descriptionOrOpts.durationMs,
      action: descriptionOrOpts.action,
    };
  }
  return { description: descriptionOrOpts, durationMs };
}

export function dismiss(id: string): void {
  state.toasts = state.toasts.filter((t) => t.id !== id);
  emit();
}

export function clearAllToasts(): void {
  state.toasts = [];
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  state.listeners.add(listener);
  listener(state.toasts.slice());
  return () => {
    state.listeners.delete(listener);
  };
}

export const toast = {
  info: (title: string, descriptionOrOpts?: string | ToastOptions, durationMs?: number) => {
    const o = resolveOpts(descriptionOrOpts, durationMs);
    return push("info", title, o.description, o.durationMs, o.action);
  },
  success: (title: string, descriptionOrOpts?: string | ToastOptions, durationMs?: number) => {
    const o = resolveOpts(descriptionOrOpts, durationMs);
    return push("success", title, o.description, o.durationMs, o.action);
  },
  warning: (title: string, descriptionOrOpts?: string | ToastOptions, durationMs?: number) => {
    const o = resolveOpts(descriptionOrOpts, durationMs);
    return push("warning", title, o.description, o.durationMs, o.action);
  },
  error: (title: string, descriptionOrOpts?: string | ToastOptions, durationMs?: number) => {
    const o = resolveOpts(descriptionOrOpts, durationMs);
    return push("error", title, o.description, o.durationMs ?? 6000, o.action);
  },
  dismiss,
};
