"use client";

import dynamic from "next/dynamic";
import HeroCopy from "./HeroCopy";

const FilmReelRings = dynamic(() => import("./FilmReelRings"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-bg-primary" />
  ),
});

interface HeroSectionProps {
  onCTAClick: () => void;
}

export default function HeroSection({ onCTAClick }: HeroSectionProps) {
  return (
    <section
      className="relative h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #0A0632 0%, #0A0A0A 70%)",
      }}
    >
      <FilmReelRings />
      <HeroCopy onActivate={onCTAClick} />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </div>
    </section>
  );
}
