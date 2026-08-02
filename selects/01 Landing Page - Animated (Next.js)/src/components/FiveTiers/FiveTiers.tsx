"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Tier {
  number: string;
  status: "solved" | "ours";
  label: string;
  body: React.ReactNode;
}

const TIERS: Tier[] = [
  {
    number: "01",
    status: "solved",
    label: "Solved",
    body: <>Title search. You already know what you want.</>,
  },
  {
    number: "02",
    status: "solved",
    label: "Solved",
    body: <>Genre. Crime thriller. Horror comedy.</>,
  },
  {
    number: "03",
    status: "ours",
    label: "Ours",
    body: (
      <>
        Vibe. <em>&ldquo;Something that feels like a rainy Sunday.&rdquo;</em>{" "}
        <em>&ldquo;Like Eternal Sunshine, but darker.&rdquo;</em>
      </>
    ),
  },
  {
    number: "04",
    status: "ours",
    label: "Ours",
    body: <>Word of mouth. Someone who knows you tells you to watch it.</>,
  },
  {
    number: "05",
    status: "ours",
    label: "Ours",
    body: (
      <>
        Rabbit hole. A director to a cinematographer to a film nobody saw. The
        discovery becomes the reward.
      </>
    ),
  },
];

export default function FiveTiers() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const closingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%" },
        }
      );

      rowsRef.current.forEach((row, i) => {
        if (!row) return;
        gsap.fromTo(
          row,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.7,
            ease: "power2.out",
            delay: 0.15 + i * 0.08,
            scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
          }
        );
      });

      gsap.fromTo(
        closingRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: closingRef.current, start: "top 85%" },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const setRowRef = (i: number) => (el: HTMLDivElement | null) => {
    rowsRef.current[i] = el;
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-bg-primary py-32 px-8"
    >
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="opacity-0 mb-20 max-w-3xl">
          <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-6">
            Discovery, broken down
          </p>
          <h2
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(2rem, 4vw, 3.75rem)",
              fontWeight: 400,
              lineHeight: 1.15,
            }}
          >
            Five ways people actually look for films.
            <br />
            <span className="text-white/50">
              Streaming was built for two of them.
            </span>
          </h2>
        </div>

        {/* Tier rows */}
        <div className="space-y-0 border-t border-white/10">
          {TIERS.map((tier, i) => {
            const isOurs = tier.status === "ours";
            return (
              <div
                key={i}
                ref={setRowRef(i)}
                className="opacity-0 grid grid-cols-12 gap-4 py-8 border-b border-white/10 items-baseline"
              >
                {/* Number */}
                <div className="col-span-2 md:col-span-1">
                  <span
                    className="text-xs tracking-[0.2em]"
                    style={{
                      color: isOurs
                        ? "rgba(232,119,34,0.9)"
                        : "rgba(255,255,255,0.25)",
                      fontFamily:
                        "var(--font-inter), Inter, system-ui, sans-serif",
                    }}
                  >
                    {tier.number}
                  </span>
                </div>

                {/* Body */}
                <div className="col-span-10 md:col-span-9">
                  <p
                    className="text-lg md:text-2xl leading-snug"
                    style={{
                      color: isOurs
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,255,255,0.3)",
                      fontFamily:
                        "var(--font-playfair), 'Playfair Display', Georgia, serif",
                    }}
                  >
                    {tier.body}
                  </p>
                </div>

                {/* Status badge */}
                <div className="hidden md:flex col-span-2 justify-end">
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full"
                    style={{
                      color: isOurs
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.25)",
                      border: isOurs
                        ? "1px solid rgba(232,119,34,0.4)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: isOurs
                        ? "rgba(232,119,34,0.08)"
                        : "transparent",
                    }}
                  >
                    {tier.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing */}
        <div ref={closingRef} className="opacity-0 mt-20 max-w-2xl">
          <p
            className="text-2xl md:text-3xl leading-snug"
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Three to five is where the best film experiences happen.
          </p>
          <p
            className="mt-4 text-2xl md:text-3xl leading-snug"
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              color: "var(--accent)",
            }}
          >
            Selects is the first tool built for them.
          </p>
        </div>
      </div>
    </section>
  );
}
