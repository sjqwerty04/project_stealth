"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { PROCESS_STEPS } from "./processData";

gsap.registerPlugin(ScrollTrigger);

const LAYER_GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  "linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)",
  "linear-gradient(135deg, #533483 0%, #0f3460 100%)",
  "linear-gradient(135deg, #E87722 0%, #D4AF37 100%)",
];

const LAYER_HEIGHTS = [280, 240, 200, 160];

function SprocketStrip({ count, side }: { count: number; side: "left" | "right" }) {
  return (
    <div
      className={`absolute ${side === "left" ? "left-0" : "right-0"} top-0 bottom-0 w-5 z-10 flex flex-col items-center justify-start gap-3 pt-3`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-sm bg-bg-primary border border-white/10 shrink-0"
        />
      ))}
    </div>
  );
}

function DataLayerContent() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden px-8">
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 200">
        {/* Abstract network dots and lines */}
        {[
          [40, 60], [120, 30], [200, 80], [280, 50], [360, 70],
          [80, 140], [160, 120], [240, 160], [320, 130], [60, 100],
          [180, 50], [300, 100], [140, 170], [260, 40], [340, 150],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={2.5} fill="white" opacity={0.6}>
              <animate
                attributeName="opacity"
                values="0.3;0.8;0.3"
                dur={`${2 + (i % 3)}s`}
                repeatCount="indefinite"
                begin={`${i * 0.2}s`}
              />
            </circle>
            {i < 12 && (
              <line
                x1={cx}
                y1={cy}
                x2={[120, 200, 280, 360, 80, 160, 240, 320, 180, 300, 140, 260][i]}
                y2={[30, 80, 50, 70, 140, 120, 160, 130, 50, 100, 170, 40][i]}
                stroke="white"
                strokeWidth={0.5}
                opacity={0.15}
              />
            )}
          </g>
        ))}
      </svg>
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
          <span className="text-white/50 text-xs uppercase tracking-[0.2em]">Ingesting signals</span>
          <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
      </div>
    </div>
  );
}

