"use client";

/**
 * FilmRings — Two large SVG circles with sprocket-like dashes,
 * centered at the right edge of the Selects panel so only the
 * left half is visible. Parallax movement tied to mouse position.
 */

type Props = {
  /** Normalized mouse X within the Selects panel (0–1) */
  rx: number;
  /** Normalized mouse Y within the Selects panel (0–1) */
  ry: number;
};

export function FilmRings({ rx, ry }: Props) {
  // Rings move in opposite directions for depth illusion
  const dx1 = (rx - 0.5) * -32;
  const dy1 = (ry - 0.5) * -22;
  const dx2 = (rx - 0.5) * 18;
  const dy2 = (ry - 0.5) * 12;

  return (
    <svg
      className="rings-svg"
      viewBox="-500 -500 1000 1000"
      width="900"
      height="900"
      style={{ overflow: "visible" }}
    >
      {/* Outer ring — darkest, barely visible */}
      <circle
        cx={dx2}
        cy={dy2}
        r="420"
        fill="none"
        stroke="#1e1e1e"
        strokeWidth="28"
        strokeDasharray="10 18"
        strokeLinecap="round"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />
      {/* Outer ring thin border line */}
      <circle
        cx={dx2}
        cy={dy2}
        r="407"
        fill="none"
        stroke="#161616"
        strokeWidth="1.5"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />
      <circle
        cx={dx2}
        cy={dy2}
        r="433"
        fill="none"
        stroke="#161616"
        strokeWidth="1.5"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />

      {/* Inner ring — slightly lighter, moves independently */}
      <circle
        cx={dx1}
        cy={dy1}
        r="290"
        fill="none"
        stroke="#272727"
        strokeWidth="22"
        strokeDasharray="8 14"
        strokeLinecap="round"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />
      <circle
        cx={dx1}
        cy={dy1}
        r="279"
        fill="none"
        stroke="#1c1c1c"
        strokeWidth="1.2"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />
      <circle
        cx={dx1}
        cy={dy1}
        r="301"
        fill="none"
        stroke="#1c1c1c"
        strokeWidth="1.2"
        style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
      />
    </svg>
  );
}
