import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT_DISPLAY } from "../theme";
import { snapInBack, easeOutQuart, easeInQuart, clamp01 } from "../anim";

export interface QASceneProps {
  question: string;
  /**
   * Renders the answer phase.
   *   answerLocalFrame — frames elapsed since the answer began revealing
   *   vertical         — portrait vs landscape
   *   answerTotal      — total frames the answer phase will be on screen
   *                      (so panels can pace their camera move to fill it)
   */
  answer: (
    answerLocalFrame: number,
    vertical: boolean,
    answerTotal: number,
  ) => React.ReactNode;
  /**
   * How the question hands off to the answer.
   *   "katana" — a katana blade sweeps across, wiping Q out and revealing A
   *              (reserved for the drop + the convergence only)
   *   "fade"   — question lifts/fades out, answer fades in (soft, no blade)
   */
  transition: "katana" | "fade";
  /** Katana sweep direction. Ignored for "fade". */
  direction: "ltr" | "rtl";
  vertical: boolean;
  /** Total frames in this Q&A scene. */
  totalFrames: number;
  /**
   * Frame (in this scene's local space) at which the answer begins revealing.
   * Defaults to ~36% of the scene. Override to land the katana on a song beat.
   */
  transAtFrame?: number;
  /** Color for the big question text. */
  questionColor?: string;
}

/**
 * One Q&A pair. The question snaps in, holds for the viewer to read, then hands
 * off to the answer panel at ~36% of the scene so the feature demo gets the
 * lion's share of the runtime. Two handoff styles (see `transition`).
 */
export const QAScene: React.FC<QASceneProps> = ({
  question,
  answer,
  transition,
  direction,
  vertical,
  totalFrames,
  transAtFrame,
  questionColor = COLORS.green,
}) => {
  const frame = useCurrentFrame();

  // Answer begins revealing at ~36% of the scene (or an explicit beat frame).
  const TRANS_START = transAtFrame ?? Math.round(totalFrames * 0.36);
  const SWIPE_DUR = 18; // katana cross time
  const FADE_DUR = 12; // soft crossfade time
  const transDur = transition === "katana" ? SWIPE_DUR : FADE_DUR;

  const answerLocalFrame = Math.max(0, frame - TRANS_START);
  const answerTotal = totalFrames - TRANS_START;

  // Transition progress 0→1 across the handoff window.
  const transProg =
    frame <= TRANS_START
      ? 0
      : frame >= TRANS_START + transDur
        ? 1
        : (frame - TRANS_START) / transDur;
  const transEased = easeOutQuart(transProg);

  // Question words animate in one-by-one (staggered overshoot) and, on fade
  // scenes, fly out one-by-one too — lively text, no static hold or pulse.
  const words = question.split(" ");
  const WORD_IN_STAGGER = 3;
  const WORD_OUT_STAGGER = 2;

  // ── Answer reveal depends on the transition style ─────────────────────────
  let qClip: string | undefined;
  let aClip: string | undefined;
  let aFadeOpacity = 1;

  if (transition === "katana") {
    // Blade wipes the question away in its travel direction.
    qClip =
      transProg > 0
        ? direction === "ltr"
          ? `inset(0 0 0 ${transEased * 100}%)`
          : `inset(0 ${transEased * 100}% 0 0)`
        : undefined;
    aClip =
      transProg > 0 && transProg < 1
        ? direction === "ltr"
          ? `inset(0 ${(1 - transEased) * 100}% 0 0)`
          : `inset(0 0 0 ${(1 - transEased) * 100}%)`
        : undefined;
  } else {
    aFadeOpacity = transEased;
  }

  // Katana blade travel position.
  const bladePct =
    transition === "katana" && transProg > 0 && transProg < 1
      ? direction === "ltr"
        ? -10 + transEased * 120
        : 110 - transEased * 120
      : null;

  const fadeExitEnd = TRANS_START + words.length * WORD_OUT_STAGGER + FADE_DUR + 6;
  const showQuestion =
    transition === "katana" ? frame < TRANS_START + transDur : frame < fadeExitEnd;
  const showAnswer = transProg > 0;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Answer layer */}
      {showAnswer && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: aClip,
            WebkitClipPath: aClip,
            opacity: aFadeOpacity,
          }}
        >
          {answer(answerLocalFrame, vertical, answerTotal)}
        </div>
      )}

      {/* Question layer — per-word animated in/out */}
      {showQuestion && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6%",
            clipPath: qClip,
            WebkitClipPath: qClip,
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: vertical ? 120 : 180,
              letterSpacing: "-0.04em",
              color: questionColor,
              textAlign: "center",
              lineHeight: 1.0,
              whiteSpace: "nowrap",
              maxWidth: "100%",
              display: "inline-flex",
              gap: vertical ? "0.28em" : "0.3em",
            }}
          >
            {words.map((w, i) => {
              const ein = snapInBack(frame - i * WORD_IN_STAGGER, 11, 1.6);
              const einC = clamp01(ein);
              // Fade scenes: each word flies up + out, staggered.
              const eoutProg =
                transition === "fade"
                  ? clamp01((frame - (TRANS_START + i * WORD_OUT_STAGGER)) / FADE_DUR)
                  : 0;
              const eout = easeInQuart(eoutProg);
              const ty = (1 - einC) * 48 - eout * 80;
              const rot = (1 - einC) * -8 + eout * 7;
              const sc = 0.65 + 0.35 * ein - 0.15 * eout;
              return (
                <span
                  key={`${w}-${i}`}
                  style={{
                    display: "inline-block",
                    opacity: einC * (1 - eout),
                    transform: `translateY(${ty}px) rotate(${rot}deg) scale(${sc})`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Katana blade + motion trail (katana transition only) */}
      {bladePct !== null && (
        <>
          <div
            style={{
              position: "absolute",
              top: -40,
              bottom: -40,
              left:
                direction === "ltr"
                  ? `calc(${bladePct}% - 140px)`
                  : `${bladePct}%`,
              width: 140,
              background:
                direction === "ltr"
                  ? "linear-gradient(to left, rgba(255,255,255,0.65), rgba(255,255,255,0))"
                  : "linear-gradient(to right, rgba(255,255,255,0.65), rgba(255,255,255,0))",
              transform: "rotateZ(-12deg)",
              transformOrigin: "center",
              pointerEvents: "none",
              filter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -40,
              bottom: -40,
              left: `${bladePct}%`,
              width: 6,
              background: "#fff",
              transform: "rotateZ(-12deg)",
              transformOrigin: "center",
              boxShadow: `0 0 28px #fff, 0 0 60px ${COLORS.greenBright}`,
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
};
