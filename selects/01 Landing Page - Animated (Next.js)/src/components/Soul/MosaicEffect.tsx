"use client";

import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";

interface MosaicEffectProps {
  isActive: boolean;
  onComplete?: () => void;
}

export default function MosaicEffect({ isActive, onComplete }: MosaicEffectProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const COLS = 22;
  const ROWS = 3;

  const animate = useCallback(() => {
    if (!gridRef.current) return;
    const squares = gridRef.current.querySelectorAll(".mosaic-square");

    if (tlRef.current) tlRef.current.kill();

    // Reset to visible
    gsap.set(squares, { x: 0, y: 0, opacity: 1, scale: 1 });

    const tl = gsap.timeline({
      onComplete: () => {
        // Reset back to white — ready for next hover
        gsap.set(squares, { x: 0, y: 0, opacity: 1, scale: 1 });
        onComplete?.();
      },
    });

    // Slide left like a film reel advancing — left-to-right stagger, small y jitter
    tl.to(squares, {
      x: -900,
      y: () => (Math.random() - 0.5) * 6,
      opacity: 0,
      duration: 0.85,
      ease: "power2.in",
      stagger: {
        from: "start",
        amount: 0.38,
        grid: [ROWS, COLS],
        axis: "x",
      },
    });

    tlRef.current = tl;
  }, [onComplete]);

  useEffect(() => {
    if (isActive) {
      animate();
    }
  }, [isActive, animate]);

  return (
    <div
      ref={gridRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <div className="flex flex-wrap w-full h-full">
        {Array.from({ length: ROWS * COLS }).map((_, i) => (
          <div
            key={i}
            className="mosaic-square"
            style={{
              width: `${100 / COLS}%`,
              height: `${100 / ROWS}%`,
              backgroundColor: "white",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
