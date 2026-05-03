import { useEffect, useState } from "react";
import { usePreferences } from "../../lib/preferences";

const TINT_CLASS = {
  none: "",
  yellow: "ruler-tint-yellow",
  peach: "ruler-tint-peach",
  blue: "ruler-tint-blue",
  lavender: "ruler-tint-lavender",
  mint: "ruler-tint-mint",
} as const;

export function ReadingRuler() {
  const { prefs } = usePreferences();
  const { readingRuler: mode, readingRulerHeight: height, readingRulerTint: tint } = prefs;
  const [y, setY] = useState<number | null>(null);

  useEffect(() => {
    if (mode === "off") {
      setY(null);
      return;
    }

    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      setY(e.clientY);
    };

    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [mode]);

  if (mode === "off" || y === null) return null;

  const tintClass = TINT_CLASS[tint];
  const top = y - height / 2;

  if (mode === "bar") {
    return (
      <div
        aria-hidden="true"
        data-testid="reading-ruler-bar"
        className={`reading-ruler-bar fixed left-0 right-0 pointer-events-none z-30 ${tintClass}`}
        style={{ top, height }}
      />
    );
  }

  // window mode
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="reading-ruler-window-above"
        className="reading-ruler-window-above fixed inset-x-0 top-0 pointer-events-none z-30 bg-black"
        style={{ height: Math.max(0, top), opacity: "var(--reading-ruler-dim)" }}
      />
      <div
        aria-hidden="true"
        data-testid="reading-ruler-bar"
        className={`reading-ruler-bar fixed left-0 right-0 pointer-events-none z-30 ${tintClass}`}
        style={{ top, height }}
      />
      <div
        aria-hidden="true"
        data-testid="reading-ruler-window-below"
        className="reading-ruler-window-below fixed inset-x-0 bottom-0 pointer-events-none z-30 bg-black"
        style={{ top: top + height, opacity: "var(--reading-ruler-dim)" }}
      />
    </>
  );
}
