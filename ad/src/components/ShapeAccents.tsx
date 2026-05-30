import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  random,
} from "remotion";
import { COLORS } from "../theme";

/**
 * Floating dots/rings/arcs in #7bd88f that drift in the background
 * to add depth and lead the eye on beats.
 */
export const FloatingAccents: React.FC<{ count?: number; seed?: string }> = ({
  count = 16,
  seed = "accents",
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  const items = Array.from({ length: count }, (_, i) => {
    const baseX = random(`${seed}-x-${i}`) * width;
    const baseY = random(`${seed}-y-${i}`) * height;
    const driftAmp = 30 + random(`${seed}-d-${i}`) * 60;
    const phase = random(`${seed}-p-${i}`) * Math.PI * 2;
    const x = baseX + Math.sin(t * Math.PI * 2 + phase) * driftAmp;
    const y = baseY + Math.cos(t * Math.PI * 2 * 0.7 + phase) * driftAmp * 0.6;
    const r = 6 + random(`${seed}-r-${i}`) * 18;
    const kind = random(`${seed}-k-${i}`);
    const opacity = 0.18 + random(`${seed}-o-${i}`) * 0.25;
    const color =
      kind > 0.7 ? COLORS.greenBright : kind > 0.3 ? COLORS.greenDeepSoft : COLORS.greenMid;
    return { x, y, r, kind, opacity, color, i };
  });

  return (
    <div
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {items.map((it) => (
        <div
          key={it.i}
          style={{
            position: "absolute",
            left: it.x,
            top: it.y,
            width: it.r,
            height: it.r,
            borderRadius: "50%",
            background: it.kind > 0.55 ? "transparent" : it.color,
            border: it.kind > 0.55 ? `${Math.max(2, it.r * 0.15)}px solid ${it.color}` : "none",
            opacity: it.opacity,
            transform: "translate(-50%, -50%)",
            filter: "blur(0.4px)",
          }}
        />
      ))}
    </div>
  );
};

interface ShapeBurstProps {
  triggerFrame: number;
  x?: number | string;
  y?: number | string;
  count?: number;
  spread?: number;
  color?: string;
  seed?: string;
}

/**
 * One-shot radial burst of dots/rings — drop on beats for impact.
 */
export const ShapeBurst: React.FC<ShapeBurstProps> = ({
  triggerFrame,
  x = "50%",
  y = "50%",
  count = 20,
  spread = 320,
  color = COLORS.greenBright,
  seed = "burst",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - triggerFrame;

  const items = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random(`${seed}-a-${i}`) * 0.5;
    const distance = spread * (0.4 + random(`${seed}-d-${i}`) * 0.6);
    const launch = interpolate(f, [0, 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const eased = 1 - Math.pow(1 - launch, 3);
    const px = Math.cos(angle) * distance * eased;
    const py = Math.sin(angle) * distance * eased;
    const fade = interpolate(f, [0, 8, 30], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const r = 6 + random(`${seed}-r-${i}`) * 10;
    return { px, py, fade, r, i };
  });

  if (f < 0 || f > 30) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
      }}
    >
      {items.map((it) => (
        <div
          key={it.i}
          style={{
            position: "absolute",
            left: it.px - it.r / 2,
            top: it.py - it.r / 2,
            width: it.r,
            height: it.r,
            borderRadius: "50%",
            background: color,
            opacity: it.fade,
          }}
        />
      ))}
    </div>
  );
};

interface RingRippleProps {
  triggerFrame: number;
  x?: number | string;
  y?: number | string;
  maxR?: number;
  duration?: number;
  color?: string;
  count?: number;
}

export const RingRipple: React.FC<RingRippleProps> = ({
  triggerFrame,
  x = "50%",
  y = "50%",
  maxR = 600,
  duration = 60,
  color = COLORS.greenBright,
  count = 3,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const offset = i * 18;
        const f = frame - triggerFrame - offset;
        if (f < 0 || f > duration) return null;
        const t = f / duration;
        const r = t * maxR;
        const opacity = (1 - t) * 0.55;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -r,
              top: -r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `${Math.max(2, 6 - i * 2)}px solid ${color}`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};
