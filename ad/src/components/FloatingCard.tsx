import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

interface FloatingCardProps {
  depth?: number;
  tiltY?: number;
  tiltX?: number;
  enterFrom?: "left" | "right" | "bottom" | "top" | "scale";
  enterAt?: number;
  exitAt?: number | null;
  rounded?: number;
  width?: number | string;
  height?: number | string;
  shadow?: string;
  children: React.ReactNode;
  centerFocus?: boolean;
  parallaxX?: number;
  style?: React.CSSProperties;
}

/**
 * Floating UI card with parallax + spring entry. Wrap any UI screen in one
 * of these to get the Zelios floating-screen look.
 */
export const FloatingCard: React.FC<FloatingCardProps> = ({
  depth = 1,
  tiltY = -6,
  tiltX = 4,
  enterFrom = "scale",
  enterAt = 0,
  exitAt = null,
  rounded = 28,
  width = 720,
  height = 460,
  shadow = "0 60px 120px -40px rgba(31, 56, 47, 0.45), 0 24px 50px -20px rgba(31, 56, 47, 0.25)",
  children,
  centerFocus = false,
  parallaxX,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const f = frame - enterAt;

  const enter = spring({
    frame: f,
    fps,
    config: { damping: 18, stiffness: 110, mass: 1 },
  });

  const exit = exitAt !== null
    ? spring({
        frame: frame - exitAt,
        fps,
        config: { damping: 18, stiffness: 120, mass: 1 },
      })
    : 0;

  const enterX =
    enterFrom === "left"
      ? -260
      : enterFrom === "right"
        ? 260
        : 0;
  const enterY =
    enterFrom === "bottom"
      ? 220
      : enterFrom === "top"
        ? -220
        : enterFrom === "scale"
          ? 80
          : 0;
  const startScale = enterFrom === "scale" ? 0.86 : 0.94;

  const t = frame / durationInFrames;
  const parallax = parallaxX ?? (1 - depth) * 80;
  const driftX = parallax + Math.sin(t * Math.PI * 2 * 0.6) * 6 * depth;
  const driftY = Math.cos(t * Math.PI * 2 * 0.5) * 8 * depth;

  const focusScale = centerFocus
    ? interpolate(enter, [0, 1], [startScale, 1.06])
    : interpolate(enter, [0, 1], [startScale, 1]);

  const x = enterX * (1 - enter) + driftX - exit * 280;
  const y = enterY * (1 - enter) + driftY - exit * 40;
  const tiltScale = interpolate(enter, [0, 1], [0.6, 1]);
  const tY = tiltY * tiltScale;
  const tX = tiltX * tiltScale;

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: rounded,
        background: "#ffffff",
        boxShadow: shadow,
        overflow: "hidden",
        transformStyle: "preserve-3d",
        transform: `perspective(1600px) translate3d(${x}px, ${y}px, 0) rotateY(${tY}deg) rotateX(${tX}deg) scale(${focusScale})`,
        opacity: Math.max(0, enter - exit),
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
