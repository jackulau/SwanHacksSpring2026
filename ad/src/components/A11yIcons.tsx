import React from "react";
import { COLORS } from "../theme";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

interface IconBaseProps extends IconProps {
  children: React.ReactNode;
}

const IconBase: React.FC<IconBaseProps> = ({
  size = 64,
  color = COLORS.green,
  strokeWidth = 2.2,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

// 1. Live Captions — speech bubble with two text lines + a live dot at the tail
export const LiveCaptionsIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    {/* Rounded speech bubble */}
    <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-3.6 3v-3H6.5A2.5 2.5 0 0 1 4 14.5z" />
    {/* Two caption lines inside */}
    <line x1="7.5" y1="9" x2="14.5" y2="9" />
    <line x1="7.5" y1="12.5" x2="16.5" y2="12.5" />
    {/* Live dot near the tail */}
    <circle cx="6.4" cy="19.6" r="1.1" fill={props.color ?? COLORS.green} stroke="none" />
  </IconBase>
);

// 2. Sign Language — open hand with three lifted fingers + a wave arc at the wrist
export const SignLanguageIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    {/* Palm */}
    <path d="M8 13V6.5a1.4 1.4 0 0 1 2.8 0V11" />
    {/* Middle finger */}
    <path d="M10.8 11V5.2a1.4 1.4 0 0 1 2.8 0V11" />
    {/* Ring finger */}
    <path d="M13.6 11V6.2a1.4 1.4 0 0 1 2.8 0V12" />
    {/* Thumb / outer hand curve */}
    <path d="M16.4 12V9.5a1.4 1.4 0 0 1 2.6-.7c.3.7.4 2 .1 3.4-.5 2.6-1.4 4.6-3.2 6.1-1.4 1.2-3 1.7-4.6 1.7-2.2 0-3.9-1-5.1-2.6L4 13.4a1.4 1.4 0 0 1 2.1-1.8L8 13.4" />
    {/* Wave arc at wrist suggesting motion */}
    <path d="M3 20.5c.9-.7 1.7-.7 2.6 0" />
  </IconBase>
);

// 3. Reading Ruler — three stacked text lines with a ruler highlight + triangle marker
export const ReadingRulerIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    {/* Top text line */}
    <line x1="7" y1="6.5" x2="18" y2="6.5" />
    {/* Middle text line (under the ruler) */}
    <line x1="7" y1="12" x2="18" y2="12" />
    {/* Bottom text line */}
    <line x1="7" y1="17.5" x2="15" y2="17.5" />
    {/* Ruler bar crossing the middle line */}
    <rect x="3.5" y="10.4" width="17" height="3.2" rx="0.7" />
    {/* Triangle indicator on the left edge of the ruler */}
    <path
      d="M3.5 12 L1.4 10.4 L1.4 13.6 Z"
      fill={props.color ?? COLORS.green}
      stroke="none"
    />
  </IconBase>
);

// 4. Text to Speech — speaker silhouette with three radiating sound-wave arcs
export const TextToSpeechIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    {/* Speaker body */}
    <path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z" />
    {/* Inner sound wave */}
    <path d="M14.6 10c.7.6 1.1 1.4 1.1 2.3s-.4 1.7-1.1 2.3" />
    {/* Middle sound wave */}
    <path d="M16.7 8c1.4 1.1 2.2 2.6 2.2 4.3s-.8 3.2-2.2 4.3" />
    {/* Outer sound wave */}
    <path d="M18.8 6c2.1 1.6 3.3 3.8 3.3 6.3s-1.2 4.7-3.3 6.3" />
  </IconBase>
);

// 5. Focus Mode — concentric target with crosshair ticks and center dot
export const FocusModeIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    {/* Outer ring */}
    <circle cx="12" cy="12" r="8.5" />
    {/* Middle ring */}
    <circle cx="12" cy="12" r="5.5" />
    {/* Inner ring */}
    <circle cx="12" cy="12" r="2.6" />
    {/* Crosshair ticks */}
    <line x1="12" y1="1.4" x2="12" y2="3.4" />
    <line x1="12" y1="20.6" x2="12" y2="22.6" />
    <line x1="1.4" y1="12" x2="3.4" y2="12" />
    <line x1="20.6" y1="12" x2="22.6" y2="12" />
    {/* Center dot */}
    <circle
      cx="12"
      cy="12"
      r="0.9"
      fill={props.color ?? COLORS.green}
      stroke="none"
    />
  </IconBase>
);

// 6. Themes — circle split into light/dark halves with sun ray + moon curve accents
export const ThemesIcon: React.FC<IconProps> = (props) => {
  const fillColor = props.color ?? COLORS.green;
  return (
    <IconBase {...props}>
      {/* Outer circle */}
      <circle cx="12" cy="12" r="8.5" />
      {/* Left half filled (dark side) */}
      <path
        d="M12 3.5a8.5 8.5 0 0 0 0 17z"
        fill={fillColor}
        stroke="none"
      />
      {/* Small moon curve detail inside filled half */}
      <path
        d="M8.6 9.2a3 3 0 0 0 0 5.6"
        stroke={COLORS.cream}
        strokeWidth={(props.strokeWidth ?? 2.2) * 0.8}
      />
      {/* Sun ray detail inside outlined half */}
      <line x1="15.2" y1="12" x2="17" y2="12" />
      <circle cx="14.6" cy="12" r="0.6" fill={fillColor} stroke="none" />
    </IconBase>
  );
};
