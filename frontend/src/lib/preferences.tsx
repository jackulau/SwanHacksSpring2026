import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { pb } from "./pocketbase";
import { useAuth } from "./auth";

export type ReadingRulerMode = "off" | "bar" | "window";
export type ReadingRulerTint =
  | "none"
  | "yellow"
  | "peach"
  | "blue"
  | "lavender"
  | "mint";
export type FocusModeScope = "off" | "paragraph" | "sentence";

export interface Preferences {
  /**
   * The app is locked to a dark canvas. `dark` is the default look; the
   * `high-contrast` variant is an accessibility override that keeps the dark
   * palette but with maximum contrast (white text on pure black). Light and
   * sepia were removed when the app went dark-only.
   */
  theme: "dark" | "high-contrast";
  font: "system" | "opendyslexic" | "atkinson";
  fontSize: number;
  lineSpacing: number;
  reducedMotion: boolean;
  ttsEnabled: boolean;
  ttsSpeed: number;
  readingLevel: "original" | "simplified" | "basic";
  cardsPerSession: number;
  pomodoroLength: number;
  breakReminders: boolean;
  readingRuler: ReadingRulerMode;
  readingRulerHeight: number;
  readingRulerTint: ReadingRulerTint;
  readingRulerOpacity: number;
  focusMode: FocusModeScope;
  focusModeDim: number;
}

const defaults: Preferences = {
  theme: "dark",
  font: "system",
  fontSize: 16,
  lineSpacing: 1.5,
  reducedMotion: false,
  ttsEnabled: false,
  ttsSpeed: 1,
  readingLevel: "original",
  cardsPerSession: 20,
  pomodoroLength: 25,
  breakReminders: true,
  readingRuler: "off",
  readingRulerHeight: 32,
  readingRulerTint: "yellow",
  readingRulerOpacity: 60,
  focusMode: "off",
  focusModeDim: 35,
};

interface PreferencesContextValue {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const STORAGE_KEY = "hackstack-preferences";

function loadFromStorage(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Preferences> & {
        theme?: string;
      };
      // Migrate users who previously had `light` or `sepia` selected — the
      // app is dark-only now, so coerce any legacy theme back to `dark`
      // (or to `high-contrast` if they had that, which is still supported).
      const validTheme: Preferences["theme"] =
        parsed.theme === "high-contrast" ? "high-contrast" : "dark";
      return { ...defaults, ...parsed, theme: validTheme };
    }
  } catch {
    // ignore
  }
  return { ...defaults };
}

function applyToDOM(prefs: Preferences) {
  const root = document.documentElement;

  // Theme class — only `high-contrast` adds a class; `dark` is the baseline.
  // Keep `theme-sepia` in the remove list so anyone migrating off the old
  // sepia preference doesn't end up with a stuck class on the html element.
  root.classList.remove("theme-high-contrast", "theme-sepia");
  if (prefs.theme === "high-contrast") {
    root.classList.add("theme-high-contrast");
  }

  // Font class
  root.classList.remove("font-atkinson", "font-opendyslexic");
  if (prefs.font === "atkinson") {
    root.classList.add("font-atkinson");
  } else if (prefs.font === "opendyslexic") {
    root.classList.add("font-opendyslexic");
  }

  // CSS custom properties
  root.style.setProperty("--user-font-size", `${prefs.fontSize}px`);
  root.style.setProperty("--user-line-spacing", `${prefs.lineSpacing}`);
  root.style.fontSize = `${prefs.fontSize}px`;
  root.style.lineHeight = `${prefs.lineSpacing}`;

  // Reduced motion
  if (prefs.reducedMotion) {
    root.classList.add("reduce-motion");
  } else {
    root.classList.remove("reduce-motion");
  }

  // Reading-aid CSS vars
  root.style.setProperty("--reading-ruler-height", `${prefs.readingRulerHeight}px`);
  root.style.setProperty("--reading-ruler-dim", `${prefs.readingRulerOpacity / 100}`);
  root.style.setProperty("--focus-dim", `${prefs.focusModeDim / 100}`);
  root.dataset.readingRuler = prefs.readingRuler;
  root.dataset.readingRulerTint = prefs.readingRulerTint;
  root.dataset.focusMode = prefs.focusMode;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(loadFromStorage);

  // Apply to DOM on mount and whenever prefs change
  useEffect(() => {
    applyToDOM(prefs);
  }, [prefs]);

  // Sync to PocketBase when user is authenticated and prefs change
  const syncToPB = useCallback(
    async (p: Preferences) => {
      if (!user) return;
      try {
        await pb.collection("users").update(user.id, { preferences: p });
      } catch {
        // silently fail — local storage is the source of truth
      }
    },
    [user],
  );

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        syncToPB(next);
        return next;
      });
    },
    [syncToPB],
  );

  return (
    <PreferencesContext value={{ prefs, update }}>
      {children}
    </PreferencesContext>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error("usePreferences must be inside PreferencesProvider");
  return ctx;
}
