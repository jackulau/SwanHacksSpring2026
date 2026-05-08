// Toasts — minimal pub/sub the rest of the app can call to surface
// transient feedback (saved, ingested, exported, errored). The Toaster
// component subscribes and renders. Module-level state keeps the API
// surface tiny: any code can `import { toast } from "../lib/toasts"`
// and call `toast.success("...")` without prop drilling a context.

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs: number;
  createdAt: number;
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
): string {
  const id = nextId();
  const t: Toast = {
    id,
    variant,
    title,
    description,
    durationMs,
    createdAt: Date.now(),
  };
  state.toasts = [...state.toasts, t];
  emit();
  if (durationMs > 0) {
    window.setTimeout(() => dismiss(id), durationMs);
  }
  return id;
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
  info: (title: string, description?: string, durationMs?: number) =>
    push("info", title, description, durationMs),
  success: (title: string, description?: string, durationMs?: number) =>
    push("success", title, description, durationMs),
  warning: (title: string, description?: string, durationMs?: number) =>
    push("warning", title, description, durationMs),
  error: (title: string, description?: string, durationMs?: number) =>
    push("error", title, description, durationMs ?? 6000),
  dismiss,
};
