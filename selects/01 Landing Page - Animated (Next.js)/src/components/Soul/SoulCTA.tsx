"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MosaicEffect from "./MosaicEffect";

gsap.registerPlugin(ScrollTrigger);

interface SoulCTAProps {
  onActivate: () => void;
}

export default function SoulCTA({ onActivate }: SoulCTAProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mosaicActive, setMosaicActive] = useState(false);
  const animatingRef = useRef(false);

  // Button fade-in on scroll into view
  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        buttonRef.current,
        { opacity: 0, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  // Hover triggers the film-reel mosaic slide-left
  const handleHoverEnter = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setMosaicActive(true);
  }, []);

  const handleMosaicComplete = useCallback(() => {
    // Animation done — reset flag so next hover re-triggers
    setMosaicActive(false);
    animatingRef.current = false;
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full flex flex-col items-center justify-center bg-bg-primary overflow-hidden px-6"
    >
      {/* Headline above the pill */}
      <h2
        className="text-center mb-6 max-w-3xl"
        style={{
          fontFamily:
            "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(2rem, 4vw, 4rem)",
          fontWeight: 400,
          lineHeight: 1.15,
        }}
      >
        Your taste, finally readable.
      </h2>
      <p className="text-center text-white/45 text-base md:text-lg leading-relaxed max-w-xl mb-12">
        Soul is the most accurate picture of your cinematic self that has
        ever existed. Every film you log refines it. Every Orbit sharpens it.
        Yours alone.
      </p>

      {/* Mosaic + button wrapper */}
      <div className="relative">
        {/* Mosaic layer — covers the button pill, behind text */}
        <div
          className="absolute rounded-full overflow-hidden"
          style={{
            inset: "-2px",
            zIndex: 0,
          }}
        >
          <MosaicEffect
            isActive={mosaicActive}
            onComplete={handleMosaicComplete}
          />
        </div>

        {/* Button — above mosaic so text stays readable */}
        <button
          ref={buttonRef}
          onMouseEnter={handleHoverEnter}
          onClick={onActivate}
          className="relative px-12 py-5 rounded-full border border-white/50 bg-transparent cursor-pointer opacity-0 transition-colors duration-200 hover:border-white"
          style={{ zIndex: 1 }}
        >
          <span
            className="text-white text-[11px] font-medium uppercase"
            style={{
              letterSpacing: "0.3em",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            Activate your Soul →
          </span>
        </button>
      </div>

      <p
        className="absolute bottom-12 text-sm"
        style={{
          color: "rgba(255,255,255,0.35)",
          fontFamily:
            "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontStyle: "italic",
        }}
      >
        Tonight&apos;s pick. <span className="text-white/55">&ldquo;Personalised.&rdquo;</span>
      </p>
    </section>
  );
}
