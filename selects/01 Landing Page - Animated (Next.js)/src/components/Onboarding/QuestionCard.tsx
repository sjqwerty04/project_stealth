"use client";

import { type ReactElement } from "react";
import { motion } from "framer-motion";
import FilmSearch from "@/components/ui/FilmSearch";

interface QuestionCardProps {
  questionNumber: number;
  question: string;
  type: "film-search" | "multi-select";
  options?: { id: string; label: string; icon: string }[];
  onAnswer: (answer: string | string[]) => void;
}

export default function QuestionCard({
  questionNumber,
  question,
  type,
  options,
  onAnswer,
}: QuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -80 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-xl mx-auto px-8 text-center"
    >
      <p className="text-text-muted text-xs tracking-[0.3em] uppercase mb-4">
        {questionNumber} of 3
      </p>

      <h3
        className="mb-10"
        style={{
          fontFamily:
            "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
          fontWeight: 400,
          lineHeight: 1.3,
        }}
      >
        {question}
      </h3>

      {type === "film-search" && (
        <div className="flex justify-center">
          <FilmSearch
            onSelect={(film) => onAnswer(`${film.title} (${film.year})`)}
            placeholder="Start typing a film name..."
          />
        </div>
      )}

      {type === "multi-select" && options && (
        <MultiSelect options={options} onSelect={onAnswer} />
      )}
    </motion.div>
  );
}

function MultiSelect({
  options,
  onSelect,
}: {
  options: { id: string; label: string; icon: string }[];
  onSelect: (answer: string[]) => void;
}) {
  const selected = new Set<string>();

  const toggle = (id: string) => {
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    onSelect(Array.from(selected));
  };

  const iconMap: Record<string, ReactElement> = {
    eye: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    book: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    users: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    clapperboard: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="M2 7h20l-2-4H4L2 7z" />
        <path d="M7 7V3M12 7V3M17 7V3" />
      </svg>
    ),
  };

  return (
    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.id)}
          className={`group flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
            selected.has(opt.id)
              ? "border-white/40 bg-white/10 text-white"
              : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70"
          }`}
        >
          <div className="transition-transform duration-300 group-hover:scale-110">
            {iconMap[opt.icon] || iconMap.eye}
          </div>
          <span className="text-sm tracking-[0.1em] uppercase">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
