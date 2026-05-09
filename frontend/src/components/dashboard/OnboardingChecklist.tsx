import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, X } from "lucide-react";
import { pb } from "../../lib/pocketbase";

const DISMISS_KEY = "converge_onboarding_dismissed";

interface OnboardingChecklistProps {
  userId: string;
  /** Number of lectures the user already has — when > 0 we hide the checklist. */
  lectureCount: number;
  /** Pass-through loading flag from the dashboard data fetch. */
  loading: boolean;
}

interface ChecklistState {
  hasCourse: boolean;
  hasCanvas: boolean;
  hasLecture: boolean;
}

/**
 * First-run checklist for fresh accounts. Renders three steps that guide a
 * student through getting their first useful surface filled in. Once any
 * lecture exists the checklist hides itself permanently for that account
 * (lectures are the strongest signal that a user has graduated past
 * onboarding); a manual X button is also offered as an escape hatch.
 */
export function OnboardingChecklist({
  userId,
  lectureCount,
  loading,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [state, setState] = useState<ChecklistState>({
    hasCourse: false,
    hasCanvas: false,
    hasLecture: lectureCount > 0,
  });
  const [stateLoaded, setStateLoaded] = useState(false);

  // Update the lecture flag whenever the dashboard's count changes.
  useEffect(() => {
    setState((s) => ({ ...s, hasLecture: lectureCount > 0 }));
  }, [lectureCount]);

  // Probe for course count and Canvas connection — both are tiny PB calls.
  useEffect(() => {
    if (dismissed || lectureCount > 0) return;
    let cancelled = false;
    Promise.all([
      pb
        .collection("courses")
        .getList(1, 1, {
          filter: `user = "${userId}"`,
          requestKey: "onboarding-courses",
        })
        .then((r) => r.totalItems > 0)
        .catch(() => false),
      // Canvas connection is stored on the user record. We treat *any* canvas
      // metadata as "connected" — partial rows still count, since the user
      // has clearly engaged with the integration.
      pb
        .collection("users")
        .getOne<{ canvas_url?: string; canvas_token?: string }>(userId, {
          requestKey: "onboarding-user",
        })
        .then((u) => Boolean(u.canvas_url || u.canvas_token))
        .catch(() => false),
    ]).then(([hasCourse, hasCanvas]) => {
      if (cancelled) return;
      setState((s) => ({ ...s, hasCourse, hasCanvas }));
      setStateLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, dismissed, lectureCount]);

  if (dismissed || lectureCount > 0 || loading) return null;
  // Wait for the first probe so we don't flash an "Add a course" step that
  // immediately checks itself.
  if (!stateLoaded) return null;

  const allDone = state.hasCourse && state.hasLecture;
  if (allDone) return null;

  const items = [
    {
      key: "course",
      done: state.hasCourse,
      label: "Add your first course",
      hint: "Group lectures, assignments, and notes together.",
      to: "/courses",
      ctaIfDone: undefined,
    },
    {
      key: "canvas",
      done: state.hasCanvas,
      label: "Connect Canvas (optional)",
      hint: "Pulls assignments and due dates into the calendar.",
      to: "/settings",
      ctaIfDone: undefined,
    },
    {
      key: "lecture",
      done: state.hasLecture,
      label: "Record your first lecture",
      hint: "Live captions, transcript, notes, flashcards, quiz — automatically.",
      to: "/capture",
      ctaIfDone: undefined,
    },
  ];

  return (
    <section
      aria-label="Getting started"
      className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] p-4"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Get started with Converge
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Three quick steps to make the dashboard useful.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "true");
            } catch {
              /* localStorage unavailable — non-fatal */
            }
          }}
          aria-label="Hide getting started"
          className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors -mr-1 -mt-0.5"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <ol className="space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--color-primary-soft)_70%,white)] ${
                item.done ? "opacity-60" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${
                  item.done
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border-strong)]"
                }`}
              >
                {item.done && <Check className="w-3 h-3" />}
              </span>
              <span className="flex-1">
                <span
                  className={`block text-[var(--color-text)] ${
                    item.done ? "line-through" : ""
                  }`}
                >
                  {item.label}
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {item.hint}
                </span>
              </span>
              {!item.done && (
                <ChevronRight
                  className="w-4 h-4 text-[var(--color-text-subtle)]"
                  aria-hidden="true"
                />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
