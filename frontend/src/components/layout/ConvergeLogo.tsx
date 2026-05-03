/**
 * Converge wordmark glyph — three curved swooshes wrapping around a triangle
 * of inward-pointing arrows. Renders inline SVG so it inherits `currentColor`
 * and scales cleanly with any class-based size.
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
      {/* Three curved arc swooshes around the perimeter, rotated 120° apart. */}
      <g
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M 34 7 A 25 25 0 0 1 56 38" />
        <g transform="rotate(120 32 32)">
          <path d="M 34 7 A 25 25 0 0 1 56 38" />
        </g>
        <g transform="rotate(240 32 32)">
          <path d="M 34 7 A 25 25 0 0 1 56 38" />
        </g>
      </g>
      {/* Three inward-pointing arrows converging on the center. */}
      <g
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        <g transform="rotate(120 32 32)">
          <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        </g>
        <g transform="rotate(240 32 32)">
          <path d="M 32 17 L 32 28 M 28 24 L 32 28 L 36 24" />
        </g>
      </g>
    </svg>
  );
}
