import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ConvergeLogo } from "../components/ConvergeLogo";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import { punctualAlpha, snapIn, snapInBack, easeOutCubic } from "../anim";

interface ProblemSceneProps {
  vertical: boolean;
}

interface BrandChip {
  name: string;
  bg: string;
  fg: string;
  glyph: string;
  glyphStyle?: React.CSSProperties;
}

const CHIPS: BrandChip[] = [
  {
    name: "Canvas",
    bg: "#E72429",
    fg: "#ffffff",
    glyph: "C",
    glyphStyle: { fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700 },
  },
  {
    name: "Wispr Flow",
    bg: "#0F1116",
    fg: "#ffffff",
    glyph: "≋",
    glyphStyle: { fontWeight: 400 },
  },
  {
    name: "Notion",
    bg: "#ffffff",
    fg: "#0F0F0F",
    glyph: "N",
    glyphStyle: { fontFamily: "Times, serif", fontWeight: 700 },
  },
];

/**
 * 2.4–7.2s (2 bars at 100 BPM). Three brand chips snap in on the beat,
 * hold while the user reads them, then converge into the Converge logo on
 * a downbeat. Payoff line "One-stop shop for students." snaps in on the
 * final beat of the scene.
 *
 * Beat grid (scene-local, 30 fps):
 *   beat 1 (0):    headline snaps in
 *   beat 2 (18):   Canvas chip
 *   beat 3 (36):   Wispr Flow chip
 *   beat 4 (54):   Notion chip
 *   beat 5 (72):   chips hold
 *   beat 6 (90):   chips snap out, converge into logo
 *   beat 7 (108):  logo settles
 *   beat 8 (126):  payoff line snaps in
 */
export const ProblemScene: React.FC<ProblemSceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const HEADLINE_AT = 0;
  const CHIP_STARTS = [18, 36, 54];
  const CONVERGE_AT = 90;
  const LOGO_AT = 102;
  const PAYOFF_AT = 126;

  const cx = width / 2;
  const cy = vertical ? height / 2 + 80 : height / 2 + 40;

  const headlineAlpha = snapIn(frame - HEADLINE_AT, 10);
  const headlineY = (1 - headlineAlpha) * 14;

  // Chip positions
  const chipSlots = vertical
    ? [
        { x: cx, y: cy - 320 },
        { x: cx, y: cy - 60 },
        { x: cx, y: cy + 200 },
      ]
    : [
        { x: cx - 460, y: cy - 60 },
        { x: cx, y: cy - 60 },
        { x: cx + 460, y: cy - 60 },
      ];

  // Converge progress (0 → 1 over 18 frames starting at CONVERGE_AT)
  const convProg = interpolate(frame, [CONVERGE_AT, CONVERGE_AT + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const convEased = easeOutCubic(convProg);

  const logoAlpha = snapInBack(frame - LOGO_AT, 14, 1.4);
  const logoScale = 0.85 + 0.15 * logoAlpha;

  const payoffAlpha = snapIn(frame - PAYOFF_AT, 10);
  const payoffY = (1 - payoffAlpha) * 12;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: vertical ? 180 : 110,
          display: "flex",
          justifyContent: "center",
          opacity: headlineAlpha,
          transform: `translateY(${headlineY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: vertical ? 80 : 96,
            letterSpacing: -3,
            color: COLORS.green,
            textAlign: "center",
            lineHeight: 1.05,
            padding: "0 60px",
          }}
        >
          Three apps. <span style={{ color: COLORS.greenMid }}>One Converge.</span>
        </div>
      </div>

      {/* Brand chips */}
      {CHIPS.map((chip, i) => {
        const startFrame = CHIP_STARTS[i];
        const chipAlpha = snapIn(frame - startFrame, 8);
        const chipScale = 0.9 + 0.1 * chipAlpha;
        const slot = chipSlots[i];

        // Converge: chips slide toward center and fade
        const slideX = (cx - slot.x) * convEased;
        const slideY = (cy - slot.y) * convEased;
        const fadeOut = 1 - convEased;
        const opacity = chipAlpha * fadeOut;
        if (opacity < 0.01) return null;

        const sizeScale = vertical ? 0.9 : 1;
        return (
          <div
            key={chip.name}
            style={{
              position: "absolute",
              left: slot.x + slideX,
              top: slot.y + slideY,
              transform: `translate(-50%, -50%) scale(${chipScale * (1 - convEased * 0.4)})`,
              opacity,
              display: "flex",
              alignItems: "center",
              gap: 18 * sizeScale,
              padding: `${18 * sizeScale}px ${32 * sizeScale}px`,
              borderRadius: 999,
              background: chip.bg,
              color: chip.fg,
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 32 * sizeScale,
              letterSpacing: -0.5,
              boxShadow: "0 28px 50px -20px rgba(31,56,47,0.45), 0 6px 14px -4px rgba(31,56,47,0.2)",
              border: chip.bg === "#ffffff" ? "1px solid rgba(10,13,12,0.1)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 44 * sizeScale,
                height: 44 * sizeScale,
                borderRadius: 10 * sizeScale,
                background: chip.bg === "#ffffff" ? "#0F0F0F" : "rgba(255,255,255,0.18)",
                color: chip.bg === "#ffffff" ? "#ffffff" : chip.fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26 * sizeScale,
                ...chip.glyphStyle,
              }}
            >
              {chip.glyph}
            </span>
            {chip.name}
          </div>
        );
      })}

      {/* Logo settles in */}
      {logoAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            transform: `translate(-50%, -50%) scale(${logoScale})`,
            opacity: logoAlpha,
          }}
        >
          <ConvergeLogo size={vertical ? 220 : 200} static color={COLORS.green} />
        </div>
      )}

      {/* Payoff line — "One-stop shop for students." */}
      {payoffAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: vertical ? cy + 200 : cy + 160,
            display: "flex",
            justifyContent: "center",
            opacity: payoffAlpha,
            transform: `translateY(${payoffY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: vertical ? 36 : 44,
              color: COLORS.ink,
              letterSpacing: -0.5,
              textAlign: "center",
            }}
          >
            A one-stop shop for students.
          </div>
        </div>
      )}
    </div>
  );
};
