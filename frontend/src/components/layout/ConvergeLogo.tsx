/**
 * Converge wordmark glyph — three fan blades converging on a circle, matching
 * the icon used in the design mockups.
 *
 * Renders inline SVG so it inherits `currentColor` and scales cleanly with
 * any class-based size.
 */

interface ConvergeLogoProps {
  className?: string;
}

export function ConvergeLogo({ className = "w-8 h-8" }: ConvergeLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      role="img"
    >
      {/* Outer ring */}
      <circle
        cx="32"
        cy="32"
        r="27"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      {/* Three converging blades — rotated copies of one path. */}
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M32 32 L32 12 L40 22" />
        <path d="M32 32 L49 42 L36 44" />
        <path d="M32 32 L15 42 L28 44" />
      </g>
      {/* Center hub */}
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  );
}
