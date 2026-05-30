import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

interface ConvergeLogoProps {
  size?: number;
  /** local frame within scene where the build animation starts */
  buildStart?: number;
  /** if true, skips the build-in and just shows the static logo */
  static?: boolean;
  color?: string;
}

/**
 * Converge logo — three curved arcs around three inward arrows.
 * Animates: arcs draw with stagger → arrows pop with spring → ring ripple.
 */
export const ConvergeLogo: React.FC<ConvergeLogoProps> = ({
  size = 140,
  buildStart = 0,
  static: isStatic = false,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - buildStart;

  const arcStrokeColor = color ?? COLORS.green;
  const arrowColor = color ?? COLORS.green;
  const accent = COLORS.greenBright;

  const arc1Draw = isStatic
    ? 1
    : interpolate(f, [0, 14], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const arc2Draw = isStatic
    ? 1
    : interpolate(f, [6, 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const arc3Draw = isStatic
    ? 1
    : interpolate(f, [12, 26], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const arrowsScale = isStatic
    ? 1
    : spring({
        frame: Math.max(0, f - 20),
        fps,
        config: { damping: 9, stiffness: 180, mass: 0.6 },
      });

  const arrowsOpacity = isStatic
    ? 1
    : interpolate(f, [20, 30], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const rippleProgress = isStatic
    ? 0
    : interpolate(f, [30, 70], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const rippleR = 20 + rippleProgress * 40;
  const rippleOpacity = (1 - rippleProgress) * 0.5;

  const ARC_LEN = 70;
  const arcStyle = (draw: number) => ({
    strokeDasharray: ARC_LEN,
    strokeDashoffset: ARC_LEN * (1 - draw),
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      style={{ overflow: "visible" }}
    >
      <circle
        cx={32}
        cy={32}
        r={rippleR}
        stroke={accent}
        strokeWidth={2}
        opacity={rippleOpacity}
        fill="none"
      />

      <g
        stroke={arcStrokeColor}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M 34 7 A 25 25 0 0 1 56 38" style={arcStyle(arc1Draw)} />
        <g transform="rotate(120 32 32)">
          <path d="M 34 7 A 25 25 0 0 1 56 38" style={arcStyle(arc2Draw)} />
        </g>
        <g transform="rotate(240 32 32)">
          <path d="M 34 7 A 25 25 0 0 1 56 38" style={arcStyle(arc3Draw)} />
        </g>
      </g>

      <g
        stroke={arrowColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          transform: `scale(${arrowsScale})`,
          transformOrigin: "32px 32px",
          opacity: arrowsOpacity,
        }}
      >
        <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        <g transform="rotate(120 32 32)">
          <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        </g>
        <g transform="rotate(240 32 32)">
          <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        </g>
      </g>
    </svg>
  );
};
