import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { FONT_DISPLAY } from "../theme";
import { snapInBack, easeOutQuart, easeInQuart } from "../anim";

interface ColdOpenProps {
  vertical: boolean;
}

/**
 * 0.00 – 6.00s (180 frames). White screen, black text. Two distinct beats
 * with a CLEAN HANDOFF — the sentence is fully gone before the punchline
 * appears, so the two never overlap on screen.
 *
 *   0   – 56    Sentence reveals one word at a time:
 *               "Students go to too many places just to study"
 *   56  – 92    Sentence holds
 *   92  – 102   Sentence fades fully OUT  ← screen is empty white at 102
 *   110 – 148   Punchline "Too. many. steps." pops in word-by-word
 *               (each word lands on its own frame so the audio "boom"
 *                hits exactly as it stamps on)
 *   148 – 164   Punchline holds
 *   164 – 180   Punchline scales out & fades → blast into the drop
 */
const SENTENCE_WORDS = [
  "Students",
  "go",
  "to",
  "too",
  "many",
  "places",
  "just",
  "to",
  "study",
];

const PER_WORD = 6; // frames between sentence word reveals
const SENTENCE_FADE_OUT: [number, number] = [86, 96]; // fully clear by 96

// Each punchline word lands on a SONG BEAT (110 BPM) so the audio "boom" hits
// exactly as the word stamps on — frames 98/115/131 = song beats at 3.26/3.82/
// 4.36s. They hold, then blast out on the drop (frame 180 = 6.0s). The first
// word starts a clear 2 frames AFTER the sentence has fully vanished.
const WORD_APPEAR_FRAMES = [98, 115, 131];
const PUNCH_BLAST: [number, number] = [166, 180];

export const ColdOpen: React.FC<ColdOpenProps> = ({ vertical }) => {
  const frame = useCurrentFrame();

  // Sentence opacity: solid until 92, gone by 102.
  const sentenceOpacity = interpolate(frame, SENTENCE_FADE_OUT, [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Punchline blast-out (scale up + fade). Entries are driven per-word below;
  // the parent only owns the exit.
  const punchExitProg = interpolate(frame, PUNCH_BLAST, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const punchOverallOpacity = 1 - easeInQuart(punchExitProg);
  const punchVisible =
    frame >= WORD_APPEAR_FRAMES[0] && punchOverallOpacity > 0.01;
  // Scale OUTWARD on exit — "blast" into the green world of the drop.
  const punchScale = 1 + 0.35 * easeOutQuart(punchExitProg);

  const sentenceFontSize = vertical ? 44 : 60;
  const punchFontSize = vertical ? 130 : 200;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* White overlay — covers the green-mesh background under the cold open */}
      <div
        style={{ position: "absolute", inset: 0, background: "#ffffff" }}
      />

      {/* Sentence — word-by-word reveal */}
      {sentenceOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: vertical ? "10px 14px" : "16px 22px",
            padding: "0 8%",
            opacity: sentenceOpacity,
          }}
        >
          {SENTENCE_WORDS.map((word, i) => {
            const appearAt = i * PER_WORD;
            const wordAlpha = snapInBack(frame - appearAt, 7, 1.4);
            const wordY = (1 - wordAlpha) * 22;
            return (
              <div
                key={`${word}-${i}`}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: sentenceFontSize,
                  letterSpacing: "-0.03em",
                  color: "#0a0d0c",
                  lineHeight: 1.0,
                  whiteSpace: "nowrap",
                  opacity: wordAlpha,
                  transform: `translateY(${wordY}px) scale(${0.92 + 0.08 * wordAlpha})`,
                }}
              >
                {word}
              </div>
            );
          })}
        </div>
      )}

      {/* Punchline — each word pops in on its own frame */}
      {punchVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4%",
            opacity: punchOverallOpacity,
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: punchFontSize,
              letterSpacing: "-0.04em",
              color: "#0a0d0c",
              textAlign: "center",
              lineHeight: 1.0,
              whiteSpace: "nowrap",
              transform: `scale(${punchScale})`,
              display: "inline-flex",
              gap: vertical ? 18 : 28,
            }}
          >
            {["Too.", "many.", "steps."].map((w, i) => {
              const wordAppearAt = WORD_APPEAR_FRAMES[i];
              const wordIn = snapInBack(frame - wordAppearAt, 6, 1.55);
              const wordY = (1 - wordIn) * 28;
              const wordScale = 0.7 + 0.3 * wordIn;
              return (
                <span
                  key={w}
                  style={{
                    color: "#0a0d0c",
                    display: "inline-block",
                    opacity: wordIn,
                    transform: `translateY(${wordY}px) scale(${wordScale})`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
