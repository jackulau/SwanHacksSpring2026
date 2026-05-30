import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { FONT_DISPLAY, FONT_BODY, COLORS } from "../theme";

interface KineticTextProps {
  children: React.ReactNode;
  startFrame?: number;
  size?: number;
  weight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  color?: string;
  font?: "display" | "body";
  align?: "left" | "center" | "right";
  /** Stagger per character, in frames */
  stagger?: number;
  style?: React.CSSProperties;
}

/**
 * Kinetic typography — each character springs up with a stagger.
 * Use for big bold headlines on a beat hit.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  children,
  startFrame = 0,
  size = 96,
  weight = 800,
  letterSpacing = -1.5,
  lineHeight = 1.05,
  color = COLORS.ink,
  font = "display",
  align = "center",
  stagger = 1.4,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = typeof children === "string" ? children : String(children);

  return (
    <div
      style={{
        fontFamily: font === "display" ? FONT_DISPLAY : FONT_BODY,
        fontWeight: weight,
        fontSize: size,
        letterSpacing,
        lineHeight,
        color,
        textAlign: align,
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        ...style,
      }}
    >
      {text.split(" ").map((word, wi) => (
        <span
          key={`w-${wi}`}
          style={{ display: "inline-flex", marginRight: size * 0.22 }}
        >
          {word.split("").map((ch, ci) => {
            const charIndex = wi * 8 + ci;
            const localF = frame - startFrame - charIndex * stagger;
            const enter = spring({
              frame: localF,
              fps,
              config: { damping: 14, stiffness: 200, mass: 0.6 },
            });
            const y = interpolate(enter, [0, 1], [size * 0.6, 0]);
            const opacity = interpolate(enter, [0, 1], [0, 1]);
            return (
              <span
                key={`c-${ci}`}
                style={{
                  display: "inline-block",
                  transform: `translateY(${y}px)`,
                  opacity,
                  willChange: "transform, opacity",
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};

interface SubtitleProps {
  children: React.ReactNode;
  startFrame?: number;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;
}

export const Subtitle: React.FC<SubtitleProps> = ({
  children,
  startFrame = 0,
  size = 32,
  color = COLORS.muted,
  align = "center",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 1 },
  });
  const y = interpolate(enter, [0, 1], [20, 0]);
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 400,
        fontSize: size,
        color,
        textAlign: align,
        opacity: enter,
        transform: `translateY(${y}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
