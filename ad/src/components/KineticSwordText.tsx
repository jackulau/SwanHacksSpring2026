import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT_DISPLAY } from "../theme";
import { easeOutQuart, snapIn } from "../anim";

export interface KineticSwordTextProps {
  words: string[];
  localFrame: number;
  startFrame?: number;
  framesPerWord?: number;
  swipeDurationFrames?: number;
  fontSize?: number;
  color?: string;
  bladeColor?: string;
  fontFamily?: string;
  renderWord?: (word: string, index: number) => React.ReactNode;
}

export const KineticSwordText: React.FC<KineticSwordTextProps> = ({
  words,
  localFrame,
  startFrame = 0,
  framesPerWord = 36,
  swipeDurationFrames = 12,
  fontSize = 120,
  color = COLORS.green,
  bladeColor = "#ffffff",
  fontFamily = FONT_DISPLAY,
  renderWord,
}) => {
  if (localFrame < startFrame || words.length === 0) {
    return null;
  }

  const elapsed = localFrame - startFrame;
  const currentIdx = Math.min(
    Math.floor(elapsed / framesPerWord),
    words.length - 1
  );
  const inWord = elapsed - currentIdx * framesPerWord;
  const dir: "ltr" | "rtl" = currentIdx % 2 === 0 ? "ltr" : "rtl";

  const isLast = currentIdx === words.length - 1;
  const swipeStart = framesPerWord - swipeDurationFrames;
  const inSwipe = !isLast && inWord >= swipeStart;

  // Snap-in phase (0..6)
  const snapT = snapIn(inWord, 6);
  const opacity = interpolate(snapT, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const yRise = interpolate(snapT, [0, 1], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(snapT, [0, 1], [0.92, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Swipe progress
  const swipeLocal = inSwipe ? inWord - swipeStart : 0;
  const rawProgress = inSwipe
    ? Math.min(Math.max(swipeLocal / swipeDurationFrames, 0), 1)
    : 0;
  const progress = inSwipe ? easeOutQuart(rawProgress) : 0;

  const containerHeight = fontSize * 1.3;

  const containerStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    overflow: "hidden",
    width: "100%",
    height: containerHeight,
  };

  const wordBaseStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    fontFamily,
    fontSize,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color,
    lineHeight: 1,
  };

  const renderWordContent = (word: string, index: number): React.ReactNode => {
    if (renderWord) {
      return renderWord(word, index);
    }
    return word;
  };

  // Current word clip + transform
  const currentClip: string | undefined = inSwipe
    ? dir === "ltr"
      ? `inset(0 0 0 ${progress * 100}%)`
      : `inset(0 ${progress * 100}% 0 0)`
    : undefined;

  const currentTransform = `translateY(${yRise}px) scale(${scale})`;

  // Next word
  const nextWord = !isLast ? words[currentIdx + 1] : null;
  const nextClip: string | undefined =
    inSwipe && nextWord !== null
      ? dir === "ltr"
        ? `inset(0 ${100 - progress * 100}% 0 0)`
        : `inset(0 0 0 ${100 - progress * 100}%)`
      : undefined;

  // Blade position percentage along container width
  const bladePct = inSwipe
    ? dir === "ltr"
      ? interpolate(progress, [0, 1], [-12, 112])
      : interpolate(progress, [0, 1], [112, -12])
    : 0;

  const bladeStyle: React.CSSProperties = {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: `${bladePct}%`,
    width: 5,
    background: "#ffffff",
    transform: "rotateZ(-12deg)",
    transformOrigin: "center",
    boxShadow: `0 0 24px #fff, 0 0 48px ${bladeColor}`,
    pointerEvents: "none",
  };

  // Trailing motion blur — behind the blade in the swipe direction.
  const trailGradient =
    dir === "ltr"
      ? "linear-gradient(to left, rgba(255,255,255,0.5), rgba(255,255,255,0))"
      : "linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0))";

  const trailLeft = dir === "ltr" ? `calc(${bladePct}% - 90px)` : `${bladePct}%`;

  const trailStyle: React.CSSProperties = {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: trailLeft,
    width: 90,
    background: trailGradient,
    transform: "rotateZ(-12deg)",
    transformOrigin: "center",
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle}>
      {/* Current word */}
      <div
        style={{
          ...wordBaseStyle,
          opacity,
          transform: currentTransform,
          clipPath: currentClip,
          WebkitClipPath: currentClip,
        }}
      >
        {renderWordContent(words[currentIdx], currentIdx)}
      </div>

      {/* Next word during swipe */}
      {inSwipe && nextWord !== null ? (
        <div
          style={{
            ...wordBaseStyle,
            opacity: 1,
            clipPath: nextClip,
            WebkitClipPath: nextClip,
          }}
        >
          {renderWordContent(nextWord, currentIdx + 1)}
        </div>
      ) : null}

      {/* Sword swipe visuals */}
      {inSwipe ? (
        <>
          <div style={trailStyle} />
          <div style={bladeStyle} />
        </>
      ) : null}
    </div>
  );
};
