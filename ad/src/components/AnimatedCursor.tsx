import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "../theme";
import { easeOutCubic, easeInQuart } from "../anim";

export interface CursorWaypoint {
  /** local frame at which the cursor SHOULD BE at (x, y) */
  atFrame: number;
  /** position in percent of the screen area (0–100) */
  x: number;
  y: number;
  /** if true, emit a click pulse at this point (lasts ~14 frames) */
  click?: boolean;
  /** ease type into this waypoint (default smooth) */
  ease?: "smooth" | "snap";
}

interface AnimatedCursorProps {
  localFrame: number;
  /** when to enter (default: 4 frames before first waypoint, fading in) */
  enterAt?: number;
  /** when to exit (default: 4 frames after last waypoint, fading out) */
  exitAt?: number;
  /** sized as % of the screen area; cursor is drawn ~22px tall at 1.0 */
  scale?: number;
  waypoints: CursorWaypoint[];
}

interface ResolvedPos {
  x: number;
  y: number;
}

function lerpWaypoints(localFrame: number, wps: CursorWaypoint[]): ResolvedPos {
  if (wps.length === 0) return { x: 50, y: 50 };
  if (localFrame <= wps[0].atFrame) return { x: wps[0].x, y: wps[0].y };
  const last = wps[wps.length - 1];
  if (localFrame >= last.atFrame) return { x: last.x, y: last.y };
  for (let i = 0; i < wps.length - 1; i += 1) {
    const a = wps[i];
    const b = wps[i + 1];
    if (localFrame >= a.atFrame && localFrame < b.atFrame) {
      const span = Math.max(1, b.atFrame - a.atFrame);
      const t = (localFrame - a.atFrame) / span;
      const eased = b.ease === "snap" ? 1 - Math.pow(1 - t, 5) : easeOutCubic(t);
      return {
        x: a.x + (b.x - a.x) * eased,
        y: a.y + (b.y - a.y) * eased,
      };
    }
  }
  return { x: last.x, y: last.y };
}

/**
 * macOS-style pointer that follows waypoints across the screen area, with a
 * soft trail glow + click ripple. Coordinates are in screen-area percent so
 * the cursor lands on the same button regardless of MacBook size.
 */
export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  localFrame,
  enterAt,
  exitAt,
  scale = 1,
  waypoints,
}) => {
  if (waypoints.length === 0) return null;
  const firstFrame = waypoints[0].atFrame;
  const lastFrame = waypoints[waypoints.length - 1].atFrame;
  const enter = enterAt ?? firstFrame - 6;
  const exit = exitAt ?? lastFrame + 12;

  const enterAlpha = interpolate(localFrame, [enter, enter + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitAlpha = interpolate(localFrame, [exit, exit + 8], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = enterAlpha * exitAlpha;
  if (alpha < 0.01) return null;

  const pos = lerpWaypoints(localFrame, waypoints);

  // Soft entry rise + tiny press-down at click frames
  const clickedNear = waypoints.find(
    (w) => w.click && Math.abs(localFrame - w.atFrame) <= 3,
  );
  const pressScale = clickedNear ? 0.86 : 1.0;

  const cursorSize = 28 * scale;

  return (
    <>
      {/* Click pulses */}
      {waypoints
        .filter((w) => w.click)
        .map((w) => {
          const dt = localFrame - w.atFrame;
          if (dt < -2 || dt > 22) return null;
          const progress = Math.max(0, Math.min(1, (dt + 2) / 22));
          const ringScale = 0.4 + progress * 2.4;
          const ringOpacity = (1 - progress) * 0.85;
          // Inner flash burst
          const flashProgress = Math.max(0, Math.min(1, (dt + 2) / 8));
          const flashOpacity = (1 - flashProgress) * 0.7;
          return (
            <div key={`pulse-${w.atFrame}-${w.x}`}>
              <div
                style={{
                  position: "absolute",
                  left: `${w.x}%`,
                  top: `${w.y}%`,
                  width: 80,
                  height: 80,
                  marginLeft: -40,
                  marginTop: -40,
                  borderRadius: "50%",
                  border: `3px solid ${COLORS.greenBright}`,
                  transform: `scale(${ringScale})`,
                  opacity: ringOpacity * alpha,
                  boxShadow: `0 0 24px ${COLORS.greenBright}`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${w.x}%`,
                  top: `${w.y}%`,
                  width: 36,
                  height: 36,
                  marginLeft: -18,
                  marginTop: -18,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.95)",
                  transform: `scale(${0.4 + flashProgress * 1.6})`,
                  opacity: flashOpacity * alpha,
                  filter: "blur(3px)",
                }}
              />
            </div>
          );
        })}

      {/* Cursor + trail */}
      <div
        style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: cursorSize,
          height: cursorSize,
          marginLeft: -cursorSize * 0.18,
          marginTop: -cursorSize * 0.06,
          opacity: alpha,
          transform: `scale(${pressScale})`,
          transformOrigin: "12% 12%",
        }}
      >
        {/* Soft glow behind cursor */}
        <div
          style={{
            position: "absolute",
            left: cursorSize * 0.05,
            top: cursorSize * 0.05,
            width: cursorSize * 0.8,
            height: cursorSize * 0.8,
            borderRadius: "50%",
            background: COLORS.greenBright,
            opacity: 0.35,
            filter: "blur(8px)",
          }}
        />
        <svg
          viewBox="0 0 24 28"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {/* Outer white outline for visibility on dark backgrounds */}
          <path
            d="M3 2 L3 24 L9 19 L13 27 L17 25 L13 17 L21 17 Z"
            fill="#fff"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Ink-filled cursor body */}
          <path
            d="M3 2 L3 24 L9 19 L13 27 L17 25 L13 17 L21 17 Z"
            fill="#0a0d0c"
          />
        </svg>
      </div>
    </>
  );
};
