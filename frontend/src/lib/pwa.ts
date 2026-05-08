/**
 * PWA glue — service-worker registration plus React hooks for the install
 * prompt and online/offline status.
 *
 * The service worker only runs in production (`import.meta.env.PROD`) so the
 * Vite dev server's HMR pipeline isn't intercepted by stale cached responses.
 */

import { useEffect, useState, useCallback } from "react";

/**
 * BeforeInstallPromptEvent isn't in the standard lib.dom types, so we declare
 * the bits we use. Chrome/Edge fire this once the install criteria are met.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Defer until after the load event so SW registration doesn't compete with
  // the initial paint.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non-fatal — the app still works without the SW.
      console.warn("[converge] service worker registration failed", err);
    });
  });
}

/** True when the app is being shown via an installed PWA shell. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari historical quirk.
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

/**
 * Tracks the deferred `beforeinstallprompt` event so the AppShell can show
 * an Install button. `prompt()` triggers the browser dialog and returns the
 * user's choice; the event can only be used once.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  installed: boolean;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstall as EventListener,
      );
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !installed,
    installed,
    prompt,
  };
}

/** Live `navigator.onLine` value, updated via the online/offline events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
