import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import {
  snapIn,
  snapInBack,
  clamp01,
  easeOutCubic,
  sineBob,
} from "../anim";

interface SignLanguageSceneProps {
  vertical: boolean;
}

/**
 * Sign-to-text accessibility scene (≈38.0 – 45.1s, ~213 frames @30fps).
 *
 * A "camera feed" card shows a MediaPipe-style 21-point HAND SKELETON that
 * signs "YES" (a nodding fist) and then "NO" (the index+middle "beak" snapping
 * shut against the thumb). As each sign completes, a live-transcript card to
 * the right fills in the recognised word. The message: fingerspelling / ASL is
 * turned straight into text — accessibility built in, no typing, no audio.
 *
 * Local timeline:
 *   0–14    headline + cards slide/scale in
 *   14–26   hand fades in (open palm), skeleton "draws on"
 *   26–84   YES — settle into a fist, nod ×2; "yes" locks into the transcript
 *   84–96   morph fist → two-finger "no" shape
 *   96–150  NO — index+middle snap to thumb ×2; "no" locks into the transcript
 *   150–213 hold — both words shown, "Accessibility, built in." pulses
 */

// ── 21 MediaPipe-style landmarks, normalised to a 0..1 hand box (y down) ──────
// Index map: 0 wrist · 1-4 thumb · 5-8 index · 9-12 middle · 13-16 ring ·
// 17-20 pinky (each finger: MCP, PIP, DIP, TIP).
type Pt = readonly [number, number];
type Pose = readonly Pt[];

const POSE_OPEN: Pose = [
  [0.50, 0.92], // 0 wrist
  [0.33, 0.84], [0.24, 0.76], [0.17, 0.69], [0.12, 0.63], // thumb
  [0.40, 0.60], [0.385, 0.45], [0.375, 0.34], [0.37, 0.24], // index
  [0.50, 0.58], [0.50, 0.41], [0.50, 0.29], [0.50, 0.18], // middle
  [0.60, 0.60], [0.615, 0.45], [0.625, 0.35], [0.63, 0.26], // ring
  [0.69, 0.64], [0.71, 0.52], [0.725, 0.44], [0.74, 0.36], // pinky
];

// Fist (ASL "yes") — all four fingers curled DOWN into the palm so each is a
// small loop (knuckle up a touch, tip folded back below the MCP), thumb laid
// across the front. Reads as a compact fist, not a splayed claw.
const POSE_FIST: Pose = [
  [0.50, 0.92],
  [0.34, 0.83], [0.29, 0.74], [0.39, 0.68], [0.51, 0.66], // thumb across the front
  [0.41, 0.61], [0.41, 0.54], [0.43, 0.61], [0.45, 0.67], // index curled down
  [0.50, 0.60], [0.50, 0.52], [0.52, 0.60], [0.54, 0.66], // middle curled down
  [0.59, 0.61], [0.59, 0.54], [0.57, 0.61], [0.55, 0.67], // ring curled down
  [0.67, 0.64], [0.68, 0.58], [0.66, 0.63], [0.64, 0.68], // pinky curled down
];

// "No" open — index + middle extended tall together, thumb out to the side,
// ring + pinky folded into the palm (clear two-finger silhouette).
const POSE_NO_OPEN: Pose = [
  [0.50, 0.92],
  [0.34, 0.83], [0.27, 0.82], [0.21, 0.82], [0.16, 0.83], // thumb out to the side
  [0.44, 0.60], [0.43, 0.45], [0.425, 0.33], [0.42, 0.22], // index up
  [0.53, 0.59], [0.55, 0.44], [0.565, 0.32], [0.58, 0.21], // middle up (slight splay)
  [0.62, 0.61], [0.62, 0.55], [0.60, 0.61], [0.585, 0.67], // ring folded
  [0.69, 0.64], [0.69, 0.58], [0.67, 0.63], [0.65, 0.68], // pinky folded
];