function PatternsLayerContent() {
  const chain = [
    { text: "Heat", color: "#E87722" },
    { text: "blue hues", color: "#4ECDC4" },
    { text: "dark cinematography", color: "#9B59B6" },
    { text: "bank sequences", color: "#E74C3C" },
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center px-6 overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {chain.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{
                color: item.color,
                borderColor: `${item.color}40`,
                background: `${item.color}10`,
              }}
            >
              {item.text}
            </span>
            {i < chain.length - 1 && (
              <svg width="20" height="10" viewBox="0 0 20 10" className="opacity-40">
                <path d="M0 5 L15 5 M12 2 L15 5 L12 8" stroke="white" strokeWidth="1" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TasteLayerContent() {
  const axes = ["Visual Style", "Pacing", "Dialogue", "Mood", "Structure"];
  const values = [0.85, 0.6, 0.7, 0.9, 0.55];
  const cx = 100, cy = 80, r = 55;

  const points = axes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * r * values[i],
      y: cy + Math.sin(angle) * r * values[i],
      lx: cx + Math.cos(angle) * (r + 14),
      ly: cy + Math.sin(angle) * (r + 14),
      ax: cx + Math.cos(angle) * r,
      ay: cy + Math.sin(angle) * r,
    };
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 200 160" className="w-48 h-36">
        {/* Axis lines */}
        {points.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="white" strokeWidth={0.5} opacity={0.15} />
        ))}
        {/* Radar shape */}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(232, 119, 34, 0.15)"
          stroke="#E87722"
          strokeWidth={1.5}
          opacity={0.8}
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#E87722" />
        ))}
        {/* Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="6"
            opacity={0.5}
          >
            {axes[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SelectLayerContent() {
  return (
    <div className="relative w-full h-full flex items-center justify-center gap-4 px-4 overflow-hidden">
      <div className="relative w-20 h-28 rounded overflow-hidden shrink-0 shadow-lg">
        <Image
          src="https://image.tmdb.org/t/p/w342/tlbERIghrQ4oofqlbF7H0K0EYnx.jpg"
          alt="Point Break"
          fill
          className="object-cover"
          sizes="80px"
          unoptimized
        />
      </div>
      <div className="flex flex-col gap-1">
        <span
          className="text-lg font-semibold text-white"
          style={{
            fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontStyle: "italic",
          }}
        >
          Point Break
        </span>
        <span className="text-[10px] text-white/40 uppercase tracking-[0.15em]">1991 &middot; Kathryn Bigelow</span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1 px-2 py-0.5 rounded-full w-fit"
          style={{
            color: "var(--gold)",
            background: "rgba(212, 175, 55, 0.15)",
            border: "1px solid rgba(212, 175, 55, 0.3)",
          }}
        >
          Your Select
        </span>
      </div>
    </div>
  );
}

const LAYER_CONTENTS = [
  DataLayerContent,
  PatternsLayerContent,
  TasteLayerContent,
  SelectLayerContent,
];

export default function ProcessCard() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary overflow-hidden py-24"
    >
      {/* Section heading */}
      <div className="text-center mb-16 px-4">
        <h2
          style={{
            fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(2rem, 3.5vw, 4rem)",
            fontWeight: 400,
            lineHeight: 1.1,
          }}
        >
          Four swipes. Five minutes. Your film.
        </h2>
        <p
          className="mt-4 text-white/40 text-sm uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
        >
          How it works — hover to explore
        </p>
      </div>

      {/* 3D Card */}
      <div
        ref={cardRef}
        className="opacity-0"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {PROCESS_STEPS.map((step, index) => {
            const LayerContent = LAYER_CONTENTS[index];
            const isLastLayer = index === PROCESS_STEPS.length - 1;

            return (
              <div
                key={step.id}
                className="absolute left-1/2"
                style={{
                  width: `${step.widthPercent}%`,
                  maxWidth: `${(step.widthPercent / 100) * 520}px`,
                  height: `${LAYER_HEIGHTS[index]}px`,
                  transform: isHovered
                    ? `translateX(-50%) translateY(${step.translateY}px) translateZ(${step.translateZ}px) rotateY(${step.rotateOnHover}deg)`
                    : "translateX(-50%) translateY(0px) translateZ(0px) rotateY(0deg)",
                  transition: isHovered
                    ? "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    : "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  transformStyle: "preserve-3d",
                  zIndex: index + 1,
                  bottom: 0,
                }}
              >
                {/* Layer card */}
                <div
                  className="relative w-full h-full rounded-lg overflow-hidden"
                  style={{
                    background: LAYER_GRADIENTS[index],
                    border: isLastLayer
                      ? "1px solid rgba(212, 175, 55, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: isLastLayer
                      ? "0 8px 32px rgba(212, 175, 55, 0.2), 0 0 60px rgba(212, 175, 55, 0.1)"
                      : "0 8px 32px rgba(0, 0, 0, 0.4)",
                  }}
                >
                  {/* Sprocket strips */}
                  <SprocketStrip count={Math.floor(LAYER_HEIGHTS[index] / 22)} side="left" />
                  <SprocketStrip count={Math.floor(LAYER_HEIGHTS[index] / 22)} side="right" />

                  {/* Layer content */}
                  <div className="absolute inset-0 left-5 right-5">
                    <LayerContent />
                  </div>

                  {/* Step label — visible on hover */}
                  <div
                    className="absolute bottom-2 left-0 right-0 text-center"
                    style={{
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered ? "translateY(0)" : "translateY(8px)",
                      transition: "opacity 0.4s ease, transform 0.4s ease",
                      transitionDelay: isHovered ? `${index * 0.08}s` : "0s",
                    }}
                  >
                    <span
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.15em]"
                      style={{
                        background: "rgba(0, 0, 0, 0.6)",
                        color: isLastLayer ? "var(--gold)" : "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      {step.subtitle}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Invisible bounding box for hover area */}
          <div
            style={{
              width: "520px",
              height: `${LAYER_HEIGHTS[0]}px`,
              visibility: "hidden",
            }}
          />
        </div>
      </div>
    </section>
  );
}
