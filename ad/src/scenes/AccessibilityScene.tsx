import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import { snapIn, snapInBack, easeOutCubic, easeOutQuart, easeInQuart } from "../anim";

interface AccessibilitySceneProps {
  vertical: boolean;
}

const ICONS: Array<{ emoji: string; label: string }> = [
  { emoji: "💬", label: "Live captions" },
  { emoji: "🤟", label: "Sign language" },
  { emoji: "👁️", label: "Reading ruler" },
  { emoji: "🔊", label: "Text-to-speech" },
  { emoji: "🎯", label: "Focus mode" },
  { emoji: "🌗", label: "Contrast / themes" },
];

/**
 * 22.8–26.4s (1.5 bars at 100 BPM = 108 frames). Drums drop out.
 *
 * Timeline:
 *   f=0..14    Headline + sub-line snap in.
 *   f=14..24   6 icons appear in starting positions on a circle.
 *   f=24..66   ORBIT — icons spin >1 full revolution (easeOutCubic).
 *   f=66..84   CONVERGE — radius/scale/opacity shrink to center.
 *   f=84..108  Single Converge composite glyph at center, pulsing glow.
 */
export const AccessibilityScene: React.FC<AccessibilitySceneProps> = ({
  vertical,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ---- Headline + sub-line ---------------------------------------------
  const headlineAlpha = snapIn(frame - 0, 12);
  const headlineY = (1 - headlineAlpha) * 14;

  const subAlpha = snapIn(frame - 14, 12);
  const subY = (1 - subAlpha) * 10;

  // ---- Orbit center -----------------------------------------------------
  // Centered horizontally; sits below the headline.
  const centerX = width / 2;
  const centerY = vertical ? height * 0.62 : height * 0.66;

  // Radius scales with format. Horizontal ~240, vertical ~180.
  const baseRadius = vertical ? 180 : 240;

  // ---- Phase windows ----------------------------------------------------
  const ORBIT_START = 24;
  const ORBIT_END = 66; // 42 frames of spin (~1.4s)
  const CONVERGE_START = 66;
  const CONVERGE_END = 84; // 18 frames of converge (~0.6s)
  const COMPOSITE_START = 84;

  // Per-icon entrance (f=14..24, staggered).
  // Ring spin (f=24..66, eased).
  const spinLocal = (frame - ORBIT_START) / (ORBIT_END - ORBIT_START);
  const spinEased = easeOutCubic(Math.max(0, Math.min(1, spinLocal)));
  // > 1 full revolution. 1.25 turns feels punchy without blurring.
  const TURNS = 1.25;
  const spinAngle = spinEased * TURNS * Math.PI * 2;

  // Converge progress (radius shrinks full→0 over CONVERGE window).
  const convergeLocal =
    (frame - CONVERGE_START) / (CONVERGE_END - CONVERGE_START);
  const convergeProgress = Math.max(0, Math.min(1, convergeLocal));
  const convergeEased = easeInQuart(convergeProgress);

  // Radius multiplier across the scene.
  // Before orbit: 1 (settled). During orbit: 1. During converge: 1 → 0.
  const radiusMult = 1 - convergeEased;

  // Composite alpha (the final stacked glyph).
  const compositeLocal = frame - COMPOSITE_START;
  const compositeAlpha = snapInBack(compositeLocal, 10, 1.2);

  // Subtle pulsing glow for the composite.
  const pulse =
    0.5 +
    0.5 *
      Math.sin(((frame - COMPOSITE_START) / 30) * Math.PI * 2 * 0.8);
  const glowStrength = compositeAlpha * (0.6 + 0.4 * pulse);

  // Label fade during orbit (clean spin).
  const labelFade =
    frame < ORBIT_START
      ? 1
      : 1 - easeOutQuart(Math.max(0, Math.min(1, (frame - ORBIT_START) / 10)));

  // Icons fade out as they converge.
  const ringAlpha =
    frame < CONVERGE_START
      ? 1
      : 1 - easeOutQuart(convergeProgress);

  const cardSize = vertical ? 84 : 92;
  const cardRadius = 22;
  const emojiSize = vertical ? 38 : 44;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: vertical ? "22%" : "22%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: vertical ? 80 : 100,
            letterSpacing: -3,
            color: COLORS.green,
            textAlign: "center",
            lineHeight: 1.0,
            opacity: headlineAlpha,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          Built for every student.
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: vertical ? 28 : 34,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: vertical ? 720 : 980,
            padding: "0 40px",
            opacity: subAlpha,
            transform: `translateY(${subY}px)`,
          }}
        >
          An accessibility toolkit — without asking for one.
        </div>
      </div>

      {/* Orbit stage — absolutely positioned around centerX/centerY */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          pointerEvents: "none",
        }}
      >
        {ICONS.map((icon, i) => {
          // Each icon's entrance (staggered f=14..).
          const startFrame = 14 + i * 1.4; // tighter stagger so all are in by f=24
          const enterAlpha = snapInBack(frame - startFrame, 10, 1.3);

          // Base angle around the circle.
          const theta0 = (i * (Math.PI * 2)) / ICONS.length;
          // Add ring spin during orbit window.
          const theta = theta0 + spinAngle;

          // Current radius.
          const r = baseRadius * radiusMult;

          // Position.
          const x = centerX + Math.cos(theta) * r;
          const y = centerY + Math.sin(theta) * r;

          // Scale shrinks slightly while converging.
          const convergeScale = 1 - 0.35 * convergeEased;
          const enterScale = 0.92 + 0.08 * Math.min(1, enterAlpha);
          const scale = enterScale * convergeScale;

          const opacity = enterAlpha * ringAlpha;

          return (
            <div
              key={icon.label}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%, -50%) scale(${scale})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                opacity,
              }}
            >
              <div
                style={{
                  width: cardSize,
                  height: cardSize,
                  borderRadius: cardRadius,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: emojiSize,
                  boxShadow: "0 18px 36px -14px rgba(31,56,47,0.32)",
                  border: `1px solid ${COLORS.greenDeepSoft}`,
                }}
              >
                {icon.emoji}
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: vertical ? 18 : 20,
                  color: COLORS.green,
                  letterSpacing: -0.2,
                  opacity: labelFade,
                  whiteSpace: "nowrap",
                }}
              >
                {icon.label}
              </div>
            </div>
          );
        })}

        {/* Composite Converge glyph — appears at center after converge */}
        {compositeAlpha > 0 ? (
          <div
            style={{
              position: "absolute",
              left: centerX,
              top: centerY,
              transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * Math.min(1, compositeAlpha)})`,
              opacity: Math.min(1, compositeAlpha),
            }}
          >
            {/* Soft pulsing halo */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: vertical ? 280 : 340,
                height: vertical ? 280 : 340,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${COLORS.greenBright}66 0%, ${COLORS.greenBright}00 70%)`,
                opacity: glowStrength,
                filter: "blur(6px)",
              }}
            />

            {/* Halo of all 6 emojis */}
            {ICONS.map((icon, i) => {
              const haloR = vertical ? 96 : 116;
              const a = (i * (Math.PI * 2)) / ICONS.length - Math.PI / 2;
              const hx = Math.cos(a) * haloR;
              const hy = Math.sin(a) * haloR;
              const haloEmojiSize = vertical ? 26 : 30;
              return (
                <div
                  key={`halo-${icon.label}`}
                  style={{
                    position: "absolute",
                    left: hx,
                    top: hy,
                    width: haloEmojiSize * 1.6,
                    height: haloEmojiSize * 1.6,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: "#fff",
                    border: `1px solid ${COLORS.greenDeepSoft}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: haloEmojiSize,
                    boxShadow: "0 8px 18px -8px rgba(31,56,47,0.28)",
                  }}
                >
                  {icon.emoji}
                </div>
              );
            })}

            {/* Central Converge "C" card */}
            <div
              style={{
                width: vertical ? 132 : 152,
                height: vertical ? 132 : 152,
                borderRadius: vertical ? 34 : 38,
                background: COLORS.surface,
                border: `1px solid ${COLORS.greenDeepSoft}`,
                boxShadow: `0 24px 48px -16px rgba(31,56,47,0.40), 0 0 ${
                  40 + 30 * pulse
                }px ${COLORS.greenBright}88`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: vertical ? 88 : 104,
                  color: COLORS.green,
                  letterSpacing: -4,
                  lineHeight: 1,
                }}
              >
                C
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
