"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

interface FilmStill {
  id: number;
  title: string;
  backdrop: string;
}

export default function FilmStripScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [stills, setStills] = useState<FilmStill[]>([]);

  useEffect(() => {
    const loadStills = async () => {
      try {
        const response = await fetch("/api/films/stills");
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        setStills(Array.isArray(data.stills) ? data.stills.slice(0, 12) : []);
      } catch (error) {
        console.error("Failed to load stills:", error);
        setStills([]);
      }
    };

    loadStills();
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !stripRef.current || stills.length === 0) return;

    const ctx = gsap.context(() => {
      // Pin the section
      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: `+=${stills.length * 100}%`,
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          if (stripRef.current) {
            const frameHeight = stripRef.current.scrollHeight - window.innerHeight;
            stripRef.current.style.transform = `translateY(-${self.progress * frameHeight}px)`;
          }
        },
      });

      // Animate text in
      gsap.fromTo(
        textRef.current,
        { opacity: 0, x: 50 },
        {
          opacity: 1,
          x: 0,
          duration: 1,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            end: "top 20%",
            scrub: true,
          },
        }
      );

      return () => trigger.kill();
    }, sectionRef);

    return () => ctx.revert();
  }, [stills]);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-bg-primary"
    >
      <div className="flex h-full">
        {/* Left — Film strip */}
        <div className="w-[40%] h-full relative overflow-hidden">
          {/* Sprocket holes track */}
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 flex flex-col items-center justify-start gap-4 pt-4">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm bg-bg-primary border border-white/10 shrink-0"
              />
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 flex flex-col items-center justify-start gap-4 pt-4">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm bg-bg-primary border border-white/10 shrink-0"
              />
            ))}
          </div>

          {/* Film frames */}
          <div
            ref={stripRef}
            className="absolute left-8 right-8 top-0 transition-none"
          >
            {stills.map((still, i) => (
              <div
                key={still.id || i}
                className="relative w-full aspect-[16/10] mb-1 overflow-hidden"
              >
                <Image
                  src={still.backdrop}
                  alt={still.title}
                  fill
                  className="object-cover"
                  sizes="40vw"
                  unoptimized
                />
                {/* Frame border */}
                <div className="absolute inset-0 border border-white/5" />
              </div>
            ))}
          </div>

          {/* Film strip border */}
          <div className="absolute inset-y-0 left-0 w-[1px] bg-white/10" />
          <div className="absolute inset-y-0 right-0 w-[1px] bg-white/10" />
        </div>

        {/* Right — Copy */}
        <div
          ref={textRef}
          className="w-[60%] h-full flex flex-col justify-center px-16 lg:px-24 opacity-0"
        >
          <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-6">
            Most-watched film of 2024
          </p>
          <h2
            className="mb-10"
            style={{
              fontFamily:
                "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(2.25rem, 3.6vw, 4.5rem)",
              fontWeight: 400,
              lineHeight: 1.1,
            }}
          >
            Moana.
            <span className="block text-white/50 text-[0.65em] mt-3 not-italic">
              2016. In a library of 50,000 titles.
            </span>
          </h2>

          <div className="space-y-5 text-white/60 text-lg leading-relaxed max-w-lg">
            <p>Not the 6/10 average.</p>
            <p>Not the algorithm&apos;s agenda.</p>
            <p>Not what&apos;s trending in Phoenix.</p>
            <p>Not the film a committee approved.</p>
            <p className="text-white/30">Not for everyone.</p>
            <p className="text-white font-medium text-xl mt-8">For you.</p>
            <p
              className="mt-4"
              style={{
                fontFamily:
                  "var(--font-playfair), 'Playfair Display', Georgia, serif",
                fontStyle: "italic",
                fontSize: "1.5rem",
                color: "var(--accent)",
              }}
            >
              Selects.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
