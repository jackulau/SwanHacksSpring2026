import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

/**
 * Soft animated mesh gradient (cream → green) with subtle film grain.
 * Always full-bleed; sits at z=0 in every scene.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  const blob1X = interpolate(t, [0, 0.5, 1], [20, 60, 30]);
  const blob1Y = interpolate(t, [0, 0.5, 1], [25, 55, 40]);
  const blob2X = interpolate(t, [0, 0.5, 1], [75, 40, 80]);
  const blob2Y = interpolate(t, [0, 0.5, 1], [70, 35, 60]);
  const blob3X = interpolate(t, [0, 1], [50, 55]);
  const blob3Y = interpolate(t, [0, 1], [50, 45]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.cream,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(70% 55% at ${blob1X}% ${blob1Y}%, ${COLORS.greenDeepSoft} 0%, rgba(207,233,214,0) 70%),
            radial-gradient(60% 50% at ${blob2X}% ${blob2Y}%, ${COLORS.greenSoft} 0%, rgba(232,240,235,0) 70%),
            radial-gradient(40% 35% at ${blob3X}% ${blob3Y}%, rgba(123,216,143,0.14) 0%, rgba(123,216,143,0) 70%)
          `,
          filter: "blur(28px) saturate(95%)",
        }}
      />
      <Grain width={width} height={height} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 50% 60%, rgba(0,0,0,0) 55%, rgba(47,93,79,0.08) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

const Grain: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/>
        <feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)'/>
    </svg>
  `;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url("${url}")`,
        backgroundSize: "cover",
        mixBlendMode: "multiply",
        opacity: 0.65,
      }}
    />
  );
};