// "No" closed — index + middle bend down to meet the thumb (the beak shuts).
const POSE_NO_CLOSED: Pose = [
  [0.50, 0.92],
  [0.34, 0.83], [0.30, 0.75], [0.35, 0.67], [0.42, 0.61], // thumb up to meet fingers
  [0.44, 0.60], [0.44, 0.47], [0.45, 0.56], [0.45, 0.63], // index tip bent to thumb
  [0.53, 0.59], [0.55, 0.47], [0.52, 0.56], [0.49, 0.62], // middle tip bent to thumb
  [0.62, 0.61], [0.62, 0.55], [0.60, 0.61], [0.585, 0.67], // ring folded
  [0.69, 0.64], [0.69, 0.58], [0.67, 0.63], [0.65, 0.68], // pinky folded
];

// MediaPipe hand connections (bones).
const BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpPose(a: Pose, b: Pose, t: number): Pt[] {
  return a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)] as Pt);
}

/**
 * ASL "yes" nod — the fist pivots FORWARD at the wrist (the knuckles bend down
 * and toward the camera), NOT side to side. `bend` is 0..1 (0 = upright, 1 =
 * full forward bend). In a head-on 2D view this reads as the upper hand
 * foreshortening downward with a slight perspective scale-up — a nodding fist.
 */
function nodForward(pose: Pt[], bend: number): Pt[] {
  const [cx, cy] = pose[0]; // wrist is the pivot and stays put
  const f = clamp01(bend) * 0.62; // max forward tilt ≈ 35°
  const cos = Math.cos(f);
  const sin = Math.sin(f);
  return pose.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy; // negative above the wrist
    // Vertical foreshorten + the top edge dipping toward the viewer (down).
    const ny = cy + dy * cos - dy * sin * 0.5;
    // Subtle scale-out as the knuckles come toward the camera (depth cue).
    const depth = -dy * sin; // >0 for upper points when bending forward
    const s = 1 + depth * 0.08;
    return [cx + dx * s, ny] as Pt;
  });
}

/** Triangle wave 0→1→0 used for the "beak snap" and fist nod. */
function triangle(x: number): number {
  const f = ((x % 1) + 1) % 1;
  return f < 0.5 ? f * 2 : 2 - f * 2;
}

