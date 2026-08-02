"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationControls,
} from "motion/react";
import { FILM_CARDS, CARD_POSITIONS, type FilmCardData } from "./filmData";

const DRAG_THRESHOLD = 100;

// Landscape card dimensions
const CARD_W = 280;
const CARD_H = 158; // 16:9

function FilmCard({
  film,
  position,
  zIndex,
  onDragAway,
  wobbleTrigger,
  entranceDelay,
  isVisible,
}: {
  film: FilmCardData;
  position: { x: number; y: number; rotation: number };
  zIndex: number;
  onDragAway: (id: number) => void;
  wobbleTrigger: number;
  entranceDelay: number;
  isVisible: boolean;
}) {
  const controls = useAnimationControls();
  const dragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const hasEnteredRef = useRef(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { stiffness: 150, damping: 20, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-100, 100], [6, -6]), springCfg);
  const rotateY = useSpring(useTransform(mouseX, [-100, 100], [-6, 6]), springCfg);

  // Entrance
  useEffect(() => {
    if (isVisible && !hasEnteredRef.current) {
      hasEnteredRef.current = true;
      const t = setTimeout(() => {
        controls.start({ opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } });
      }, entranceDelay * 1000);
      return () => clearTimeout(t);
    }
  }, [isVisible, entranceDelay, controls]);

  // Idle wobble
  useEffect(() => {
    if (wobbleTrigger === 0 || !hasEnteredRef.current) return;
    const delay = Math.random() * 280;
    const t = setTimeout(() => {
      controls.start({
        rotate: [
          position.rotation,
          position.rotation + 2.5,
          position.rotation - 1.5,
          position.rotation + 0.8,
          position.rotation,
        ],
        transition: { duration: 0.55, ease: "easeInOut" },
      });
    }, delay);
    return () => clearTimeout(t);
  }, [wobbleTrigger, controls, position.rotation]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - (r.left + r.width / 2));
    mouseY.set(e.clientY - (r.top + r.height / 2));
  };
  const onMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  return (
    <motion.div
      drag
      dragMomentum
      dragElastic={0.08}
      dragConstraints={{ left: -600, right: 600, top: -450, bottom: 450 }}
      initial={{ x: position.x, y: position.y, rotate: position.rotation, opacity: 0, scale: 0.85 }}
      animate={controls}
      whileDrag={{ scale: 1.06, cursor: "grabbing" }}
      onDragStart={() => { dragRef.current = true; setIsDragging(true); }}
      onDragEnd={(_, info) => {
        dragRef.current = false;
        setIsDragging(false);
        const dist = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2);
        if (dist > DRAG_THRESHOLD) onDragAway(film.tmdbId);
      }}
      style={{
        rotateX,
        rotateY,
        zIndex: isDragging ? 50 : zIndex,
        willChange: "transform",
        left: "50%",
        top: "50%",
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2,
        width: CARD_W,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="film-card absolute cursor-grab select-none"
    >
      <div
        className="relative rounded-md overflow-hidden"
        style={{
          width: CARD_W,
          height: CARD_H,
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}
      >
        {/* Top sprocket strip */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between px-2 py-1" style={{ background: "rgba(0,0,0,0.7)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.12)" }} />
          ))}
        </div>

        {/* Backdrop still */}
        <Image
          src={`https://image.tmdb.org/t/p/w780${film.backdropPath}`}
          alt={film.title}
          fill
          className="object-cover pointer-events-none"
          style={{ filter: "grayscale(65%) brightness(0.65)" }}
          sizes="280px"
          unoptimized
        />

        {/* Dark vignette overlay */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)" }}
        />

        {/* Centered title logo */}
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="relative w-full" style={{ maxWidth: 180, height: 60 }}>
            <Image
              src={`https://image.tmdb.org/t/p/w300${film.logoPath}`}
              alt={`${film.title} logo`}
              fill
              className="object-contain pointer-events-none"
              style={{ filter: "brightness(0.75) grayscale(1)" }}
              sizes="180px"
              unoptimized
            />
          </div>
        </div>

        {/* Rating badge top-right */}
        <div
          className="absolute top-6 right-2 z-30 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{
            background: "rgba(0,0,0,0.75)",
            color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(4px)",
          }}
        >
          {film.rating.toFixed(1)}
        </div>

        {/* Bottom sprocket strip */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-between px-2 py-1" style={{ background: "rgba(0,0,0,0.7)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.12)" }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SelectCard({ revealProgress }: { revealProgress: number }) {
  const film = FILM_CARDS.find((f) => f.isSelect)!;
  const glow = 40 + revealProgress * 60;
  const glowA = 0.25 + revealProgress * 0.45;
  const pulse = revealProgress >= 0.6;

  return (
    <motion.div
      className="absolute select-none pointer-events-none"
      style={{ zIndex: 0, left: "50%", top: "50%", x: "-50%", y: "-50%" }}
      animate={pulse ? { scale: [1, 1.03, 1], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } } : { scale: 1 }}
    >
      <div
        className="relative rounded-md overflow-hidden transition-shadow duration-500"
        style={{
          width: CARD_W,
          height: CARD_H,
          background: "#0a0a0a",
          border: "2px solid var(--gold)",
          boxShadow: `0 0 ${glow}px rgba(212,175,55,${glowA}), 0 0 ${glow * 2}px rgba(212,175,55,${glowA * 0.4})`,
        }}
      >
        {/* Top sprocket strip */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between px-2 py-1" style={{ background: "rgba(0,0,0,0.7)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: "var(--bg-primary)", border: "1px solid rgba(212,175,55,0.2)" }} />
          ))}
        </div>

        {/* Backdrop still — full color */}
        <Image
          src={`https://image.tmdb.org/t/p/w780${film.backdropPath}`}
          alt={film.title}
          fill
          className="object-cover"
          style={{ filter: `brightness(${0.5 + revealProgress * 0.4})` }}
          sizes="280px"
          unoptimized
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.5) 100%)" }}
        />

        {/* Centered title logo — full color */}
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="relative w-full" style={{ maxWidth: 200, height: 70 }}>
            <Image
              src={`https://image.tmdb.org/t/p/w300${film.logoPath}`}
              alt={`${film.title} logo`}
              fill
              className="object-contain pointer-events-none"
              sizes="200px"
              unoptimized
            />
          </div>
        </div>

        {/* Rating badge */}
        <div
          className="absolute top-6 right-2 z-30 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ background: "rgba(212,175,55,0.9)", color: "#1a1a1a", border: "1px solid rgba(212,175,55,0.5)" }}
        >
          {film.rating.toFixed(1)}
        </div>

        {/* YOUR SELECT badge bottom */}
        <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center">
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{
              color: "var(--gold)",
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(212,175,55,0.3)",
              backdropFilter: "blur(6px)",
              opacity: 0.4 + revealProgress * 0.6,
            }}
          >
            Your Select
          </span>
        </div>

        {/* Bottom sprocket */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-between px-2 py-1" style={{ background: "rgba(0,0,0,0.7)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: "var(--bg-primary)", border: "1px solid rgba(212,175,55,0.2)" }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function DiscoverCards() {
  const sectionRef = useRef<HTMLElement>(null);
  const [movedCards, setMovedCards] = useState<Set<number>>(new Set());
  const [wobbleTrigger, setWobbleTrigger] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mediocreFilms = FILM_CARDS.filter((f) => !f.isSelect);
  const totalMediocre = mediocreFilms.length;
  const revealProgress = movedCards.size / totalMediocre;

  const handleDragAway = useCallback((id: number) => {
    setHasInteracted(true);
    setMovedCards((prev) => new Set(prev).add(id));
  }, []);

  // Intersection observer for entrance
  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.25 }
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Idle wobble
  useEffect(() => {
    if (!isVisible || hasInteracted) return;
    const t = setTimeout(() => setWobbleTrigger((p) => p + 1), 3000);
    return () => clearTimeout(t);
  }, [isVisible, hasInteracted]);

  useEffect(() => {
    if (!isVisible || hasInteracted) return;
    const i = setInterval(() => setWobbleTrigger((p) => p + 1), 4200);
    return () => clearInterval(i);
  }, [isVisible, hasInteracted]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary overflow-hidden py-24"
    >
      {/* Heading */}
      <div className="text-center mb-10 px-4 z-10">
        <h2
          style={{
            fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(2rem, 3.5vw, 4rem)",
            fontWeight: 400,
            lineHeight: 1.1,
          }}
        >
          Swipe toward what pulls you.
        </h2>
        <p
          className="mt-4 text-white/40 text-sm uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
        >
          Orbit™ — discover by instinct
        </p>
        <div className="mt-6 text-white/55 text-sm leading-relaxed max-w-md mx-auto space-y-1">
          <p>↑ Up — what you feel.</p>
          <p>← Left — how it tells the story.</p>
          <p>↓ Down — what it means.</p>
          <p>→ Right — what it looks like.</p>
        </div>
      </div>

      {/* Cards arena */}
      <div
        className="relative z-10"
        style={{
          width: "min(95vw, 800px)",
          height: "min(75vh, 560px)",
          perspective: "1200px",
          touchAction: "none",
        }}
        onPointerDown={() => setHasInteracted(true)}
      >
        <SelectCard revealProgress={revealProgress} />

        {mediocreFilms.map((film, index) => (
          <FilmCard
            key={film.tmdbId}
            film={film}
            position={CARD_POSITIONS[index]}
            zIndex={10 + index}
            onDragAway={handleDragAway}
            wobbleTrigger={wobbleTrigger}
            entranceDelay={index * 0.09}
            isVisible={isVisible}
          />
        ))}
      </div>

      {/* Hint text */}
      <motion.p
        className="mt-10 text-center z-10"
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: "11px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
        animate={{ color: revealProgress >= 0.6 ? "rgba(212,175,55,0.85)" : "rgba(255,255,255,0.22)" }}
        transition={{ duration: 0.5 }}
      >
        {revealProgress >= 0.6
          ? "Four swipes in. Selects already knows you."
          : revealProgress > 0
            ? `${movedCards.size} of ${totalMediocre} moved...`
            : "Every gesture is a signal. Every signal sharpens the next."}
      </motion.p>
    </section>
  );
}
