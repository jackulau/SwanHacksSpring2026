import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { snapIn, snapInBack } from "../anim";

/**
 * Tiny UI snippets that float on top of the static app screenshots inside the
 * MacBook screen area, simulating the app reacting to the cursor click. These
 * are absolutely positioned with percent coordinates so they scale with the
 * MacBook width.
 */

interface OverlayProps {
  /** local frame in the beat */
  local: number;
  /** frame at which the cursor's click lands — overlays react after this */
  clickAt: number;
}

const CAPTION_LINES = [
  "Today we'll cover oxidative phosphorylation,",
  "the final stage of cellular respiration.",
  "NADH and FADH₂ donate electrons to the chain.",
];

// Compute typing progress: chars per frame at ~45 cpm equivalent
function typed(text: string, frames: number): string {
  const charsPerFrame = 1.4;
  const n = Math.max(0, Math.min(text.length, Math.floor(frames * charsPerFrame)));
  return text.slice(0, n);
}

/**
 * Capture beat: red record pill pulses in after click, then live-caption text
 * starts typing in at the bottom of the screen.
 */
export const CaptureOverlay: React.FC<OverlayProps> = ({ local, clickAt }) => {
  const sinceClick = local - clickAt;
  const recAlpha = snapInBack(sinceClick, 8, 1.5);
  const recPulse = 0.5 + 0.5 * Math.sin((local / 30) * 2 * Math.PI * 2.6);

  const captionAlpha = snapIn(sinceClick - 4, 8);
  const linesFrame = Math.max(0, sinceClick - 8);
  // Determine which line we're on
  const PER_LINE_FRAMES = 22;
  let usedFrames = linesFrame;
  const lines: { text: string; full: boolean }[] = [];
  for (const line of CAPTION_LINES) {
    if (usedFrames <= 0) {
      lines.push({ text: "", full: false });
      continue;
    }
    if (usedFrames >= PER_LINE_FRAMES) {
      lines.push({ text: line, full: true });
      usedFrames -= PER_LINE_FRAMES;
    } else {
      lines.push({ text: typed(line, usedFrames), full: false });
      usedFrames = 0;
    }
  }

  return (
    <>
      {/* REC pill, top-right */}
      {recAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: "7%",
            right: "7%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.96)",
            border: `1px solid ${COLORS.red}`,
            boxShadow: "0 12px 28px -10px rgba(255,80,71,0.6)",
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 18,
            color: COLORS.red,
            letterSpacing: 0.6,
            opacity: recAlpha,
            transform: `scale(${0.9 + 0.1 * recAlpha})`,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: COLORS.red,
              opacity: recPulse,
              boxShadow: `0 0 ${4 + recPulse * 10}px ${COLORS.red}`,
            }}
          />
          REC
        </div>
      )}

      {/* Live caption bar, bottom */}
      {captionAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "10%",
            right: "10%",
            bottom: "11%",
            padding: "14px 20px",
            borderRadius: 16,
            background: "rgba(10,13,12,0.85)",
            backdropFilter: "blur(4px)",
            color: "#fff",
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 22,
            lineHeight: 1.35,
            opacity: captionAlpha,
            transform: `translateY(${(1 - captionAlpha) * 14}px)`,
            boxShadow: "0 24px 48px -16px rgba(10,13,12,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                opacity: l.text ? 1 : 0,
                color: l.full ? "#fff" : "rgba(255,255,255,0.85)",
              }}
            >
              {l.text}
              {!l.full && l.text && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 22,
                    background: COLORS.greenBright,
                    marginLeft: 4,
                    verticalAlign: "text-top",
                    opacity: (local % 16) < 8 ? 1 : 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/**
 * Notes beat: "Generating..." toast → "✓ 24 cards · 8 questions" success pill.
 */
export const NotesOverlay: React.FC<OverlayProps> = ({ local, clickAt }) => {
  const sinceClick = local - clickAt;
  const generatingAlpha = snapInBack(sinceClick, 8);
  const generatingExit = interpolate(sinceClick, [22, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const generatingOp = generatingAlpha * generatingExit;

  const readyAlpha = snapInBack(sinceClick - 28, 10, 1.6);
  const spinnerAngle = (local * 18) % 360;

  const countNumberCards = Math.min(24, Math.max(0, Math.floor((sinceClick - 28) * 2)));
  const countNumberQ = Math.min(8, Math.max(0, Math.floor((sinceClick - 30) * 0.7)));

  return (
    <>
      {generatingOp > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${0.92 + 0.08 * generatingAlpha})`,
            padding: "16px 22px",
            borderRadius: 14,
            background: "rgba(10,13,12,0.88)",
            color: "#fff",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 24px 48px -16px rgba(10,13,12,0.6)",
            opacity: generatingOp,
          }}
        >
          <svg width={22} height={22} viewBox="0 0 22 22">
            <circle
              cx="11"
              cy="11"
              r="9"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2.5"
            />
            <circle
              cx="11"
              cy="11"
              r="9"
              fill="none"
              stroke={COLORS.greenBright}
              strokeWidth="2.5"
              strokeDasharray="20 40"
              strokeLinecap="round"
              transform={`rotate(${spinnerAngle} 11 11)`}
            />
          </svg>
          Generating study set…
        </div>
      )}

      {readyAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * readyAlpha})`,
            padding: "16px 22px",
            borderRadius: 14,
            background: "#fff",
            color: COLORS.green,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: `2px solid ${COLORS.greenBright}`,
            boxShadow: `0 24px 48px -16px rgba(47,93,79,0.45), 0 0 0 6px rgba(123,216,143,0.18)`,
            opacity: readyAlpha,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: COLORS.greenBright,
              color: COLORS.green,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            ✓
          </span>
          <span>
            {countNumberCards} cards
            <span style={{ color: COLORS.muted, margin: "0 8px" }}>·</span>
            {countNumberQ} questions
          </span>
        </div>
      )}
    </>
  );
};

/**
 * Flashcards beat: animated card flip — front side has a term, back has answer.
 * Card stack counter at top.
 */
export const FlashcardsOverlay: React.FC<OverlayProps> = ({ local, clickAt }) => {
  const sinceClick = local - clickAt;
  const cardAlpha = snapInBack(sinceClick, 10, 1.4);

  // Card flip: rotates 0 → 180 across frames 14–26 after click
  const flipProgress = interpolate(sinceClick, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flipAngle = flipProgress * 180;
  const showBack = flipProgress >= 0.5;

  // Counter — start at 24, tick down to 23 after flip
  const counter = sinceClick >= 30 ? 23 : 24;

  return (
    <>
      {cardAlpha > 0.01 && (
        <>
          {/* Card counter pill, top-left */}
          <div
            style={{
              position: "absolute",
              top: "9%",
              left: "10%",
              padding: "8px 14px",
              borderRadius: 999,
              background: COLORS.green,
              color: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 16,
              opacity: cardAlpha,
              boxShadow: "0 10px 22px -8px rgba(47,93,79,0.55)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.greenBright,
              }}
            />
            Card {counter} / 24
          </div>

          {/* Flashcard floating in the middle */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: "44%",
              height: "32%",
              transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * cardAlpha}) perspective(900px) rotateY(${flipAngle}deg)`,
              transformStyle: "preserve-3d",
              opacity: cardAlpha,
            }}
          >
            {/* Front */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#fff",
                borderRadius: 18,
                padding: "22px 26px",
                boxShadow: "0 28px 56px -18px rgba(10,13,12,0.45)",
                border: `1.5px solid ${COLORS.greenDeepSoft}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 12,
                backfaceVisibility: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 12,
                  color: COLORS.greenMid,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                }}
              >
                Term
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 30,
                  color: COLORS.ink,
                  letterSpacing: -0.8,
                  lineHeight: 1.1,
                }}
              >
                Electron transport chain
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                Tap to reveal answer
              </div>
            </div>
            {/* Back */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: COLORS.green,
                color: "#fff",
                borderRadius: 18,
                padding: "22px 26px",
                boxShadow: "0 28px 56px -18px rgba(10,13,12,0.45)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 10,
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 12,
                  color: COLORS.greenBright,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                }}
              >
                Answer
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: 18,
                  lineHeight: 1.35,
                }}
              >
                A series of complexes that transfer electrons via redox to pump
                H⁺ across the inner mitochondrial membrane.
              </div>
            </div>
          </div>

          {/* "Got it" badge after flip */}
          {showBack && sinceClick >= 28 && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "86%",
                transform: "translate(-50%, -50%)",
                padding: "8px 16px",
                borderRadius: 999,
                background: "#fff",
                color: COLORS.green,
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 15,
                border: `1.5px solid ${COLORS.greenBright}`,
                boxShadow: "0 12px 24px -8px rgba(47,93,79,0.4)",
                opacity: snapInBack(sinceClick - 28, 10, 1.5),
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: COLORS.greenBright, fontSize: 18 }}>✓</span>
              Got it
            </div>
          )}
        </>
      )}
    </>
  );
};