export const SignLanguageScene: React.FC<SignLanguageSceneProps> = ({
  vertical,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ── Headline + sub ────────────────────────────────────────────────────────
  const headAlpha = snapIn(frame, 12);
  const subAlpha = snapIn(frame - 8, 12);

  // ── Compute the current hand pose ─────────────────────────────────────────
  const YES_SETTLE = 40; // open → fist
  const YES_END = 84;
  const NO_MORPH_END = 96;
  const NO_END = 150;

  let pose: Pt[];
  if (frame < YES_SETTLE) {
    // Open palm settling into the fist.
    const t = easeOutCubic(clamp01((frame - 14) / (YES_SETTLE - 14)));
    pose = lerpPose(POSE_OPEN, POSE_FIST, t);
  } else if (frame < YES_END) {
    // Hold the fist and NOD it forward/back (ASL "yes") — two forward bends.
    const local = frame - YES_SETTLE; // 0..44
    const span = YES_END - YES_SETTLE;
    const cycles = 2;
    // (1 - cos)/2 gives a 0→1→0 forward dip per cycle (forward-only, no sway).
    const bend = (1 - Math.cos((local / span) * Math.PI * 2 * cycles)) / 2;
    pose = nodForward(POSE_FIST as Pt[], bend);
  } else if (frame < NO_MORPH_END) {
    // Morph the fist into the two-finger "no" shape.
    const t = easeOutCubic(clamp01((frame - YES_END) / (NO_MORPH_END - YES_END)));
    pose = lerpPose(POSE_FIST, POSE_NO_OPEN, t);
  } else if (frame < NO_END) {
    // Snap index+middle shut against the thumb ("no") — two snaps.
    const local = frame - NO_MORPH_END; // 0..54
    const snaps = 2;
    const close = triangle((local / (NO_END - NO_MORPH_END)) * snaps);
    pose = lerpPose(POSE_NO_OPEN, POSE_NO_CLOSED, easeOutCubic(close));
  } else {
    // Hold the open "no" shape, gentle bob.
    pose = POSE_NO_OPEN as Pt[];
  }

  // Skeleton draw-on + a continuous breathing bob so it never feels static.
  const handAlpha = snapIn(frame - 12, 14);
  const bobY = sineBob(frame, 70, 0.008);

  // ── Camera card geometry ──────────────────────────────────────────────────
  const camW = vertical ? width * 0.84 : width * 0.42;
  const camH = vertical ? height * 0.36 : height * 0.52;
  const camX = vertical ? (width - camW) / 2 : width * 0.07;
  const camY = vertical ? height * 0.30 : height * 0.30;

  // Map a normalised hand point into camera-card pixels.
  const toPx = (p: Pt): [number, number] => [p[0] * camW, (p[1] + bobY) * camH];

  // Hand bounding box (for the tracking overlay) in card space.
  const xs = pose.map((p) => p[0]);
  const ys = pose.map((p) => p[1] + bobY);
  const bb = {
    x: (Math.min(...xs) - 0.05) * camW,
    y: (Math.min(...ys) - 0.05) * camH,
    w: (Math.max(...xs) - Math.min(...xs) + 0.10) * camW,
    h: (Math.max(...ys) - Math.min(...ys) + 0.10) * camH,
  };

  // ── Transcript timing — words lock in as each sign resolves ───────────────
  const YES_LOCK = 64; // just after the second nod
  const NO_LOCK = 138; // just after the second beak snap
  const yesIn = snapInBack(frame - YES_LOCK, 12, 1.5);
  const noIn = snapInBack(frame - NO_LOCK, 12, 1.5);
  // Recognition ring flashes on the camera as a word locks.
  const ringFor = (lock: number): number => {
    const l = frame - lock;
    return l < 0 || l > 20 ? 0 : Math.sin((l / 20) * Math.PI);
  };
  const yesRing = ringFor(YES_LOCK);
  const noRing = ringFor(NO_LOCK);

  // ── Tagline ───────────────────────────────────────────────────────────────
  const tagAlpha = snapInBack(frame - 158, 14, 1.3);
  const tagPulse = 0.5 + 0.5 * Math.sin((frame / 26) * Math.PI * 2);

  const boneStroke = vertical ? 5 : 6;
  const jointR = vertical ? 7 : 8;
  const tipR = vertical ? 10 : 12;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: vertical ? "8%" : "9%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "0 5%",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: vertical ? 78 : 96,
            letterSpacing: -3,
            color: COLORS.green,
            textAlign: "center",
            lineHeight: 1.0,
            opacity: headAlpha,
            transform: `translateY(${(1 - headAlpha) * 14}px)`,
          }}
        >
          Sign it. We&rsquo;ll type it.
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: vertical ? 26 : 32,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: vertical ? 760 : 1080,
            opacity: subAlpha,
            transform: `translateY(${(1 - subAlpha) * 10}px)`,
          }}
        >
          Fingerspelling &amp; sign language &rarr; live text.{" "}
          <span style={{ color: COLORS.greenMid, fontWeight: 700 }}>
            Accessibility, built in.
          </span>
        </div>
      </div>

      {/* ── Camera feed card ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: camX,
          top: camY,
          width: camW,
          height: camH,
          borderRadius: 28,
          overflow: "hidden",
          background:
            "linear-gradient(160deg, #11271e 0%, #15382a 55%, #0e2018 100%)",
          border: `1.5px solid ${COLORS.green}`,
          boxShadow: "0 34px 70px -26px rgba(15,32,24,0.55)",
          opacity: snapIn(frame, 12),
          transform: `scale(${0.96 + 0.04 * snapIn(frame, 12)})`,
        }}
      >
        {/* faint scan grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              `linear-gradient(${COLORS.greenBright}14 1px, transparent 1px),` +
              `linear-gradient(90deg, ${COLORS.greenBright}14 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            opacity: 0.5,
          }}
        />

        {/* top status bar */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 18,
            right: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: FONT_BODY,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: `1px solid ${COLORS.greenBright}55`,
              color: "#eafff0",
              fontSize: vertical ? 15 : 17,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: COLORS.red,
                opacity: 0.6 + 0.4 * Math.sin((frame / 8) * Math.PI),
                boxShadow: `0 0 10px ${COLORS.red}`,
              }}
            />
            LIVE
          </div>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(123,216,143,0.16)",
              border: `1px solid ${COLORS.greenBright}66`,
              color: COLORS.greenBright,
              fontSize: vertical ? 14 : 16,
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            🤟 Hand tracking · 99%
          </div>
        </div>

        {/* hand skeleton + tracking overlay */}
        <svg
          width={camW}
          height={camH}
          style={{ position: "absolute", inset: 0, opacity: handAlpha }}
        >
          {/* tracking bounding box with corner brackets */}
          <rect
            x={bb.x}
            y={bb.y}
            width={bb.w}
            height={bb.h}
            rx={14}
            fill="none"
            stroke={`${COLORS.greenBright}`}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="2 7"
          />
          {[
            [bb.x, bb.y, 1, 1],
            [bb.x + bb.w, bb.y, -1, 1],
            [bb.x, bb.y + bb.h, 1, -1],
            [bb.x + bb.w, bb.y + bb.h, -1, -1],
          ].map(([cx, cy, sx, sy], i) => (
            <path
              key={i}
              d={`M ${cx} ${cy + sy * 18} L ${cx} ${cy} L ${cx + sx * 18} ${cy}`}
              fill="none"
              stroke={COLORS.greenBright}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}

          {/* recognition rings (pulse when a word locks) */}
          {[yesRing, noRing].map((amt, i) =>
            amt > 0.01 ? (
              <circle
                key={`ring-${i}`}
                cx={bb.x + bb.w / 2}
                cy={bb.y + bb.h / 2}
                r={(bb.w / 2 + 10) * (0.7 + 0.5 * amt)}
                fill="none"
                stroke={COLORS.greenBright}
                strokeWidth={4}
                strokeOpacity={amt * 0.8}
              />
            ) : null,
          )}

          {/* bones */}
          {BONES.map(([a, b], i) => {
            const [x1, y1] = toPx(pose[a]);
            const [x2, y2] = toPx(pose[b]);
            return (
              <line
                key={`bone-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={COLORS.greenBright}
                strokeWidth={boneStroke}
                strokeOpacity={0.9}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${COLORS.greenBright}cc)` }}
              />
            );
          })}

          {/* joints */}
          {pose.map((p, i) => {
            const [x, y] = toPx(p);
            const isTip = FINGERTIPS.has(i);
            const isWrist = i === 0;
            return (
              <circle
                key={`joint-${i}`}
                cx={x}
                cy={y}
                r={isWrist ? tipR + 2 : isTip ? tipR : jointR}
                fill={isTip ? COLORS.greenBright : "#eafff0"}
                stroke={COLORS.green}
                strokeWidth={1.5}
                style={{
                  filter: isTip
                    ? `drop-shadow(0 0 8px ${COLORS.greenBright})`
                    : "none",
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* ── Live-transcript card ─────────────────────────────────────────── */}
      <TranscriptCard
        vertical={vertical}
        width={width}
        height={height}
        yesIn={yesIn}
        noIn={noIn}
      />

      {/* ── Tagline pill ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: vertical ? "6%" : "6.5%",
          display: "flex",
          justifyContent: "center",
          opacity: clamp01(tagAlpha),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: vertical ? "12px 26px" : "13px 30px",
            borderRadius: 999,
            background: COLORS.green,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: vertical ? 26 : 30,
            letterSpacing: -0.4,
            transform: `scale(${0.92 + 0.08 * clamp01(tagAlpha)})`,
            boxShadow: `0 18px 40px -16px rgba(31,56,47,0.5), 0 0 ${
              16 + 22 * tagPulse
            }px ${COLORS.greenBright}66`,
          }}
        >
          <span style={{ fontSize: vertical ? 30 : 34 }}>🤟</span>
          Accessibility, built in.
        </div>
      </div>
    </div>
  );
};

// ── Transcript card ──────────────────────────────────────────────────────────
interface TranscriptCardProps {
  vertical: boolean;
  width: number;
  height: number;
  yesIn: number;
  noIn: number;
}

const TranscriptCard: React.FC<TranscriptCardProps> = ({
  vertical,
  width,
  height,
  yesIn,
  noIn,
}) => {
  const frame = useCurrentFrame();
  const cardW = vertical ? width * 0.84 : width * 0.40;
  const cardH = vertical ? height * 0.22 : height * 0.52;
  const cardX = vertical ? (width - cardW) / 2 : width * 0.53;
  const cardY = vertical ? height * 0.68 : height * 0.30;
  const cardAlpha = snapIn(frame - 4, 12);

  const caretOn = Math.floor(frame / 15) % 2 === 0;

  const rows: Array<{ word: string; alpha: number }> = [
    { word: "yes", alpha: clamp01(yesIn) },
    { word: "no", alpha: clamp01(noIn) },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: cardX,
        top: cardY,
        width: cardW,
        height: cardH,
        borderRadius: 28,
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.greenDeepSoft}`,
        boxShadow: "0 34px 70px -26px rgba(31,56,47,0.32)",
        opacity: cardAlpha,
        transform: `scale(${0.96 + 0.04 * cardAlpha})`,
        padding: vertical ? "22px 26px" : "30px 34px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: COLORS.greenMid,
            boxShadow: `0 0 10px ${COLORS.greenBright}`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: vertical ? 26 : 32,
            color: COLORS.green,
            letterSpacing: -0.6,
          }}
        >
          Live transcript
        </span>
      </div>

      {/* recognised words */}
      <div
        style={{
          marginTop: vertical ? 18 : 30,
          display: "flex",
          flexDirection: "column",
          gap: vertical ? 12 : 18,
          flex: 1,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.word}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: r.alpha,
              transform: `translateX(${(1 - r.alpha) * -18}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: vertical ? 44 : 58,
                color: COLORS.ink,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              &ldquo;{r.word}&rdquo;
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: vertical ? 30 : 38,
                height: vertical ? 30 : 38,
                borderRadius: "50%",
                background: COLORS.greenSoft,
                border: `2px solid ${COLORS.greenBright}`,
                color: COLORS.greenMid,
                fontSize: vertical ? 18 : 22,
                fontWeight: 800,
                transform: `scale(${0.6 + 0.4 * r.alpha})`,
              }}
            >
              ✓
            </span>
          </div>
        ))}

        {/* blinking caret line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: vertical ? 44 : 58,
          }}
        >
          <span
            style={{
              width: 4,
              height: vertical ? 34 : 46,
              background: COLORS.greenMid,
              opacity: caretOn ? 1 : 0.15,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* footer caption */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 400,
          fontSize: vertical ? 17 : 21,
          color: COLORS.muted,
          borderTop: `1px solid ${COLORS.greenSoft}`,
          paddingTop: vertical ? 12 : 16,
        }}
      >
        Recognised from sign &mdash; no typing, no audio.
      </div>
    </div>
  );
};
