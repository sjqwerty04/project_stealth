import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import type { FilmPick } from '../lib/onboarding/state';
import { getCandidates, tmdbResultToFilm } from '../lib/onboarding/candidates';
import { FALLBACK_FILMS, posterUrl } from '../lib/fallbackCatalog';
import Skeleton from './ui/Skeleton';

type Wall = 'positive' | 'negative';

type Props = {
  wall: Wall;
  selected: FilmPick[];
  onToggle: (film: FilmPick) => void;
  searchPlaceholder: string;
};

const TMDB_BASE = 'https://api.themoviedb.org/3';
const WALL_SIZE = 6;
const BLUR_MS = 450;
const MIN_VOTES = 3000;

const SEED_LABEL: Record<Wall, string> = {
  positive: 'TRENDING THIS WEEK',
  negative: 'HIGH RECOGNITION · REGIONALLY WEIGHTED',
};
const RESORTED_LABEL = 'RE-SORTED AROUND YOUR PICK';

function tmdbKey(): string {
  return (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ?? '';
}

function fallbackFilms(): FilmPick[] {
  return FALLBACK_FILMS.map((f) => ({ id: f.id, title: f.title, year: f.year, posterPath: f.posterPath }));
}

function toPick(r: unknown): FilmPick {
  const { id, title, year, posterPath, genreIds } = tmdbResultToFilm(r);
  return { id, title, year, posterPath, genreIds };
}

function regionFromLocale(): string {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  const region = lang.split(/[-_]/)[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : 'US';
}

// mulberry32: tiny seeded PRNG so the wall is stable for a day and differs tomorrow.
function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchResults(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = (await res.json()) as { results?: unknown[] };
  return Array.isArray(data.results) ? data.results : [];
}

function dedupe(films: FilmPick[]): FilmPick[] {
  const seen = new Set<number>();
  return films.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

async function loadSeed(wall: Wall): Promise<FilmPick[]> {
  const key = tmdbKey();
  if (!key) return fallbackFilms();
  try {
    if (wall === 'positive') {
      const pages = await Promise.all(
        [1, 2].map((p) => fetchResults(`${TMDB_BASE}/trending/movie/week?api_key=${key}&language=en-US&page=${p}`)),
      );
      const films = dedupe(pages.flat().map(toPick)).filter((f) => f.posterPath);
      if (!films.length) return fallbackFilms();
      const day = Math.floor(Date.now() / 86_400_000);
      return seededShuffle(films, day);
    }
    const region = regionFromLocale();
    const pages = await Promise.all(
      [1, 2].map((p) =>
        fetchResults(`${TMDB_BASE}/movie/popular?api_key=${key}&language=en-US&region=${region}&page=${p}`),
      ),
    );
    const raw = pages.flat();
    const recognised = raw.filter((r) => ((r as { vote_count?: number }).vote_count ?? 0) >= MIN_VOTES);
    const source = recognised.length >= WALL_SIZE ? recognised : raw;
    const films = dedupe(source.map(toPick)).filter((f) => f.posterPath);
    return films.length ? films : fallbackFilms();
  } catch (e) {
    console.error('PickWall seed failed:', e);
    return fallbackFilms();
  }
}

function imageSrc(posterPath: string): string {
  return posterPath.startsWith('http') ? posterPath : posterUrl(posterPath, 'w500');
}

const gridVariants = {
  enter: {},
  show: {},
  out: { transition: { duration: BLUR_MS / 1000 } },
};

function tileVariants(reduced: boolean) {
  return {
    enter: { opacity: 0, scale: reduced ? 1 : 0.92 },
    show: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: { duration: 0.32, delay: reduced ? 0 : i * 0.05, ease: [0.2, 0.8, 0.2, 1] as const },
    }),
    out: {
      opacity: 0,
      filter: reduced ? 'blur(0px)' : 'blur(12px)',
      transition: { duration: BLUR_MS / 1000, ease: 'easeOut' as const },
    },
  };
}

export default function PickWall({ wall, selected, onToggle, searchPlaceholder }: Props) {
  const reduced = useReducedMotion() ?? false;
  const [seed, setSeed] = useState<FilmPick[] | null>(null);
  const [tiles, setTiles] = useState<FilmPick[]>([]);
  const [generation, setGeneration] = useState(0);
  const [resorted, setResorted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FilmPick[] | null>(null);
  const shownIds = useRef(new Set<number>());
  const pickSeq = useRef(0);

  const selectedIds = useMemo(() => new Set(selected.map((f) => f.id)), [selected]);

  useEffect(() => {
    let cancelled = false;
    loadSeed(wall).then((films) => {
      if (cancelled) return;
      setSeed(films);
      setTiles(films);
      films.forEach((f) => shownIds.current.add(f.id));
    });
    return () => {
      cancelled = true;
    };
  }, [wall]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const key = tmdbKey();
      try {
        if (!key) throw new Error('no key');
        const raw = await fetchResults(
          `${TMDB_BASE}/search/movie?api_key=${key}&query=${encodeURIComponent(q)}&language=en-US&page=1`,
        );
        if (!cancelled) setResults(dedupe(raw.map(toPick)));
      } catch {
        if (!cancelled) {
          const needle = q.toLowerCase();
          setResults(fallbackFilms().filter((f) => f.title.toLowerCase().includes(needle)));
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const resortAround = useCallback(
    async (pick: FilmPick) => {
      const seq = ++pickSeq.current;
      const exclude = new Set<number>([...selectedIds, pick.id, ...shownIds.current]);
      const started = Date.now();
      const candidates = await getCandidates(pick, exclude);
      // Let the poster finish its flight into the hero before the wall re-sorts under it.
      const wait = Math.max(0, 350 - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      if (seq !== pickSeq.current) return;
      const next: FilmPick[] = candidates.slice(0, WALL_SIZE);
      if (next.length < WALL_SIZE) {
        const taken = new Set(next.map((f) => f.id));
        for (const f of seed ?? fallbackFilms()) {
          if (next.length >= WALL_SIZE) break;
          if (!taken.has(f.id) && !exclude.has(f.id)) {
            next.push(f);
            taken.add(f.id);
          }
        }
        // Small catalogs (offline fallback) run dry; recycle anything not currently picked.
        for (const f of seed ?? fallbackFilms()) {
          if (next.length >= WALL_SIZE) break;
          if (!taken.has(f.id) && !selectedIds.has(f.id) && f.id !== pick.id) {
            next.push(f);
            taken.add(f.id);
          }
        }
      }
      next.forEach((f) => shownIds.current.add(f.id));
      setTiles(next);
      setGeneration((g) => g + 1);
      setResorted(true);
    },
    [seed, selectedIds],
  );

  function handleTileTap(film: FilmPick) {
    if (selectedIds.has(film.id)) {
      onToggle(film);
      return;
    }
    onToggle(film);
    if (query) setQuery('');
    void resortAround(film);
  }

  function handleHeroTap(film: FilmPick) {
    onToggle(film);
    setTiles((t) => (t.some((f) => f.id === film.id) ? t : [film, ...t]));
  }

  const showingSearch = results !== null;
  const visible = showingSearch ? results : tiles.filter((f) => !selectedIds.has(f.id));
  const label = showingSearch ? `RESULTS FOR "${query.trim().toUpperCase()}"` : resorted ? RESORTED_LABEL : SEED_LABEL[wall];
  const tv = tileVariants(reduced);

  return (
    <LayoutGroup id={`pick-wall-${wall}`}>
      <div className="flex flex-col h-full min-h-0 min-w-0">
        <div data-testid="pick-hero" className="px-4 min-w-0" aria-live="polite">
          <AnimatePresence initial={false}>
            {selected.length > 0 && (
              <motion.div
                key="hero-row"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="flex gap-1.5 pb-3 overflow-x-auto no-scrollbar snap-x">
                  {selected.map((film) => (
                    <motion.button
                      key={film.id}
                      layoutId={`film-${film.id}`}
                      type="button"
                      data-testid="pick-hero-item"
                      aria-label={`Remove ${film.title}`}
                      onClick={() => handleHeroTap(film)}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      className={`relative h-[132px] overflow-hidden bg-film text-left ${
                        selected.length <= 2 ? 'flex-1 min-w-0' : 'shrink-0 snap-start w-[104px]'
                      }`}
                      style={{ borderRadius: 2 }}
                    >
                      {film.posterPath && (
                        <img src={imageSrc(film.posterPath)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/20 to-transparent" />
                      <span className="absolute left-3 bottom-3 right-3 font-display font-bold text-fg text-base leading-tight uppercase tracking-tight line-clamp-2">
                        {film.title}
                      </span>
                      <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center bg-base/70 text-fg">
                        <X size={12} />
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-4">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-fg-3 pointer-events-none" />
            <input
              type="text"
              data-testid="pick-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full min-h-11 bg-base-2 border border-line pl-9 pr-10 py-2.5 font-spec text-[12px] text-fg placeholder:text-fg-3 outline-none focus:border-fg-2"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-fg-3 hover:text-fg-2"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 pb-2">
            <span data-testid="pick-wall-label" className="font-spec text-[10px] uppercase tracking-[0.12em] text-fg-3 truncate">
              {label}
            </span>
            <span className="font-spec text-[10px] uppercase tracking-[0.12em] text-fg-3 shrink-0 pl-3">
              {selected.length} picked
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-24">
          {seed === null && !showingSearch ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: WALL_SIZE }, (_, i) => (
                <Skeleton key={i} className="aspect-[2/3]" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={showingSearch ? `search` : `wall-${generation}`}
                variants={gridVariants}
                initial="enter"
                animate="show"
                exit="out"
                className="grid grid-cols-3 gap-1.5"
              >
                {visible.map((film, i) => {
                  const isSelected = selectedIds.has(film.id);
                  return (
                    <motion.button
                      key={film.id}
                      layoutId={`film-${film.id}`}
                      custom={i}
                      variants={tv}
                      type="button"
                      data-testid="film-pick"
                      aria-label={film.title}
                      aria-pressed={isSelected}
                      onClick={() => handleTileTap(film)}
                      whileTap={{ scale: 0.97 }}
                      className="relative aspect-[2/3] min-h-11 overflow-hidden bg-base-3 text-left"
                      style={{ borderRadius: 2 }}
                    >
                      {film.posterPath ? (
                        <img
                          src={imageSrc(film.posterPath)}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-base-3" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-base/95 to-transparent" />
                      <span className="absolute left-2 right-2 bottom-2 font-spec text-[10px] leading-[1.2] uppercase tracking-[0.04em] text-fg line-clamp-2">
                        {film.title}
                      </span>
                    </motion.button>
                  );
                })}
                {visible.length === 0 && (
                  <p className="col-span-3 py-10 text-center font-spec text-[11px] uppercase tracking-[0.12em] text-fg-3">
                    {showingSearch ? 'No matches' : 'Nothing left here'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}
