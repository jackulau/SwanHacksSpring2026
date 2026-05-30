import React from "react";
import { Composition } from "remotion";
import { loadFont as loadSchibsted } from "@remotion/google-fonts/SchibstedGrotesk";
import { loadFont as loadAtkinson } from "@remotion/google-fonts/AtkinsonHyperlegible";
import { ConvergeAd } from "./ConvergeAd";
import { DURATION_FRAMES, FPS } from "./theme";

loadSchibsted();
loadAtkinson();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ConvergeAd-H"
        component={ConvergeAd}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ vertical: false }}
      />
      <Composition
        id="ConvergeAd-V"
        component={ConvergeAd}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ vertical: true }}
      />
    </>
  );
};
