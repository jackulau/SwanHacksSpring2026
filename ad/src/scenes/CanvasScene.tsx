import React from "react";
import {
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  staticFile,
  Img,
} from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import { snapIn, snapInBack, easeOutQuart } from "../anim";
import { MacBook } from "../components/Device";
import { AnimatedCursor } from "../components/AnimatedCursor";

interface CanvasSceneProps {
  vertical: boolean;
}

/**
 * 19.2–22.8s (1.5 bars · 108 frames). Canvas integration showcase.
 *
 *   0–10:   Canvas LMS MacBook snaps in
 *   10–40:  Extension popup snaps in, cursor crosses to the Sync button
 *   40–48:  Click pulse + micro-shake
 *   48–64:  Whip-zoom into Converge dashboard MacBook (push-in past the laptop)
 *   64–108: Dashboard hero + headline
 */
export const CanvasScene: React.FC<CanvasSceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = vertical ? height / 2 + 20 : height / 2 + 30;

  const macW = vertical ? 880 : 1200;

  // Phase 1: Canvas laptop
  const canvasAlpha = snapIn(frame - 0, 10);
  const canvasExitProg = interpolate(frame, [50, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const canvasOpacity = canvasAlpha * (1 - canvasExitProg);

  // Whip-zoom push-in on the Canvas laptop as we transition (scale past the camera)
  const canvasScalePushIn = interpolate(frame, [42, 64], [1.0, 1.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const canvasBaseScale = 0.94 + 0.06 * canvasAlpha;
  const canvasScale = canvasBaseScale * canvasScalePushIn;

  // Phase 2: Extension popup
  const popupAlpha = snapInBack(frame - 16, 12, 1.3);
  const popupExitProg = interpolate(frame, [48, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const popupOpacity = popupAlpha * (1 - popupExitProg);

  // Phase 3: Converge dashboard laptop — "drops in" from above with overshoot
  const dashAlphaRaw = snapIn(frame - 56, 12);
  const dashAlpha = dashAlphaRaw;
  const dashEntry = interpolate(frame, [56, 68, 96], [0.78, 1.04, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashY = interpolate(frame, [56, 70], [-60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline
  const headlineAlpha = snapIn(frame - 68, 10);
  const headlineY = (1 - headlineAlpha) * 14;

  // Canvas camera: dramatic orbit + tilt into upward angle as we approach click
  const tCam = easeOutQuart(Math.max(0, Math.min(1, frame / 64)));
  const canvasTiltY = -14 + 8 * tCam;
  const canvasTiltX = -2 + 10 * tCam;
  const canvasRollZ = -1.5 + 1 * tCam;

  // Dashboard camera: settles to a level hero
  const dashTiltY = interpolate(frame, [56, 108], [-12, -4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashTiltX = interpolate(frame, [56, 108], [12, 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Micro-shake at click impact (f=44)
  const sinceClick = frame - 44;
  const shake =
    sinceClick >= 0 && sinceClick < 5
      ? Math.sin(sinceClick * 8) * 5 * (1 - sinceClick / 5)
      : 0;

  const popupW = vertical ? 280 : 360;
  const popupH = vertical ? 320 : 420;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Canvas LMS laptop */}
      {canvasOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy + shake,
            transform: `translate(-50%, -50%) scale(${canvasScale})`,
            opacity: canvasOpacity,
          }}
        >
          <MacBook
            screenSrc="screens/canvas-with-popup.png"
            width={macW}
            tiltY={canvasTiltY}
            tiltX={canvasTiltX}
            rollZ={canvasRollZ}
            screenObjectPosition="left top"
            glare={0.6}
          />
        </div>
      )}

      {/* Extension popup floats next to the laptop, with cursor + click */}
      {popupOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            right: vertical ? "8%" : "10%",
            top: vertical ? "20%" : "18%",
            width: popupW,
            height: popupH,
            transform: `scale(${0.9 + 0.1 * popupAlpha}) translateY(${shake * 0.6}px)`,
            transformOrigin: "top right",
            opacity: popupOpacity,
            borderRadius: 22,
            overflow: "hidden",
            background: "#fff",
            boxShadow:
              "0 50px 100px -30px rgba(31,56,47,0.45), 0 18px 38px -12px rgba(31,56,47,0.25)",
            border: "1px solid rgba(10,13,12,0.06)",
          }}
        >
          <Img
            src={staticFile("screens/extension-popup-syncing.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Cursor + click on the Sync button */}
          <AnimatedCursor
            localFrame={frame}
            waypoints={[
              { atFrame: 18, x: 110, y: 110 },
              { atFrame: 32, x: 70, y: 80, ease: "smooth" },
              { atFrame: 44, x: 50, y: 78, click: true, ease: "snap" },
              { atFrame: 60, x: 35, y: 105, ease: "smooth" },
            ]}
            enterAt={14}
            exitAt={56}
            scale={1.0}
          />
          {/* Synced toast appearing right after click */}
          {frame >= 48 && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: "10%",
                transform: `translate(-50%, 0) scale(${snapInBack(frame - 48, 10, 1.5)})`,
                padding: "6px 12px",
                borderRadius: 999,
                background: COLORS.green,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 13,
                opacity: snapInBack(frame - 48, 10, 1.5),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: COLORS.greenBright }}>✓</span>
              Synced
            </div>
          )}
        </div>
      )}

      {/* Converge dashboard laptop */}
      {dashAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy + dashY + shake,
            transform: `translate(-50%, -50%) scale(${dashEntry})`,
            opacity: dashAlpha,
          }}
        >
          <MacBook
            screenSrc="screens/converge-dashboard-synced.png"
            width={macW}
            tiltY={dashTiltY}
            tiltX={dashTiltX}
            rollZ={0}
            screenObjectPosition="top left"
            glare={0.75}
          />
        </div>
      )}

      {/* Headline */}
      {headlineAlpha > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: vertical ? 80 : 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            opacity: headlineAlpha,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: vertical ? 60 : 72,
              letterSpacing: -2.5,
              color: COLORS.green,
              textAlign: "center",
              lineHeight: 1.05,
            }}
          >
            Your whole semester.{" "}
            <span style={{ color: COLORS.greenMid }}>Synced.</span>
          </div>
          <div
            style={{
              marginTop: 4,
              padding: "8px 18px",
              borderRadius: 999,
              background: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: vertical ? 22 : 24,
              color: COLORS.green,
              boxShadow: "0 10px 24px -10px rgba(31,56,47,0.3)",
              border: `1px solid ${COLORS.greenDeepSoft}`,
              letterSpacing: -0.3,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: COLORS.greenBright,
              }}
            />
            Canvas integration · auto-sync
          </div>
        </div>
      )}
    </div>
  );
};
