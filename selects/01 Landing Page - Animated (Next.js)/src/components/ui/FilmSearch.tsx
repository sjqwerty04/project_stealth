"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";

interface FilmResult {
  id: number;
  title: string;
  year: string;
  poster_path: string | null;
  vote_average: number;
}

interface FilmSearchProps {
  onSelect: (film: FilmResult) => void;
  placeholder?: string;
}

export default function FilmSearch({
  onSelect,
  placeholder = "Search for a film...",
}: FilmSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FilmResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<FilmResult | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/films/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (film: FilmResult) => {
    setSelected(film);
    setQuery(`${film.title} (${film.year})`);
    setIsOpen(false);
    onSelect(film);
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-base outline-none focus:border-white/30 transition-colors"
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        }}
      />

      {selected && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#4ECDC4"
            strokeWidth="2"
          >
            <path d="M5 10l3 3 7-7" />
          </svg>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
          {results.map((film) => (
            <button
              key={film.id}
              onClick={() => handleSelect(film)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              {film.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w92${film.poster_path}`}
                  alt={film.title}
                  width={32}
                  height={48}
                  className="rounded-sm object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-12 bg-white/10 rounded-sm" />
              )}
              <div>
                <p className="text-white text-sm">{film.title}</p>
                <p className="text-white/40 text-xs">
                  {film.year}
                  {film.vote_average > 0 &&
                    ` · ${film.vote_average.toFixed(1)}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
