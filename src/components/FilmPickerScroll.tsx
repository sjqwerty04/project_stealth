import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check } from 'lucide-react';
import { buildImageUrl } from '../lib/tmdb';

interface Film {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
}

interface FilmPickerScrollProps {
  selected: Film[];
  onToggle: (film: Film) => void;
  maxSelect: number;
}

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY as string;

function tmdbResultToFilm(r: any): Film {
  return {
    id: r.id,
    title: r.title ?? r.name ?? 'Unknown',
    year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
    posterPath: r.poster_path ?? null,
  };
}

export default function FilmPickerScroll({ selected, onToggle, maxSelect }: FilmPickerScrollProps) {
  const [trending, setTrending] = useState<Film[]>([]);
  const [searchResults, setSearchResults] = useState<Film[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadingTrending, setLoadingTrending] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchTrending() {
      setLoadingTrending(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=en-US&page=1`),
          fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=en-US&page=2`),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        if (cancelled) return;
        const combined: Film[] = [];
        const seen = new Set<number>();
        for (const r of [...(d1.results ?? []), ...(d2.results ?? [])]) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            combined.push(tmdbResultToFilm(r));
          }
        }
        setTrending(combined);
      } catch (e) {
        console.error('Failed to fetch trending:', e);
      } finally {
        if (!cancelled) setLoadingTrending(false);
      }
    }
    fetchTrending();
    return () => { cancelled = true; };
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&language=en-US&page=1`
      );
      const data = await res.json();
      setSearchResults((data.results ?? []).map(tmdbResultToFilm));
    } catch (e) {
      console.error('TMDB search failed:', e);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const films = searchResults ?? trending;
  const selectedIds = new Set(selected.map((f) => f.id));

  function handleTap(film: Film) {
    const isSelected = selectedIds.has(film.id);
    if (!isSelected && selected.length >= maxSelect) return;
    onToggle(film);
  }

  return (
    <div className="relative flex flex-col h-full">
      <div className="px-4 pt-2 pb-1">
        <span className="text-xs text-gray-500">
          {selected.length}/{maxSelect} selected
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
        {loadingTrending && !searchResults ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 px-4">
            {films.map((film) => {
              const isSelected = selectedIds.has(film.id);
              const isDisabled = !isSelected && selected.length >= maxSelect;
              return (
                <button
                  key={film.id}
                  onClick={() => handleTap(film)}
                  disabled={isDisabled}
                  className={`relative aspect-[2/3] rounded-lg overflow-hidden bg-[#18181b] transition-opacity ${
                    isDisabled ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  {film.posterPath ? (
                    <img
                      src={buildImageUrl(film.posterPath, 'w200')}
                      alt={film.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#27272a] flex items-center justify-center">
                      <span className="text-gray-600 text-xs text-center px-1 leading-tight">{film.title}</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-purple-600/70 flex items-center justify-center">
                      <Check size={24} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-[#09090b] border-t border-white/10 px-4 py-3">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-4 text-gray-600 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search films..."
            className="bg-[#09090b] rounded-full pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-600 w-full border border-white/10 focus:border-purple-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 text-gray-500 hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
