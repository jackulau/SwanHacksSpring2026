import React from "react";
import { Img, staticFile } from "remotion";

interface MacBookProps {
  screenSrc: string;
  /** approximate width of the laptop in stage pixels */
  width?: number;
  /** Y-axis rotation in degrees for the floating-tilt look */
  tiltY?: number;
  /** X-axis rotation in degrees */
  tiltX?: number;
  /** Z-axis rotation in degrees for subtle roll */
  rollZ?: number;
  /** how much the screen edge glare shows (0–1) */
  glare?: number;
  /** objectPosition on the screenshot, e.g. "top left" */
  screenObjectPosition?: string;
  /** rendered absolutely inside the screen area (above the screenshot, under the glare) */
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Zelios-style floating MacBook chassis: aluminum bezel + dark inset screen
 * + soft hinge shadow + base reflection. Perspective comes from the parent
 * via `transform: perspective(...) rotateY(...)`.
 *
 * The aspect ratio is fixed to ~16:10 so screenshots fill cleanly.
 */
export const MacBook: React.FC<MacBookProps> = ({
  screenSrc,
  width = 1280,
  tiltY = -8,
  tiltX = 4,
  rollZ = 0,
  glare = 0.8,
  screenObjectPosition = "top left",
  overlay,
  style,
}) => {
  // The dark INNER screen must be a true 16:10 so 16:10 screenshots fill it
  // exactly (object-fit: cover) with no side cropping. The bezel is subtracted
  // from the width, so derive the inner height from the inner width — this also
  // keeps the bezel symmetric all the way around the screen.
  const screenW = width;
  const bezel = Math.round(width * 0.018);
  const innerW = screenW - bezel * 2;
  const innerH = Math.round(innerW * 10 / 16);
  const lidH = innerH + bezel * 2;
  const baseH = Math.round(width * 0.022);
  const baseWidth = Math.round(width * 1.04);
  const totalW = width;
  const totalH = lidH + baseH * 2;

  return (
    <div
      style={{
        width: totalW,
        height: totalH,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: `perspective(2200px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) rotateZ(${rollZ}deg)`,
        ...style,
      }}
    >
      {/* Drop shadow under the device */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: totalH - baseH * 0.4,
          width: baseWidth,
          height: 36,
          transform: "translate(-50%, 0)",
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(31,56,47,0.45) 0%, rgba(31,56,47,0) 70%)",
          filter: "blur(8px)",
        }}
      />

      {/* Aluminum lid */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: lidH,
          borderRadius: bezel,
          background:
            "linear-gradient(180deg, #e8eaee 0%, #d6d9df 50%, #c2c6cd 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), 0 24px 60px -20px rgba(31,56,47,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Dark inset screen */}
        <div
          style={{
            position: "absolute",
            top: bezel,
            left: bezel,
            width: innerW,
            height: innerH,
            borderRadius: Math.round(bezel * 0.7),
            background: "#0a0e0c",
            overflow: "hidden",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 30px rgba(0,0,0,0.4)",
          }}
        >
          <Img
            src={staticFile(screenSrc)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: screenObjectPosition,
            }}
          />

          {/* User-supplied overlay: animated cursor, click pulses, state badges */}
          {overlay && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              {overlay}
            </div>
          )}

          {/* Glossy screen glare */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0) 60%)",
              opacity: glare,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />

          {/* Subtle vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.18) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Notch (camera) */}
      <div
        style={{
          position: "absolute",
          top: bezel * 0.32,
          left: "50%",
          transform: "translateX(-50%)",
          width: bezel * 4,
          height: bezel * 0.45,
          background: "#1f2127",
          borderRadius: 999,
        }}
      />

      {/* Hinge */}
      <div
        style={{
          position: "absolute",
          top: lidH,
          left: "50%",
          transform: "translateX(-50%)",
          width: baseWidth * 0.94,
          height: 4,
          background:
            "linear-gradient(180deg, rgba(80,86,98,0.7) 0%, rgba(20,22,26,0.4) 100%)",
          borderRadius: 2,
          boxShadow: "0 6px 14px -6px rgba(31,56,47,0.3)",
        }}
      />

      {/* Base */}
      <div
        style={{
          position: "absolute",
          top: lidH + 4,
          left: "50%",
          width: baseWidth,
          height: baseH,
          transform: "translateX(-50%)",
          background:
            "linear-gradient(180deg, #d4d7dd 0%, #b9bdc4 100%)",
          borderRadius: `0 0 ${baseH / 2}px ${baseH / 2}px`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.6), 0 18px 40px -16px rgba(31,56,47,0.35)",
        }}
      />

      {/* Trackpad cutout (just a subtle dark line) */}
      <div
        style={{
          position: "absolute",
          top: lidH + 4 + baseH * 0.55,
          left: "50%",
          transform: "translateX(-50%)",
          width: baseWidth * 0.34,
          height: 2,
          background: "rgba(31,42,52,0.18)",
          borderRadius: 2,
        }}
      />
    </div>
  );
};

interface PhoneProps {
  screenSrc: string;
  width?: number;
  tiltY?: number;
  tiltX?: number;
  screenObjectPosition?: string;
  style?: React.CSSProperties;
}

/**
 * Floating iPhone-ish slab for cards that want a portrait device instead
 * of the laptop. Used sparingly so the laptop stays the main hero.
 */
export const Phone: React.FC<PhoneProps> = ({
  screenSrc,
  width = 360,
  tiltY = -8,
  tiltX = 4,
  screenObjectPosition = "top center",
  style,
}) => {
  const w = width;
  const h = Math.round(w * 2.16);
  const bezel = Math.round(w * 0.035);
  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: `perspective(1800px) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`,
        borderRadius: w * 0.13,
        background: "linear-gradient(160deg, #2c2f36 0%, #1a1c20 100%)",
        boxShadow:
          "0 50px 100px -36px rgba(31,56,47,0.5), 0 18px 40px -16px rgba(31,56,47,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
        padding: bezel,
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: w * 0.1,
          overflow: "hidden",
          background: "#0a0e0c",
          position: "relative",
        }}
      >
        <Img
          src={staticFile(screenSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: screenObjectPosition,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: w * 0.35,
            height: bezel * 0.95,
            background: "#0a0e0c",
            borderRadius: `0 0 ${bezel}px ${bezel}px`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0) 60%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};
