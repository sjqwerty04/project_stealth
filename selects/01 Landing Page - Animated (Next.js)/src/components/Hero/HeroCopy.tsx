"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import Logo from "@/components/ui/Logo";
import MosaicEffect from "@/components/Soul/MosaicEffect";

interface HeroCopyProps {
  onActivate: () => void;
}

export default function HeroCopy({ onActivate }: HeroCopyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [mosaicActive, setMosaicActive] = useState(false);
  const animatingRef = useRef(false);

  useEffect(() => {
    const logoEl = containerRef.current?.querySelector(".logo-wrap");
    if (!logoEl) return;
    const tl = gsap.timeline({ delay: 0.5 });
    tl.fromTo(
      logoEl,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
    );
    tl.fromTo(
      taglineRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: "power2.out" },
      "-=0.3"
    );
    tl.fromTo(
      ctaRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
      "-=0.4"
    );
  }, []);

  const handleHoverEnter = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setMosaicActive(true);
  }, []);

  const handleMosaicComplete = useCallback(() => {
    setMosaicActive(false);
    animatingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none"
    >
      {/* Logo — top left */}
      <div className="logo-wrap absolute top-8 left-8 opacity-0 pointer-events-auto">
        <Logo size="md" />
      </div>

      {/* Center tagline */}
      <h1
        ref={taglineRef}
        className="opacity-0 text-center"
        style={{
          fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontSize: "clamp(2rem, 5vw, 4.5rem)",
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
        }}
      >
        The algorithm never knew you.
        <span
          className="block mt-3"
          style={{ fontStyle: "italic", color: "rgba(255,255,255,0.65)", fontSize: "0.7em" }}
        >
          Selects does.
        </span>
      </h1>

      {/* CTA pill — below tagline */}
      <div ref={ctaRef} className="mt-10 opacity-0 pointer-events-auto relative flex flex-col items-center">
        {/* Mosaic layer */}
        <div
          className="absolute rounded-full overflow-hidden"
          style={{ inset: "-2px", zIndex: 0 }}
        >
          <MosaicEffect
            isActive={mosaicActive}
            onComplete={handleMosaicComplete}
          />
        </div>
        <button
          onMouseEnter={handleHoverEnter}
          onClick={onActivate}
          className="relative px-12 py-5 rounded-full border border-white/50 bg-transparent cursor-pointer transition-colors duration-200 hover:border-white"
          style={{ zIndex: 1 }}
        >
          <span
            className="text-white text-[11px] font-medium uppercase"
            style={{
              letterSpacing: "0.3em",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            Find your film →
          </span>
        </button>
        <p
          className="mt-5 text-[10px] uppercase text-white/30"
          style={{
            letterSpacing: "0.25em",
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          }}
        >
          No algorithm. No agenda. No noise.
        </p>
      </div>
    </div>
  );
}
