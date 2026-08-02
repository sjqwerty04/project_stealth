"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATS = [
  {
    line1: "Americans spend 110 hours a year",
    line2: "just deciding what to watch.",
  },
  {
    line1: "That's five full days.",
    line2: "Gone.",
  },
  {
    line1: "47% of subscribers say",
    line2: "they're paying too much for what they're getting.",
  },
  {
    line1: "The most-watched film of 2024",
    line2: "was Moana. From 2016.",
  },
  {
    line1: "53% of US households",
    line2: "have at least four streaming subscriptions.",
  },
  {
    line1: "50,000 titles across your subscriptions.",
    line2: "Nobody built a guide. Until now.",
  },
];

export default function LoadingState() {
  const [currentStat, setCurrentStat] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const statInterval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % STATS.length);
    }, 4000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 0.5, 100));
    }, 150);

    return () => {
      clearInterval(statInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-xl mx-auto px-8 text-center"
    >
      <p className="text-text-muted text-xs tracking-[0.3em] uppercase mb-16">
        Building your cinematic soul
      </p>

      {/* Cycling stats */}
      <div className="h-32 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStat}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <p
              className="text-white/70 text-xl leading-relaxed"
              style={{
                fontFamily:
                  "var(--font-playfair), 'Playfair Display', Georgia, serif",
                fontStyle: "italic",
              }}
            >
              {STATS[currentStat].line1}
            </p>
            <p
              className="text-white text-2xl mt-2"
              style={{
                fontFamily:
                  "var(--font-playfair), 'Playfair Display', Georgia, serif",
                fontStyle: "italic",
              }}
            >
              {STATS[currentStat].line2}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Film strip progress bar */}
      <div className="mt-16 max-w-xs mx-auto">
        <div className="flex items-center gap-1 mb-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-6 rounded-sm transition-colors duration-300"
              style={{
                backgroundColor:
                  i / 20 < progress / 100
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.03)",
              }}
            />
          ))}
        </div>
        {/* Sprocket holes */}
        <div className="flex justify-between px-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/10"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
