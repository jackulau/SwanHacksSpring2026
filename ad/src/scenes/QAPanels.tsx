import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { snapIn, snapInBack, easeOutQuart, clamp01 } from "../anim";
import { MacBook } from "../components/Device";
import { AnimatedCursor, type CursorWaypoint } from "../components/AnimatedCursor";
import {
  NotesOverlay,
  FlashcardsOverlay,
  QuizOverlay,
} from "../components/ScreenOverlays";

/**
 * One MacBook-centered answer panel: feature screenshot inside the chassis, a
 * cursor traverses to the CTA, clicks at CLICK_AT, the screen-overlay reacts.
 *
 * The camera does a punchy entrance push (over ~55 frames) and then a slow
 * continuous glide for the rest of the answer window (`total` frames) so the
 * shot never freezes — even on the longer ~6s scenes.
 */
interface MacBookAnswerProps {
  localFrame: number;
  vertical: boolean;
  total: number;
  screenSrc: string;
  /** Cursor click target in screen-area percent */
  clickX: number;
  clickY: number;
  /** Cursor entry corner in screen-area percent */
  enterFrom: { x: number; y: number };
  /** Camera animation range (entrance push targets) */
  tiltY: [number, number];
  tiltX: [number, number];
  scale: [number, number];
  yPx: [number, number];
  Overlay: React.FC<{ local: number; clickAt: number }>;
}

const CLICK_AT = 26;

const MacBookAnswer: React.FC<MacBookAnswerProps> = ({
  localFrame,
  vertical,
  total,
  screenSrc,
  clickX,
  clickY,
  enterFrom,
  tiltY,
  tiltX,
  scale,
  yPx,
  Overlay,
}) => {
  const macW = vertical ? 880 : 1280;

  // Snap-in alpha for the device — pops in as the blade clears it
  const stageAlpha = snapInBack(localFrame, 14, 1.2);

  // Punchy entrance push (settles by ~55f) + continuous slow glide to `total`
  const pushT = easeOutQuart(clamp01(localFrame / 55));
  const glide = clamp01(localFrame / Math.max(1, total));
  const tY = tiltY[0] + (tiltY[1] - tiltY[0]) * pushT - 3 * glide;
  const tX = tiltX[0] + (tiltX[1] - tiltX[0]) * pushT + 4 * glide;
  const sc = scale[0] + (scale[1] - scale[0]) * pushT + 0.06 * glide;
  const y = yPx[0] + (yPx[1] - yPx[0]) * pushT - 10 * glide;

  // Click micro-shake
  const sinceClick = localFrame - CLICK_AT;
  const shake =
    sinceClick >= 0 && sinceClick < 6
      ? Math.sin(sinceClick * 10) * 7 * (1 - sinceClick / 6)
      : 0;
  const clickPop =
    sinceClick >= 0 && sinceClick < 8 ? 1 + 0.02 * (1 - sinceClick / 8) : 1;

  const waypoints: CursorWaypoint[] = [
    { atFrame: 4, x: enterFrom.x, y: enterFrom.y },
    {
      atFrame: 16,
      x: clickX + (enterFrom.x - clickX) * 0.35,
      y: clickY + (enterFrom.y - clickY) * 0.35,
      ease: "smooth",
    },
    { atFrame: 22, x: clickX + 3, y: clickY - 2, ease: "smooth" },
    { atFrame: CLICK_AT, x: clickX, y: clickY, click: true, ease: "snap" },
    {
      atFrame: CLICK_AT + 26,
      x: clickX + (enterFrom.x > 50 ? -12 : 12),
      y: clickY + 6,
      ease: "smooth",
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${y + shake}px) scale(${sc * (0.92 + 0.08 * stageAlpha) * clickPop})`,
          opacity: stageAlpha,
        }}
      >
        <MacBook
          screenSrc={screenSrc}
          width={macW}
          tiltY={tY}
          tiltX={tX}
          rollZ={0}
          glare={0.7}
          overlay={
            <>
              <Overlay local={localFrame} clickAt={CLICK_AT} />
              <AnimatedCursor
                localFrame={localFrame}
                waypoints={waypoints}
                enterAt={0}
                exitAt={CLICK_AT + 30}
                scale={1.1}
              />
            </>
          }
        />
      </div>
    </div>
  );
};

// ── Answer panels ────────────────────────────────────────────────────────────

export const NotesAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => (
  <MacBookAnswer
    localFrame={localFrame}
    vertical={vertical}
    total={total}
    screenSrc="screens/lecture-bio-light.png"
    clickX={91.4}
    clickY={12}
    enterFrom={{ x: -10, y: 95 }}
    tiltY={[20, -8]}
    tiltX={[8, 0]}
    scale={[0.92, 1.16]}
    yPx={[16, -22]}
    Overlay={NotesOverlay}
  />
);

export const FlashcardsAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => (
  <MacBookAnswer
    localFrame={localFrame}
    vertical={vertical}
    total={total}
    screenSrc="screens/lecture-flashcards-light.png"
    clickX={38.9}
    clickY={47.3}
    enterFrom={{ x: 110, y: -10 }}
    tiltY={[-18, 0]}
    tiltX={[-14, 20]}
    scale={[0.9, 1.14]}
    yPx={[-26, -10]}
    Overlay={FlashcardsOverlay}
  />
);

// ── Quiz answer: the quiz card is on screen the whole beat; the cursor picks
// the correct option (B · Oxygen) which snaps green. (See QuizOverlay.) ───────

export const QuizAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => {
  const macW = vertical ? 880 : 1280;
  const PICK_CLICK = 34; // cursor lands on the correct option

  const stageAlpha = snapInBack(localFrame, 14, 1.2);

  const pushT = easeOutQuart(clamp01(localFrame / 55));
  const glide = clamp01(localFrame / Math.max(1, total));
  const tiltY = -12 + 12 * pushT - 3 * glide;
  const tiltX = -8 + 16 * pushT + 4 * glide;
  const stageScale = 0.92 + 0.16 * pushT + 0.06 * glide;
  const yOffset = -8 - 8 * glide;

  const sincePick = localFrame - PICK_CLICK;
  const pop = sincePick >= 0 && sincePick < 8 ? 1 + 0.025 * (1 - sincePick / 8) : 1;
  const shake =
    sincePick >= 0 && sincePick < 6 ? Math.sin(sincePick * 10) * 6 * (1 - sincePick / 6) : 0;

  const waypoints: CursorWaypoint[] = [
    { atFrame: 4, x: 108, y: 90 },
    { atFrame: 18, x: 70, y: 66, ease: "smooth" },
    { atFrame: 26, x: 54, y: 58, ease: "smooth" },
    { atFrame: PICK_CLICK, x: 50, y: 55, click: true, ease: "snap" },
    { atFrame: PICK_CLICK + 18, x: 42, y: 66, ease: "smooth" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${yOffset + shake}px) scale(${stageScale * (0.92 + 0.08 * stageAlpha) * pop})`,
          opacity: stageAlpha,
        }}
      >
        <MacBook
          screenSrc="screens/lecture-quiz-light.png"
          width={macW}
          tiltY={tiltY}
          tiltX={tiltX}
          rollZ={0}
          glare={0.7}
          overlay={
            <>
              <QuizOverlay local={localFrame} clickAt={PICK_CLICK} />
              <AnimatedCursor
                localFrame={localFrame}
                waypoints={waypoints}
                enterAt={0}
                exitAt={PICK_CLICK + 24}
                scale={1.1}
              />
            </>
          }
        />
      </div>
    </div>
  );
};