/**
 * Quiz beat — a REAL quiz interaction. The quiz card is on screen for the
 * whole beat (no awkward "Take quiz" screenshot phase). The cursor lands on
 * the correct option (B · Oxygen) at `clickAt`; it snaps green with a ✓, the
 * wrong options dim, and a "Correct +10 XP" badge pops while the score ticks.
 */
const QUIZ_OPTIONS = [
  { key: "A", text: "NAD⁺", correct: false },
  { key: "B", text: "Oxygen", correct: true },
  { key: "C", text: "Glucose", correct: false },
  { key: "D", text: "Pyruvate", correct: false },
];

export const QuizOverlay: React.FC<OverlayProps> = ({ local, clickAt }) => {
  const sincePick = local - clickAt;

  // Quiz card snaps in at the very start of the beat and stays.
  const cardIn = snapInBack(local - 1, 10, 1.05);

  // Score counter ticks 70 → 80 once the correct answer lands.
  const score = sincePick >= 0 ? Math.min(80, 70 + Math.floor(sincePick * 1.2)) : 70;
  const xpAlpha = snapInBack(sincePick - 6, 12, 1.6);

  // Row geometry (screen-area %). Option B center ≈ (50, 55) — the panel's
  // cursor aims here.
  const ROW_TOP = 38;
  const ROW_STEP = 12;
  const ROW_H = 10;

  return (
    <>
      {/* Full-screen quiz card */}
      {cardIn > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: COLORS.cream,
            opacity: Math.min(1, cardIn),
            transform: `translateY(${(1 - cardIn) * 6}%)`,
          }}
        >
          {/* Header: progress + AI chip + score */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              left: "8%",
              right: "8%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 22,
                  color: COLORS.green,
                }}
              >
                Question 3
                <span style={{ color: COLORS.muted, fontWeight: 600 }}> / 8</span>
              </span>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: COLORS.greenSoft,
                  color: COLORS.green,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 0.4,
                }}
              >
                ✦ AI-generated
              </span>
            </div>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 22,
                color: COLORS.green,
              }}
            >
              {score} pts
            </span>
          </div>

          {/* Question */}
          <div
            style={{
              position: "absolute",
              top: "19%",
              left: "8%",
              right: "8%",
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 34,
              lineHeight: 1.15,
              letterSpacing: -0.6,
              color: COLORS.ink,
            }}
          >
            What is the final electron acceptor in the electron transport chain?
          </div>

          {/* Options */}
          {QUIZ_OPTIONS.map((opt, i) => {
            const top = ROW_TOP + i * ROW_STEP;
            const isCorrect = opt.correct;
            // After the pick, correct row goes green, wrong rows dim.
            const pickReveal = Math.max(0, Math.min(1, (sincePick) / 8));
            const correctGlow = isCorrect ? pickReveal : 0;
            const dim = !isCorrect ? pickReveal * 0.55 : 0;
            // Every option is identical plain white until the click lands; only
            // then does the correct row tint green (ramping from 0, no pre-hint).
            const bg =
              isCorrect && correctGlow > 0
                ? `rgba(123,216,143,${0.40 * correctGlow})`
                : "#ffffff";
            const border = isCorrect && pickReveal > 0 ? COLORS.greenBright : COLORS.greenDeepSoft;
            return (
              <div
                key={opt.key}
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  top: `${top}%`,
                  height: `${ROW_H}%`,
                  borderRadius: 16,
                  background: bg,
                  border: `2px solid ${border}`,
                  boxShadow: isCorrect && pickReveal > 0.3
                    ? `0 0 28px rgba(123,216,143,${0.5 * correctGlow})`
                    : "0 8px 20px -12px rgba(31,56,47,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 22px",
                  opacity: 1 - dim,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: 10,
                    background: isCorrect && pickReveal > 0 ? COLORS.green : COLORS.greenSoft,
                    color: isCorrect && pickReveal > 0 ? "#fff" : COLORS.green,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {opt.key}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontWeight: 600,
                    fontSize: 24,
                    color: COLORS.ink,
                  }}
                >
                  {opt.text}
                </span>
                {isCorrect && correctGlow > 0.2 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: COLORS.greenBright,
                      color: COLORS.green,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 900,
                      transform: `scale(${0.7 + 0.3 * correctGlow})`,
                      boxShadow: `0 0 ${10 + 14 * correctGlow}px ${COLORS.greenBright}`,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}

          {/* Correct +10 XP badge */}
          {xpAlpha > 0.01 && (
            <div
              style={{
                position: "absolute",
                bottom: "6%",
                left: "50%",
                transform: `translate(-50%, ${(1 - xpAlpha) * 20}px) scale(${0.9 + 0.1 * xpAlpha})`,
                padding: "12px 22px",
                borderRadius: 999,
                background: COLORS.green,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                gap: 10,
                whiteSpace: "nowrap",
                boxShadow: "0 18px 36px -14px rgba(31,56,47,0.5)",
                opacity: xpAlpha,
              }}
            >
              <span style={{ color: COLORS.greenBright, fontSize: 24 }}>✓</span>
              Correct! +10 XP
            </div>
          )}
        </div>
      )}
    </>
  );
};
