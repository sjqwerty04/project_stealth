"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function OriginStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const linesRef = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      linesRef.current.forEach((line, i) => {
        if (!line) return;
        gsap.fromTo(
          line,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: line,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none reverse",
            },
            delay: i * 0.05,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const setLineRef = (i: number) => (el: HTMLParagraphElement | null) => {
    linesRef.current[i] = el;
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full flex items-center justify-center bg-bg-primary py-32"
    >
      <div className="max-w-3xl mx-auto px-8 text-center">
        {/* Section label */}
        <p
          ref={setLineRef(0)}
          className="text-text-muted text-xs tracking-[0.3em] uppercase mb-16 opacity-0"
        >
          Why Selects
        </p>

        <div className="space-y-8">
          <p
            ref={setLineRef(1)}
            className="text-white/70 text-2xl leading-relaxed opacity-0"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            You&apos;ve been here before.
          </p>

          <p
            ref={setLineRef(2)}
            className="text-white/85 text-3xl leading-relaxed opacity-0"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
            }}
          >
            Forty minutes. Nothing. Again.
          </p>

          <div className="h-8" />

          <p
            ref={setLineRef(3)}
            className="text-white/60 text-xl leading-relaxed opacity-0"
          >
            The algorithm isn&apos;t broken. It just wasn&apos;t built for you.
            It was built to keep you watching — not to find you the right film.
          </p>

          <p
            ref={setLineRef(4)}
            className="text-white/55 text-lg leading-relaxed opacity-0"
          >
            It doesn&apos;t know that you stayed through the credits of a film
            nobody saw. It doesn&apos;t know what connected the last five films
            you loved. It knows what performed. It knows what kept people
            watching at 2am. It knows what a committee approved.
          </p>

          <p
            ref={setLineRef(5)}
            className="text-white/80 text-xl leading-relaxed opacity-0"
          >
            It doesn&apos;t know you.
          </p>

          <div className="h-12" />

          <p
            ref={setLineRef(6)}
            className="text-white text-4xl leading-relaxed opacity-0"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              color: "var(--accent)",
            }}
          >
            Selects does.
          </p>

          <div className="h-8" />

          <p
            ref={setLineRef(7)}
            className="text-white/65 text-lg leading-relaxed opacity-0"
          >
            Most recommendation engines compare you to other people. Selects
            builds a model of you alone. Your cinematic DNA. Yours, and
            nobody else&apos;s.
          </p>

          <p
            ref={setLineRef(8)}
            className="text-white/40 text-sm tracking-[0.2em] uppercase opacity-0 mt-12"
          >
            The tools were built for everyone. You are not everyone.
          </p>
        </div>
      </div>
    </section>
  );
}
