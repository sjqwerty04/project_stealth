"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Stat {
  figure: string;
  body: string;
}

const STATS: Stat[] = [
  {
    figure: "49%",
    body: "of viewers sometimes give up and watch nothing.",
  },
  {
    figure: "110 hrs",
    body: "a year. Five days. Spent deciding, not watching.",
  },
  {
    figure: "481 / 9,000",
    body: "films on the best streaming service rated above 7.5. The rest is signal lost in noise.",
  },
];

export default function StatsBand() {
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<(HTMLDivElement | null)[]>([]);
  const closingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      statsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power2.out",
            delay: i * 0.12,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
            },
          }
        );
      });

      gsap.fromTo(
        closingRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: closingRef.current,
            start: "top 80%",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const setStatRef = (i: number) => (el: HTMLDivElement | null) => {
    statsRef.current[i] = el;
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-bg-primary py-32 px-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
        <p
          className="text-center text-white/40 text-xs tracking-[0.3em] uppercase mb-20"
          style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
        >
          The 40-minute Friday night is not a you problem.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 mb-24">
          {STATS.map((stat, i) => (
            <div
              key={i}
              ref={setStatRef(i)}
              className="opacity-0 flex flex-col items-center text-center px-4"
            >
              <div
                style={{
                  fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
                  fontSize: "clamp(3rem, 5vw, 5rem)",
                  fontWeight: 400,
                  lineHeight: 1,
                  color: "var(--accent)",
                  letterSpacing: "-0.02em",
                }}
              >
                {stat.figure}
              </div>
              <div
                className="mt-6 h-px w-12"
                style={{ background: "rgba(255,255,255,0.15)" }}
              />
              <p className="mt-6 text-white/70 text-base leading-relaxed max-w-xs">
                {stat.body}
              </p>
            </div>
          ))}
        </div>

        {/* Closing */}
        <div
          ref={closingRef}
          className="opacity-0 max-w-3xl mx-auto text-center space-y-3"
        >
          <p
            className="text-white text-2xl md:text-3xl leading-snug"
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            You are not bad at finding films.
          </p>
          <p
            className="text-white/60 text-xl md:text-2xl leading-snug"
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            You are searching for signal in a library that is mostly noise.
          </p>
          <p className="pt-8 text-white/25 text-[10px] tracking-[0.2em] uppercase">
            UserTesting 2024 · CivicScience 2025 · IMDb / MAX library audit, 2026
          </p>
        </div>
      </div>
    </section>
  );
}
