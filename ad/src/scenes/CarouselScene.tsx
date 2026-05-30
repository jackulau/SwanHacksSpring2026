import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT_DISPLAY } from "../theme";
import { punctualAlpha, easeOutQuart } from "../anim";
import { MacBook } from "../components/Device";
import { AnimatedCursor, type CursorWaypoint } from "../components/AnimatedCursor";
import {
  CaptureOverlay,
  NotesOverlay,
  FlashcardsOverlay,
  QuizOverlay,
} from "../components/ScreenOverlays";
import { KineticSwordText } from "../components/KineticSwordText";

interface CarouselSceneProps {
  vertical: boolean;
}

interface CameraMove {
  tiltY: [number, number];
  tiltX: [number, number];
  rollZ: [number, number];
  scale: [number, number];
  yPx: [number, number];
}

interface Beat {
  src: string;
  label: string;
  caption: string;
  /** screen-area coordinates (percent) for the cursor click target */
  clickX: number;
  clickY: number;
  /** entry corner for the cursor (percent) */
  enterFrom: { x: number; y: number };
  /** distinct cinematic camera per beat */
  camera: CameraMove;
  /** overlay component to render inside the screen after click */
  Overlay: React.FC<{ local: number; clickAt: number }>;
}

/**
 * 7.2–19.2s (12s · 360 frames). Four hero beats × 3 s.
 *
 * Each beat has:
 *  - A distinct cinematic camera move (push-in, swoop-up, orbit, etc.)
 *  - An animated cursor that crosses the screen and clicks the primary CTA
 *  - A screen-state overlay that reacts to the click (record pill + captions,
 *    "generating → ready", flashcard flip, quiz highlight)
 *
 * Beat shape: 0–10 snap-in · 10–82 hold/camera/cursor · 82–90 snap-out.
 */
