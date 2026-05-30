import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { snapIn, snapInBack, easeOutQuart, easeOutCubic } from "../anim";
import { AnimatedCursor, type CursorWaypoint } from "../components/AnimatedCursor";

/**
 * Capture answer panel — replaces the MacBook for QA1. A floating note card
 * appears at normal size, the cursor clicks Record, captions start typing as
 * the speaker talks, the camera orbits around the card, then dives in close
 * at an upward angle so the final frame is a low-angle hero of the card
 * filling the screen.
 *
 * 75-frame answer window:
 *   0–14   card snap-in (subtle overshoot)
 *   14–24  cursor enters and approaches the Record button
 *   24–28  click impact (CLICK_AT = 26); REC turns red and starts pulsing
 *   28–50  text types into the card while it sits roughly centered
 *   45–60  camera orbits — rotateY sweeps from 0° toward +28°
 *   58–75  camera dives in close + tilts up — scale to ~1.65, rotateX climbs
 *          past 0° so the bottom of the card lifts toward camera (low angle)
 */
const TOTAL = 75;
const CLICK_AT = 26;

const CAPTION_LINES = [
  "Today we'll cover oxidative phosphorylation,",
  "the final stage of cellular respiration.",
  "NADH and FADH₂ donate electrons to the chain.",
];

interface MicIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const MicIcon: React.FC<MicIconProps> = ({ size = 18, color = "#fff", strokeWidth = 2 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Mic capsule */}
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    {/* Mic stand arc */}
    <path d="M5.5 11.5v1a6.5 6.5 0 0 0 13 0v-1" />
    {/* Mic base */}
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8.5" y1="22" x2="15.5" y2="22" />
  </svg>
);

function typed(text: string, frames: number, charsPerFrame: number): string {
  const n = Math.max(0, Math.min(text.length, Math.floor(frames * charsPerFrame)));
  return text.slice(0, n);
}

