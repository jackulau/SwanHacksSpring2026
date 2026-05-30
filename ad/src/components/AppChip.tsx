import React from "react";
import { FONT_DISPLAY, COLORS } from "../theme";

interface AppChipProps {
  label: string;
  emoji?: string;
  color?: string;
  textColor?: string;
  size?: number;
}

/**
 * Generic competitor app chip — a rounded pill with emoji + name.
 * Used in the "One lecture. Five apps." scene to represent the fragmented
 * student workflow that Converge collapses.
 */
export const AppChip: React.FC<AppChipProps> = ({
  label,
  emoji = "•",
  color = "#ffffff",
  textColor = COLORS.ink,
  size = 1,
}) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * size,
        padding: `${16 * size}px ${28 * size}px`,
        borderRadius: 999,
        background: color,
        color: textColor,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 28 * size,
        letterSpacing: -0.3,
        boxShadow:
          "0 18px 40px -16px rgba(31,56,47,0.32), 0 4px 12px -4px rgba(31,56,47,0.18)",
        border: "1px solid rgba(10,13,12,0.05)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 32 * size, lineHeight: 1 }}>{emoji}</span>
      <span>{label}</span>
    </div>
  );
};