export const CarouselScene: React.FC<CarouselSceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();

  const beats: Beat[] = [
    {
      src: "screens/capture-light.png",
      label: "Capture",
      caption: "Record lectures with live captions.",
      clickX: 58.7,
      clickY: 42.2,
      enterFrom: { x: 110, y: 95 },
      // "Reveal" — swoops in from above to a low upward-angle hero shot
      camera: {
        tiltY: [-14, -4],
        tiltX: [-2, 14],
        rollZ: [-1.5, 0],
        scale: [0.94, 1.08],
        yPx: [30, -10],
      },
      Overlay: CaptureOverlay,
    },
    {
      src: "screens/lecture-bio-light.png",
      label: "Notes",
      caption: "Searchable, time-coded transcripts.",
      clickX: 91.4,
      clickY: 12,
      enterFrom: { x: -10, y: 95 },
      // "Orbit push-in" — laterally pans + zooms in
      camera: {
        tiltY: [16, -6],
        tiltX: [6, 1],
        rollZ: [0, 1.2],
        scale: [0.96, 1.12],
        yPx: [10, -16],
      },
      Overlay: NotesOverlay,
    },
    {
      src: "screens/lecture-flashcards-light.png",
      label: "Flashcards",
      caption: "Spaced-repetition, per lecture.",
      clickX: 38.9,
      clickY: 47.3,
      enterFrom: { x: 110, y: -10 },
      // "Swoop up" — fast dive from above to upward angle
      camera: {
        tiltY: [-18, -2],
        tiltX: [-12, 18],
        rollZ: [2, -0.5],
        scale: [0.92, 1.10],
        yPx: [-20, -8],
      },
      Overlay: FlashcardsOverlay,
    },
    {
      src: "screens/lecture-quiz-light.png",
      label: "Quiz",
      caption: "Test recall, automatically.",
      clickX: 38.9,
      clickY: 42,
      enterFrom: { x: -10, y: 95 },
      // "Whip orbit" — swings across left→right with push-in
      camera: {
        tiltY: [14, -14],
        tiltX: [8, 3],
        rollZ: [-1, 1],
        scale: [0.90, 1.08],
        yPx: [0, -14],
      },
      Overlay: QuizOverlay,
    },
  ];

  const BEAT_FRAMES = 90; // 3s per hero shot
  const SNAP_IN = 10;
  const SNAP_OUT = 10;
  // Cursor click lands at f=34 in each beat (~1.13s in) — gives it room to move
  const CLICK_AT = 34;

  const macW = vertical ? 880 : 1280;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {beats.map((beat, i) => {
        const start = i * BEAT_FRAMES;
        const local = frame - start;

        const alpha = punctualAlpha(
          local,
          BEAT_FRAMES - SNAP_IN - SNAP_OUT,
          SNAP_IN,
          SNAP_OUT,
        );
        if (alpha < 0.01) return null;

        // Non-linear easing on the camera so the motion punches early then settles.
        const tCam = easeOutQuart(Math.max(0, Math.min(1, local / BEAT_FRAMES)));
        const cam = beat.camera;
        const tiltY = cam.tiltY[0] + (cam.tiltY[1] - cam.tiltY[0]) * tCam;
        const tiltX = cam.tiltX[0] + (cam.tiltX[1] - cam.tiltX[0]) * tCam;
        const rollZ = cam.rollZ[0] + (cam.rollZ[1] - cam.rollZ[0]) * tCam;
        const stageScale = cam.scale[0] + (cam.scale[1] - cam.scale[0]) * tCam;
        const yOffset = cam.yPx[0] + (cam.yPx[1] - cam.yPx[0]) * tCam;

        // Tiny micro-shake on click impact (~3 frames)
        const sinceClick = local - CLICK_AT;
        const shake =
          sinceClick >= 0 && sinceClick < 4
            ? Math.sin(sinceClick * 8) * 4 * (1 - sinceClick / 4)
            : 0;

        // Cursor waypoints: start off-screen, travel to the CTA by CLICK_AT,
        // click, then drift slightly off and fade out.
        const cursorWaypoints: CursorWaypoint[] = [
          {
            atFrame: 12,
            x: beat.enterFrom.x,
            y: beat.enterFrom.y,
          },
          {
            // approach point (about 60% of the way) for a curved feel
            atFrame: 24,
            x: beat.clickX + (beat.enterFrom.x - beat.clickX) * 0.25,
            y: beat.clickY + (beat.enterFrom.y - beat.clickY) * 0.25,
            ease: "smooth",
          },
          {
            atFrame: CLICK_AT,
            x: beat.clickX,
            y: beat.clickY,
            click: true,
            ease: "snap",
          },
          {
            atFrame: CLICK_AT + 26,
            x: beat.clickX + (beat.enterFrom.x > 50 ? -8 : 8),
            y: beat.clickY + 4,
            ease: "smooth",
          },
        ];

        const Overlay = beat.Overlay;
        const overlayNode = (
          <>
            <Overlay local={local} clickAt={CLICK_AT} />
            <AnimatedCursor
              localFrame={local}
              waypoints={cursorWaypoints}
              enterAt={6}
              exitAt={CLICK_AT + 30}
              scale={1.2}
            />
          </>
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: alpha,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: vertical ? "8%" : "5%",
            }}
          >
            {/* Device — wrapped in stage transform for entry + dolly + shake */}
            <div
              style={{
                transform: `translateY(${yOffset + shake}px) scale(${stageScale})`,
                transition: "none",
              }}
            >
              <MacBook
                screenSrc={beat.src}
                width={macW}
                tiltY={tiltY}
                tiltX={tiltX}
                rollZ={rollZ}
                glare={0.7}
                overlay={overlayNode}
              />
            </div>
          </div>
        );
      })}

      {/* Kinetic sword-swipe feature labels — runs across the entire 12s
          carousel, alternating sword direction. Swipes sync to the sword SFX
          at scene-time 10.2 / 13.2 / 16.2 / 19.2 s in the audio. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: vertical ? "12%" : "8%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: vertical ? "88%" : "70%",
            maxWidth: 1100,
          }}
        >
          <KineticSwordText
            words={["Capture", "Notes", "Flashcards", "Quiz"]}
            localFrame={frame}
            startFrame={0}
            framesPerWord={90}
            swipeDurationFrames={12}
            fontSize={vertical ? 88 : 128}
            color={COLORS.green}
            bladeColor={COLORS.greenBright}
            fontFamily={FONT_DISPLAY}
          />
        </div>
      </div>
    </div>
  );
};
