import React from "react";
import { useCurrentFrame, interpolate, staticFile, Img } from "remotion";
import { ConvergeLogo } from "../components/ConvergeLogo";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import { snapIn, snapInBack, easeOutQuart } from "../anim";

interface LockupSceneProps {
  vertical: boolean;
}

/**
 * 23.94 – 30.00s (≈ 182 frames). Final lockup.
 *
 *   0–24    Three brand logos (Wispr Flow / Canvas / Notion) snap in with
 *           their product names beneath. Each labelled card sits in a row.
 *   24–48   The three cards converge toward center, scaling down and sliding
 *           toward a single point. A brief white-green flash fires at the
 *           merge moment to mask the swap.
 *   42–66   Converge logo punches in where the cards merged + small ring
 *   58–80   Converge wordmark fades in
 *   76–96   Feature row — Record · Upload · Notes · Flashcards · Quizzes
 *   92–112  CTA pill snaps in (no continuous pulse)
 *   112–170 hold
 *   170–182 soft fade
 */
export const LockupScene: React.FC<LockupSceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();

  // ── Three brand logos ───────────────────────────────────────────────────
  const brands = [
    {
      key: "wispr",
      src: "logos/wispr.png",
      label: "Wispr Flow",
      // px width — matches captured asset's aspect after scaling
      width: vertical ? 150 : 200,
      height: vertical ? 56 : 72,
      radius: 0,
    },
    {
      key: "canvas",
      src: "logos/canvas.png",
      label: "Canvas",
      // Official red Canvas logomark — a square app-icon tile, not a wordmark.
      width: vertical ? 84 : 104,
      height: vertical ? 84 : 104,
      radius: vertical ? 18 : 22,
    },
    {
      key: "notion",
      src: "logos/notion.png",
      label: "Notion",
      width: vertical ? 72 : 92,
      height: vertical ? 72 : 92,
      radius: 0,
    },
  ];

  // Layout — brand cards positioned at three points around center
  const spread = vertical ? 230 : 380;

  // ── Phase 1: brand cards enter + hold ──────────────────────────────────
  const cardsAlpha = snapInBack(frame, 14, 1.25);
  // Converge phase 24-48: scale down + slide toward center
  const convergeT = interpolate(frame, [24, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const convergeEased = easeOutQuart(convergeT);
  const cardScale = 1 - 0.7 * convergeEased; // 1.0 → 0.3
  const cardOpacity = (1 - convergeEased) * cardsAlpha;
  // Bright flash mask at merge
  const flashT = interpolate(frame, [38, 46, 56], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase 2: Converge brand ────────────────────────────────────────────
  const logoAlpha = snapInBack(frame - 46, 14, 1.5);
  const wordmarkAlpha = snapIn(frame - 58, 14);
  const featuresAlpha = snapIn(frame - 76, 14);
  const ctaAlpha = snapInBack(frame - 92, 14, 1.4);

  const fadeOut = interpolate(frame, [170, 182], [1, 0.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const FEATURES = ["Record", "Upload", "Notes", "Flashcards", "Quizzes"];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: fadeOut,
      }}
    >
      {/* Phase 1 — three brand logos converging */}
      {cardOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: cardOpacity,
          }}
        >
          <div style={{ position: "relative", width: 1, height: 1 }}>
            {brands.map((b, i) => {
              // Initial slot positions in a horizontal row centered on the
              // 1-pixel parent (which sits in the middle of the frame).
              const slotX = (i - 1) * spread; // -spread, 0, +spread
              const slotY = 0;
              // During converge, both X and Y collapse to 0.
              const x = slotX * (1 - convergeEased);
              const y = slotY * (1 - convergeEased);
              // Per-card stagger on entry
              const entry = snapInBack(frame - i * 4, 12, 1.4);
              return (
                <div
                  key={b.key}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) scale(${cardScale * (0.92 + 0.08 * entry)})`,
                    opacity: entry,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: vertical ? 10 : 14,
                  }}
                >
                  {/* Logo card */}
                  <div
                    style={{
                      padding: vertical ? "22px 26px" : "26px 34px",
                      borderRadius: 22,
                      background: "#fff",
                      border: `1.5px solid ${COLORS.greenDeepSoft}`,
                      boxShadow: "0 28px 56px -22px rgba(31,56,47,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: b.width + 40,
                      minHeight: b.height + 32,
                    }}
                  >
                    <Img
                      src={staticFile(b.src)}
                      style={{
                        width: b.width,
                        height: b.height,
                        objectFit: "contain",
                        borderRadius: b.radius,
                      }}
                    />
                  </div>
                  {/* Product name label */}
                  <div
                    style={{
                      fontFamily: FONT_BODY,
                      fontWeight: 700,
                      fontSize: vertical ? 18 : 22,
                      color: COLORS.green,
                      letterSpacing: -0.3,
                    }}
                  >
                    {b.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Merge flash */}
      {flashT > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 80 + flashT * 540,
            height: 80 + flashT * 540,
            marginLeft: -(80 + flashT * 540) / 2,
            marginTop: -(80 + flashT * 540) / 2,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: flashT * 0.95,
            filter: `blur(${10 + flashT * 30}px)`,
            boxShadow: `0 0 ${60 + flashT * 80}px ${COLORS.greenBright}`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Phase 2 — Converge lockup */}
      {logoAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: vertical ? 18 : 16,
          }}
        >
          <div
            style={{
              opacity: logoAlpha,
              transform: `translateY(${(1 - logoAlpha) * 14}px) scale(${0.85 + 0.15 * logoAlpha})`,
            }}
          >
            <ConvergeLogo size={vertical ? 140 : 120} static color={COLORS.green} />
          </div>

          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: vertical ? 110 : 130,
              letterSpacing: "-0.04em",
              color: COLORS.green,
              opacity: wordmarkAlpha,
              transform: `translateY(${(1 - wordmarkAlpha) * 18}px)`,
              lineHeight: 1,
            }}
          >
            Converge
          </div>

          {/* Feature row */}
          <div
            style={{
              marginTop: vertical ? 10 : 6,
              display: "flex",
              gap: vertical ? 10 : 14,
              flexWrap: "wrap",
              justifyContent: "center",
              opacity: featuresAlpha,
              transform: `translateY(${(1 - featuresAlpha) * 12}px)`,
              padding: "0 6%",
            }}
          >
            {FEATURES.map((f, i) => {
              const itemAlpha = snapInBack(frame - 76 - i * 3, 10, 1.4);
              return (
                <div
                  key={f}
                  style={{
                    padding: vertical ? "8px 14px" : "10px 18px",
                    borderRadius: 999,
                    background: "#fff",
                    border: `1.5px solid ${COLORS.greenDeepSoft}`,
                    color: COLORS.green,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: vertical ? 18 : 22,
                    letterSpacing: -0.3,
                    opacity: itemAlpha,
                    transform: `scale(${0.9 + 0.1 * itemAlpha})`,
                    whiteSpace: "nowrap",
                    boxShadow: "0 8px 18px -10px rgba(31,56,47,0.3)",
                  }}
                >
                  {f}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: vertical ? 22 : 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: vertical ? "18px 38px" : "16px 36px",
              borderRadius: 999,
              background: COLORS.green,
              color: "#fff",
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: vertical ? 36 : 30,
              letterSpacing: -0.5,
              boxShadow: "0 24px 50px -16px rgba(31,56,47,0.5)",
              opacity: ctaAlpha,
              transform: `translateY(${(1 - ctaAlpha) * 14}px) scale(${0.92 + 0.08 * ctaAlpha})`,
            }}
          >
            Start studying
            <span style={{ fontSize: vertical ? 42 : 36, lineHeight: 1 }}>→</span>
          </div>
        </div>
      )}
    </div>
  );
};
