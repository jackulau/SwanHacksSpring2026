import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { Background } from "./components/Background";
import { ColdOpen } from "./scenes/ColdOpen";
import { QAScene } from "./scenes/QAScene";
import {
  NotesAnswer,
  FlashcardsAnswer,
  QuizAnswer,
  CanvasAnswer,
  FeatureConvergeAnswer,
} from "./scenes/QAPanels";
import { CaptureCardAnswer } from "./scenes/CaptureCardScene";
import { SignLanguageScene } from "./scenes/SignLanguageScene";
import { LockupScene } from "./scenes/LockupScene";
import { FPS, SCENE_TIMES } from "./theme";

export interface ConvergeAdProps {
  vertical: boolean;
}

/**
 * ~57s composition. Katana wipe ONLY on qa1 (the drop) and qa6 (the
 * convergence into the lockup); every other handoff uses a soft fade.
 *
 *   coldOpen : 0.0  – 6.0    — problem hook (sentence → "Too. many. steps.")
 *   qa1      : 6.0  – 12.0   — DROP · Capture            (katana)
 *   qa2      : 12.0 – 18.0   — Notes                     (fade)
 *   qa3      : 18.0 – 24.0   — Flashcards                (fade)
 *   qa4      : 24.0 – 30.0   — Quiz                      (fade)
 *   qa5      : 30.0 – 38.0   — Canvas auto notes+quizzes (fade · hero)
 *   signLang : 38.0 – 45.1   — Sign → text, accessibility (fade)
 *   qa6      : 45.1 – 51.1   — All-in-one convergence    (katana)
 *   lockup   : 51.1 – 57.1   — logo + CTA
 */
export const ConvergeAd: React.FC<ConvergeAdProps> = ({ vertical }) => {
  const s = (t: number): number => Math.round(t * FPS);
  const fade = 4; // 0.13s — punchy crossfades on cut

  // Pair definitions: question, answer panel, handoff transition + direction.
  const pairs: Array<{
    key: keyof typeof SCENE_TIMES;
    question: string;
    answer: (
      localFrame: number,
      vertical: boolean,
      total: number,
    ) => React.ReactNode;
    transition: "katana" | "fade";
    direction: "ltr" | "rtl";
    /** Optional local-frame override so the katana lands on a song beat. */
    transAt?: number;
  }> = [
    { key: "qa1", question: "Lecture too fast?", answer: CaptureCardAnswer, transition: "katana", direction: "ltr" },
    { key: "qa2", question: "Notes a mess?", answer: NotesAnswer, transition: "fade", direction: "rtl" },
    { key: "qa3", question: "Test tomorrow?", answer: FlashcardsAnswer, transition: "fade", direction: "ltr" },
    { key: "qa4", question: "Cram for it?", answer: QuizAnswer, transition: "fade", direction: "rtl" },
    { key: "qa5", question: "Lost on Canvas?", answer: CanvasAnswer, transition: "fade", direction: "ltr" },
    // qa6 katana lands on the song beat at 40.37s (75 frames into the scene).
    { key: "qa6", question: "All in one app?", answer: FeatureConvergeAnswer, transition: "katana", direction: "rtl", transAt: 75 },
  ];

  return (
    <AbsoluteFill style={{ background: "#fbfbf9", overflow: "hidden" }}>
      <Background />

      {/* Cold open — hard cut at the music drop, no fade out */}
      <Sequence
        from={s(SCENE_TIMES.coldOpen.start)}
        durationInFrames={s(SCENE_TIMES.coldOpen.end - SCENE_TIMES.coldOpen.start)}
        name="ColdOpen"
      >
        <ColdOpen vertical={vertical} />
      </Sequence>

      {/* Five Q&A pairs. QA1 hard-cuts in on the drop (no enter fade); the
          rest use a 4-frame crossfade for softer scene-to-scene transitions. */}
      {pairs.map((pair, idx) => {
        const range = SCENE_TIMES[pair.key];
        const isFirst = idx === 0;
        const enterBuf = isFirst ? 0 : fade;
        const startF = s(range.start) - enterBuf;
        const totalF = s(range.end - range.start);
        return (
          <Sequence
            key={pair.key}
            from={startF}
            durationInFrames={totalF + enterBuf + fade}
            name={pair.key}
          >
            <SceneFader enterFor={enterBuf} exitAt={totalF + enterBuf - fade}>
              <QAScene
                question={pair.question}
                answer={pair.answer}
                transition={pair.transition}
                direction={pair.direction}
                vertical={vertical}
                totalFrames={totalF}
                transAtFrame={pair.transAt}
              />
            </SceneFader>
          </Sequence>
        );
      })}

      {/* Sign-to-text accessibility feature — slots between Canvas (qa5) and
          the convergence (qa6). Soft crossfade in and out. */}
      {(() => {
        const range = SCENE_TIMES.signLang;
        const innerF = s(range.end - range.start);
        return (
          <Sequence
            from={s(range.start) - fade}
            durationInFrames={innerF + fade * 2}
            name="SignLanguage"
          >
            <SceneFader enterFor={fade} exitAt={innerF + fade}>
              <SignLanguageScene vertical={vertical} />
            </SceneFader>
          </Sequence>
        );
      })()}

      {/* Lockup */}
      <Sequence
        from={s(SCENE_TIMES.lockup.start) - fade}
        durationInFrames={s(SCENE_TIMES.lockup.end - SCENE_TIMES.lockup.start) + fade * 2}
        name="Lockup"
      >
        <SceneFader enterFor={fade}>
          <LockupScene vertical={vertical} />
        </SceneFader>
      </Sequence>

      {/* Master audio: NCS song + 6 sword swipes + typing burst — all
          pre-mixed in track.wav via ffmpeg so the SFX cut through cleanly. */}
      <Audio src={staticFile("audio/track.wav")} />
    </AbsoluteFill>
  );
};

interface SceneFaderProps {
  enterFor?: number;
  exitAt?: number | null;
  children: React.ReactNode;
}

const SceneFader: React.FC<SceneFaderProps> = ({
  enterFor = 0,
  exitAt = null,
  children,
}) => {
  const frame = useCurrentFrame();
  const enterAlpha =
    enterFor > 0
      ? interpolate(frame, [0, enterFor], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const exitAlpha =
    exitAt !== null
      ? interpolate(frame, [exitAt, exitAt + (enterFor || 4)], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const opacity = enterAlpha * exitAlpha;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
