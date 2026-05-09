import { useEffect } from "react";
import {
  usePreferences,
  type ReadingRulerMode,
  type FocusModeScope,
} from "../lib/preferences";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

const RULER_CYCLE: ReadingRulerMode[] = ["off", "bar", "window"];
const FOCUS_CYCLE: FocusModeScope[] = ["off", "paragraph", "sentence"];

const TOAST_ID = "reading-aids-toast";

function showToast(message: string) {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.className =
      "fixed bottom-24 right-6 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm shadow-xl z-[60] transition-opacity duration-200";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  window.clearTimeout((toast as HTMLElement & { _timer?: number })._timer);
  (toast as HTMLElement & { _timer?: number })._timer = window.setTimeout(() => {
    if (toast) toast.style.opacity = "0";
  }, 1500);
}

function nextIn<T>(arr: readonly T[], current: T): T {
  const idx = arr.indexOf(current);
  return arr[(idx + 1) % arr.length];
}

function capitalize(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function useReadingAidsShortcuts() {
  const { prefs, update } = usePreferences();

  useKeyboardShortcuts([
    {
      key: "r",
      alt: true,
      handler: () => {
        const next = nextIn(RULER_CYCLE, prefs.readingRuler);
        update({ readingRuler: next });
        showToast(`Reading ruler: ${capitalize(next)}`);
      },
    },
    {
      key: "f",
      alt: true,
      handler: () => {
        const next = nextIn(FOCUS_CYCLE, prefs.focusMode);
        update({ focusMode: next });
        showToast(`Focus mode: ${capitalize(next)}`);
      },
    },
  ]);

  // Clean up the toast node on unmount.
  useEffect(() => {
    return () => {
      document.getElementById(TOAST_ID)?.remove();
    };
  }, []);
}