export const CaptureCardAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => {
  // ── Card entry ───────────────────────────────────────────────────────────
  const enterAlpha = snapInBack(localFrame, 14, 1.25);

  // ── Click pop on the device ──────────────────────────────────────────────
  const sinceClick = localFrame - CLICK_AT;
  const clickPop =
    sinceClick >= 0 && sinceClick < 8
      ? 1 + 0.04 * (1 - sinceClick / 8)
      : 1;

  // ── Camera: idle hold, then orbit, then dive-in low-angle close-up ──────
  // Keyframes are paced off `total` so the orbit + dive fill the whole answer
  // window (no static tail on the longer ~6s scenes).
  const k = (f: number): number => Math.round(total * f);
  // Orbit (rotateY) — starts gently from -6°, sweeps to +28° late in the scene
  const tiltY = interpolate(
    localFrame,
    [0, 14, k(0.6), k(0.83), total],
    [-12, -6, 4, 28, 32],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Dive-in look-up (rotateX) — positive rotateX = looking UP at the card
  const tiltX = interpolate(localFrame, [0, k(0.66), total], [-3, 6, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Roll — a tiny back-and-forth for liveliness
  const rollZ = interpolate(
    localFrame,
    [0, k(0.4), k(0.8), total],
    [-1, 0, -1.5, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Scale — normal-sized for most of the scene, then dramatic dive past 1.6
  const scaleRaw = interpolate(
    localFrame,
    [0, 14, k(0.77), total],
    [0.86, 1.0, 1.05, 1.65],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const camScale = scaleRaw * clickPop;

  // ── REC pulse + caption typing kick in after the click ───────────────────
  const recAlpha = snapInBack(sinceClick - 1, 8, 1.5);
  const recBlink = 0.55 + 0.45 * Math.sin((localFrame / 30) * 2 * Math.PI * 2.4);

  // Caption typing starts ~6 frames after click; 1.6 chars/frame (≈48 cpm)
  const captionStart = CLICK_AT + 6;
  const captionFrames = Math.max(0, localFrame - captionStart);
  const PER_LINE = 22;
  let used = captionFrames;
  const lines: { text: string; full: boolean }[] = [];
  for (const raw of CAPTION_LINES) {
    if (used <= 0) {
      lines.push({ text: "", full: false });
      continue;
    }
    if (used >= PER_LINE) {
      lines.push({ text: raw, full: true });
      used -= PER_LINE;
    } else {
      lines.push({ text: typed(raw, used, 1.55), full: false });
      used = 0;
    }
  }

  // ── Cursor path — enters from the lower-right, lands on Record button ────
  // Record button is positioned at top-right of the card; click coords are
  // in CARD-percent space (the card overlay covers the entire card box).
  // Mic button center in CARD-percent: header padding (22px) + half the 64px
  // button → ≈10% down; right padding (30px) + half button → ≈93% across.
  const recButtonPct = { x: 93, y: 10 };
  const waypoints: CursorWaypoint[] = [
    { atFrame: 4, x: 120, y: 105 },
    { atFrame: 16, x: 86, y: 52, ease: "smooth" },
    { atFrame: 22, x: 90, y: 17, ease: "smooth" }, // hover wobble just below the mic
    { atFrame: CLICK_AT, x: recButtonPct.x, y: recButtonPct.y, click: true, ease: "snap" },
    { atFrame: CLICK_AT + 24, x: 108, y: 24, ease: "smooth" },
  ];

  const cardW = vertical ? 700 : 940;
  const cardH = vertical ? 440 : 540;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "2400px",
      }}
    >
      <div
        style={{
          width: cardW,
          height: cardH,
          transformStyle: "preserve-3d",
          transform: `rotateY(${tiltY}deg) rotateX(${tiltX}deg) rotateZ(${rollZ}deg) scale(${camScale})`,
          transformOrigin: "center 70%",
          opacity: enterAlpha,
        }}
      >
        {/* Drop shadow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -36,
            transform: "translateX(-50%)",
            width: cardW * 0.85,
            height: 44,
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(31,56,47,0.42) 0%, rgba(31,56,47,0) 70%)",
            filter: "blur(10px)",
          }}
        />

        {/* The card */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            background: "#ffffff",
            border: `1.5px solid ${COLORS.greenDeepSoft}`,
            boxShadow:
              "0 60px 120px -30px rgba(31,56,47,0.55), 0 24px 50px -14px rgba(31,56,47,0.3)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Card chrome — header with title + REC pill */}
          <div
            style={{
              padding: vertical ? "20px 26px" : "22px 30px",
              borderBottom: `1px solid ${COLORS.greenDeepSoft}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background:
                "linear-gradient(180deg, rgba(232,240,235,0.55) 0%, rgba(232,240,235,0) 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: 12,
                  color: COLORS.greenMid,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                }}
              >
                New lecture
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: vertical ? 26 : 32,
                  color: COLORS.ink,
                  letterSpacing: -0.6,
                  lineHeight: 1.1,
                }}
              >
                Biology · Lecture 14
              </div>
            </div>

            {/* REC button */}
            <div
              style={{
                position: "relative",
                width: vertical ? 56 : 64,
                height: vertical ? 56 : 64,
                borderRadius: "50%",
                background: recAlpha > 0.05 ? COLORS.red : "#ececec",
                border: `3px solid ${recAlpha > 0.05 ? COLORS.red : COLORS.greenDeepSoft}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.8,
                boxShadow:
                  recAlpha > 0.05
                    ? `0 0 ${10 + recBlink * 16}px ${COLORS.red}`
                    : "inset 0 1px 0 rgba(255,255,255,0.6)",
                opacity: recAlpha > 0 ? 1 : 0.85,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: recAlpha > 0.05 ? recBlink : 1,
                }}
              >
                <MicIcon
                  size={22}
                  color={recAlpha > 0.05 ? "#fff" : COLORS.green}
                  strokeWidth={2.2}
                />
              </div>
            </div>
          </div>

          {/* Body — captions typing in */}
          <div
            style={{
              padding: vertical ? "22px 26px" : "28px 32px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: vertical ? 22 : 26,
                  color: l.full ? COLORS.ink : COLORS.inkSoft,
                  lineHeight: 1.4,
                  minHeight: vertical ? 26 : 30,
                  opacity: l.text ? 1 : 0,
                }}
              >
                {l.text}
                {!l.full && l.text && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2.5,
                      height: vertical ? 22 : 26,
                      background: COLORS.greenBright,
                      marginLeft: 4,
                      verticalAlign: "text-top",
                      opacity: localFrame % 16 < 8 ? 1 : 0,
                    }}
                  />
                )}
              </div>
            ))}
            {recAlpha > 0.1 && (
              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: vertical ? 16 : 18,
                  color: COLORS.red,
                  opacity: snapIn(sinceClick - 4, 8),
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: COLORS.red,
                    opacity: recBlink,
                    boxShadow: `0 0 ${4 + recBlink * 8}px ${COLORS.red}`,
                  }}
                />
                Recording · live captions
              </div>
            )}
          </div>

          {/* Cursor overlay — clicks the Record button */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <AnimatedCursor
              localFrame={localFrame}
              waypoints={waypoints}
              enterAt={0}
              exitAt={CLICK_AT + 28}
              scale={1.0}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