// ── Canvas answer: click Sync in Canvas, then Converge auto-generates notes +
// quizzes for every synced class. This is the explicit value-prop beat. ──────

const CANVAS_COURSES = [
  { code: "BIO 201", name: "Cell Biology" },
  { code: "MATH 204", name: "Linear Algebra" },
  { code: "COG 110", name: "Memory & Cognition" },
];

export const CanvasAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => {
  const macW = vertical ? 720 : 1180;
  const macH = Math.round(macW * 0.683); // matches MacBook chassis ratio (16:10 inner screen)

  const laptopAlpha = snapInBack(localFrame, 12, 1.2);

  // Camera push + slow glide
  const pushT = easeOutQuart(clamp01(localFrame / 55));
  const glide = clamp01(localFrame / Math.max(1, total));
  const tY = -12 + 8 * pushT - 3 * glide;
  const tX = -6 + 16 * pushT + 4 * glide;
  const scale = 0.92 + 0.14 * pushT + 0.05 * glide;

  // The Canvas screenshot (which already shows the Converge "Synced!" popup)
  // holds for a beat, then gives way to the auto-generation panel. No extra
  // cursor — the screenshot already tells the sync story.
  const genStart = 16;
  const swap = clamp01((localFrame - genStart) / 14);
  const sinceGen = localFrame - genStart;
  const canvasPop =
    sinceGen >= 0 && sinceGen < 8 ? 1 + 0.025 * (1 - sinceGen / 8) : 1;

  // Generation panel — one row per course, each spawning Notes + Quiz pills.
  const genPanel = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.cream,
        opacity: swap,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "7%",
          right: "7%",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: "#e2453a",
          }}
        />
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 30,
            color: COLORS.ink,
            letterSpacing: -0.6,
          }}
        >
          Synced from Canvas
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 18,
            color: COLORS.greenMid,
          }}
        >
          3 courses
        </span>
      </div>

      {/* Course rows */}
      {CANVAS_COURSES.map((c, i) => {
        const rowAppear = genStart + 16 + i * 13;
        const rowAlpha = snapInBack(localFrame - rowAppear, 10, 1.3);
        const notesAlpha = snapInBack(localFrame - (rowAppear + 5), 9, 1.5);
        const quizAlpha = snapInBack(localFrame - (rowAppear + 11), 9, 1.5);
        const top = 24 + i * 21;
        return (
          <div
            key={c.code}
            style={{
              position: "absolute",
              left: "7%",
              right: "7%",
              top: `${top}%`,
              height: "17%",
              borderRadius: 18,
              background: "#fff",
              border: `1.5px solid ${COLORS.greenDeepSoft}`,
              boxShadow: "0 14px 30px -18px rgba(31,56,47,0.4)",
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 18,
              opacity: rowAlpha,
              transform: `translateY(${(1 - rowAlpha) * 16}px)`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 22,
                  color: COLORS.green,
                }}
              >
                {c.code}
              </span>
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: 15,
                  color: COLORS.muted,
                }}
              >
                {c.name}
              </span>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <GenPill label="Notes" alpha={notesAlpha} />
              <GenPill label="Quiz" alpha={quizAlpha} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: vertical ? 28 : 36,
      }}
    >
      <div
        style={{
          position: "relative",
          width: macW,
          height: macH,
          transform: `scale(${scale * (0.92 + 0.08 * laptopAlpha) * canvasPop})`,
          opacity: laptopAlpha,
        }}
      >
        <MacBook
          screenSrc="screens/canvas-with-popup.png"
          width={macW}
          tiltY={tY}
          tiltX={tX}
          screenObjectPosition="left top"
          glare={0.6}
          overlay={genPanel}
        />
      </div>

      {/* Value-prop caption — the whole point of this beat */}
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: vertical ? 30 : 40,
          letterSpacing: -0.8,
          color: COLORS.green,
          textAlign: "center",
          maxWidth: "82%",
          lineHeight: 1.12,
          opacity: snapIn(localFrame - (genStart + 6), 12),
          transform: `translateY(${(1 - snapIn(localFrame - (genStart + 6), 12)) * 14}px)`,
        }}
      >
        Notes <span style={{ color: COLORS.greenMid }}>+</span> quizzes,
        auto-built for every Canvas class.
      </div>
    </div>
  );
};

