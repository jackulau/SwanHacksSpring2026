import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
  Img,
} from "remotion";
import { COLORS, FONT_DISPLAY } from "../theme";

interface TickerSceneProps {
  vertical: boolean;
}

const WORDS = [
  "Capture",
  "Notes",
  "Flashcards",
  "Quizzes",
  "Accessible",
  "Canvas sync",
];

const THUMBS = [
  "screens/capture-light.png",
  "screens/lecture-bio-light.png",
  "screens/study-flashcards-light.png",
  "screens/lecture-quiz-light.png",
  "screens/settings-a11y-light.png",
  "screens/calendar-light.png",
];

/**
 * 20–24s (local 0–120 frames). Kinetic word hits on the beat with shape
 * accents, small real UI thumbnails parallax behind.
 */
export const TickerScene: React.FC<TickerSceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Parallax thumbnails behind the type */}
      {THUMBS.map((src, i) => {
        const startFrame = i * 16;
        const tail = startFrame + 50;
        const enter = spring({
          frame: frame - startFrame,
          fps,
          config: { damping: 18, stiffness: 130, mass: 0.9 },
        });
        const exit = spring({
          frame: frame - tail,
          fps,
          config: { damping: 18, stiffness: 130, mass: 0.9 },
        });

        const opacity = Math.max(0, enter - exit * 0.7) * 0.55;
        const driftX = interpolate(frame, [startFrame, startFrame + 70], [80, -80]);

        const cols = vertical ? 2 : 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellW = width / cols;
        const cellH = vertical ? height / 4 : height / 2;
        const x = cellW * col + cellW / 2 + driftX;
        const y = cellH * row + cellH / 2 + (vertical ? 250 : 0);
        const tilt = (i % 2 === 0 ? -1 : 1) * 6;
        const scale = vertical ? 0.42 : 0.46;

        const thumbW = 540;
        const thumbH = 340;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${scale})`,
              opacity,
              borderRadius: 22,
              overflow: "hidden",
              width: thumbW,
              height: thumbH,
              background: "#fff",
              boxShadow: "0 30px 60px -25px rgba(31,56,47,0.35)",
              border: "1px solid rgba(10,13,12,0.06)",
            }}
          >
            <Img
              src={staticFile(src)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        );
      })}

      {/* Kinetic words — each hits on the beat */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: vertical ? 20 : 12,
        }}
      >
        {WORDS.map((word, i) => {
          // 4s / 6 words → ~20 frames per word
          const startFrame = i * 18;
          const enter = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 12, stiffness: 220, mass: 0.5 },
          });
          const peak = interpolate(frame - startFrame, [0, 8, 30], [0, 1, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(enter, [0, 1], [0.7, 1]) * (0.9 + 0.1 * peak);
          const y = interpolate(enter, [0, 1], [40, 0]);
          const visible = interpolate(
            frame - startFrame,
            [0, 6, 60, 80],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          return (
            <div
              key={word}
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: vertical ? 92 : 110,
                letterSpacing: -2.5,
                color: COLORS.green,
                lineHeight: 1.05,
                transform: `translateY(${y}px) scale(${scale})`,
                opacity: visible,
                display: "flex",
                alignItems: "center",
                gap: 22,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: COLORS.greenBright,
                  opacity: visible,
                }}
              />
              {word}
            </div>
          );
        })}
      </div>
    </div>
  );
};