interface GenPillProps {
  label: string;
  alpha: number;
}

const GenPill: React.FC<GenPillProps> = ({ label, alpha }) => {
  if (alpha <= 0.01) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 999,
        background: COLORS.greenSoft,
        border: `1.5px solid ${COLORS.greenBright}`,
        opacity: Math.min(1, alpha),
        transform: `scale(${0.85 + 0.15 * Math.min(1, alpha)})`,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: COLORS.green,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        ✓
      </span>
      <span
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 17,
          color: COLORS.green,
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ── Feature Converge answer: 5 product features orbit then collapse into the
// Converge "C" composite. Timed off `total` so it fills longer scenes. ────────

interface FeatureIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

interface FeatureIconBaseProps extends FeatureIconProps {
  children: React.ReactNode;
}

const FeatureIconBase: React.FC<FeatureIconBaseProps> = ({
  size = 64,
  color = COLORS.green,
  strokeWidth = 2.2,
  children,
}) => (
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
    {children}
  </svg>
);

const RecordIcon: React.FC<FeatureIconProps> = (props) => (
  <FeatureIconBase {...props}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="8.5" y1="21" x2="15.5" y2="21" />
  </FeatureIconBase>
);

const UploadIcon: React.FC<FeatureIconProps> = (props) => (
  <FeatureIconBase {...props}>
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    <line x1="12" y1="3.5" x2="12" y2="14.5" />
    <path d="M7.5 8 12 3.5 16.5 8" />
  </FeatureIconBase>
);

const NotesIcon: React.FC<FeatureIconProps> = (props) => (
  <FeatureIconBase {...props}>
    <path d="M6 3.5h8L18 7.5v12A1.5 1.5 0 0 1 16.5 21h-10.5A1.5 1.5 0 0 1 4.5 19.5V5A1.5 1.5 0 0 1 6 3.5z" />
    <path d="M14 3.5v4h4" />
    <line x1="7.5" y1="11.5" x2="14.5" y2="11.5" />
    <line x1="7.5" y1="14.5" x2="14.5" y2="14.5" />
    <line x1="7.5" y1="17.5" x2="12" y2="17.5" />
  </FeatureIconBase>
);

const FlashcardsIcon: React.FC<FeatureIconProps> = (props) => (
  <FeatureIconBase {...props}>
    <rect x="4" y="5" width="13" height="9" rx="1.6" />
    <rect x="7" y="10" width="13" height="9" rx="1.6" fill={COLORS.cream} />
    <line x1="10" y1="14" x2="17" y2="14" />
  </FeatureIconBase>
);

const QuizzesIcon: React.FC<FeatureIconProps> = (props) => {
  const dot = props.color ?? COLORS.green;
  return (
    <FeatureIconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.4 9.5a2.6 2.6 0 1 1 4.4 1.9c-.9.8-1.8 1.4-1.8 2.6" />
      <circle cx="12" cy="17" r="1" fill={dot} stroke="none" />
    </FeatureIconBase>
  );
};

const FEATURE_ICONS: Array<{ Icon: React.FC<FeatureIconProps>; label: string }> = [
  { Icon: RecordIcon, label: "Record" },
  { Icon: UploadIcon, label: "Upload" },
  { Icon: NotesIcon, label: "Notes" },
  { Icon: FlashcardsIcon, label: "Flashcards" },
  { Icon: QuizzesIcon, label: "Quizzes" },
];

export const FeatureConvergeAnswer = (
  localFrame: number,
  vertical: boolean,
  total = 75,
): React.ReactNode => {
  const ringAlpha = snapInBack(localFrame, 16, 1.4);
  const spinT = interpolate(localFrame, [total * 0.14, total * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spinAngle = easeOutQuart(spinT) * 3.0 * Math.PI;
  const radiusT = interpolate(localFrame, [total * 0.6, total * 0.82], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityT = interpolate(
    localFrame,
    [total * 0.7, total * 0.88],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const composeAlpha = snapInBack(localFrame - total * 0.74, 14, 1.5);

  const radiusX = (vertical ? 240 : 320) * radiusT;
  const radiusY = (vertical ? 180 : 220) * radiusT;
  const iconSize = vertical ? 110 : 130;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "relative", width: 1, height: 1 }}>
        {FEATURE_ICONS.map((icon, i) => {
          const baseAngle = (i / FEATURE_ICONS.length) * Math.PI * 2;
          const angle = baseAngle + spinAngle;
          const x = Math.cos(angle) * radiusX;
          const y = Math.sin(angle) * radiusY;
          const iconScale =
            ringAlpha * (0.85 + 0.15 * ringAlpha) * (0.85 + 0.15 * radiusT);
          const labelAlpha = Math.max(0, radiusT - 0.15) * opacityT * ringAlpha;
          const IconComp = icon.Icon;
          return (
            <div
              key={icon.label}
              style={{
                position: "absolute",
                left: x,
                top: y,
                marginLeft: -iconSize / 2,
                marginTop: -iconSize / 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                opacity: opacityT * ringAlpha,
                transform: `scale(${iconScale})`,
                transformOrigin: "center center",
              }}
            >
              <div
                style={{
                  width: iconSize,
                  height: iconSize,
                  borderRadius: 26,
                  background: "#fff",
                  border: `1.5px solid ${COLORS.greenDeepSoft}`,
                  boxShadow: "0 22px 44px -16px rgba(31,56,47,0.32)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconComp size={iconSize * 0.58} color={COLORS.green} />
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: vertical ? 17 : 19,
                  color: COLORS.green,
                  letterSpacing: -0.2,
                  whiteSpace: "nowrap",
                  opacity: labelAlpha,
                }}
              >
                {icon.label}
              </div>
            </div>
          );
        })}

        {composeAlpha > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: -120,
              top: -120,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: COLORS.green,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 140,
              letterSpacing: -2,
              opacity: composeAlpha,
              transform: `scale(${0.85 + 0.15 * composeAlpha})`,
              boxShadow: `0 0 ${40 + composeAlpha * 60}px ${COLORS.greenBright}, 0 40px 80px -30px rgba(31,56,47,0.5)`,
              border: `4px solid ${COLORS.greenBright}`,
            }}
          >
            C
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: vertical ? "12%" : "10%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: vertical ? 24 : 28,
          color: COLORS.muted,
          opacity: snapIn(localFrame - 22, 10),
        }}
      >
        One app. Five tools. Zero friction.
      </div>
    </div>
  );
};
