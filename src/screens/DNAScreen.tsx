import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, User, Film, ExternalLink } from 'lucide-react';
import { useDNAStore, nodeId } from '../stores/dnaStore';
import type { DNANode, DNAMovie, DNAPerson } from '../stores/dnaStore';
import { getMovieDNA, getPersonFilms } from '../lib/dnaEngine';
import { imageUrlOrNull, type PosterSize } from '../lib/tmdb';

const img = (path: string | null, size: PosterSize = 'w342') => imageUrlOrNull(path, size);

type Dots = { people?: DNAPerson[]; films?: DNAMovie[] };

export default function DNAScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { path, currentIndex, enter, pushNode, jumpTo, reset } = useDNAStore();

  const [loading, setLoading] = useState(true);
  const [dots, setDots] = useState<Dots>({});
  const [loadingDots, setLoadingDots] = useState(false);
  const cache = useRef<Map<string, Dots>>(new Map());

  const current: DNANode | undefined = path[currentIndex];

  // Bootstrap: load the entry movie's DNA and start the path.
  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoading(true);
    reset();
    cache.current.clear();
    getMovieDNA(parseInt(id, 10)).then((res) => {
      if (cancelled || !res) {
        setLoading(false);
        return;
      }
      enter(res.movie);
      cache.current.set(`m${res.movie.id}`, { people: res.people });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, enter, reset]);

  // Load the dots for whatever node is currently focused.
  useEffect(() => {
    if (!current) return;
    const key = nodeId(current);
    const cached = cache.current.get(key);
    if (cached) {
      setDots(cached);
      return;
    }
    let cancelled = false;
    setLoadingDots(true);
    const work =
      current.kind === 'movie'
        ? getMovieDNA(current.movie.id).then((r) => (r ? { people: r.people } : {}))
        : getPersonFilms(
            current.person.id,
            // Exclude the movie we branched from, if any.
            currentIndex > 0 && path[currentIndex - 1].kind === 'movie'
              ? (path[currentIndex - 1] as { kind: 'movie'; movie: DNAMovie }).movie.id
              : undefined
          ).then((r) => (r ? { films: r.films } : {}));
    work.then((d) => {
      if (cancelled) return;
      cache.current.set(key, d);
      setDots(d);
      setLoadingDots(false);
    });
    return () => {
      cancelled = true;
    };
  }, [current, currentIndex, path]);

  const handleExit = useCallback(() => navigate(-1), [navigate]);

  if (loading || !current) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar + breadcrumb tree */}
      <div className="sticky top-0 z-20 bg-gradient-to-b from-black via-black/90 to-transparent px-3 pt-3 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handleExit}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Exit DNA"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-lg font-extrabold tracking-[-0.12em]">DNA</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {path.map((node, i) => (
            <div key={nodeId(node) + i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={14} className="text-gray-600 shrink-0" />}
              <button
                onClick={() => jumpTo(i)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  i === currentIndex
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {node.kind === 'movie' ? node.movie.title : node.person.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Center node */}
      <div className="px-4">
        {current.kind === 'movie' ? (
          <MovieCenter
            movie={current.movie}
            onOpen={() => navigate(`/movie/${current.movie.id}?from=dna&type=movie`)}
          />
        ) : (
          <PersonCenter person={current.person} />
        )}
      </div>

      {/* Dots */}
      <div className="flex-1 px-4 pb-10 pt-6">
        <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-4 flex items-center gap-2">
          {current.kind === 'movie' ? (
            <>
              <User size={14} /> Cast & Crew
            </>
          ) : (
            <>
              <Film size={14} /> Films
            </>
          )}
        </h3>

        {loadingDots ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
          </div>
        ) : current.kind === 'movie' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-5">
            {(dots.people || []).map((person) => (
              <button
                key={person.id}
                onClick={() => pushNode({ kind: 'person', person })}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 ring-2 ring-transparent group-hover:ring-purple-500 group-active:scale-95 transition-all">
                  {img(person.profilePath, 'w185') ? (
                    <img src={img(person.profilePath, 'w185')!} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={28} className="text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="text-center leading-tight">
                  <p className="text-xs font-medium text-white line-clamp-2">{person.name}</p>
                  {person.role && <p className="text-[10px] text-gray-500 line-clamp-1">{person.role}</p>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {(dots.films || []).map((film) => (
              <button
                key={film.id}
                onClick={() => pushNode({ kind: 'movie', movie: film })}
                className="flex flex-col gap-1.5 group"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 ring-2 ring-transparent group-hover:ring-purple-500 group-active:scale-95 transition-all">
                  {img(film.posterPath, 'w342') ? (
                    <img src={img(film.posterPath, 'w342')!} alt={film.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={24} className="text-gray-600" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-white line-clamp-2 leading-tight">{film.title}</p>
                {film.year && <p className="text-[10px] text-gray-500">{film.year}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MovieCenter({ movie, onOpen }: { movie: DNAMovie; onOpen: () => void }) {
  const bg = img(movie.backdropPath, 'w780') || img(movie.posterPath, 'w500');
  return (
    <div className="relative rounded-2xl overflow-hidden h-44 sm:h-56 flex items-end">
      {bg ? (
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="relative p-4 w-full flex items-end justify-between gap-3">
        <div className="min-w-0">
          {img(movie.logoPath, 'w500') ? (
            <img src={img(movie.logoPath, 'w500')!} alt={movie.title} className="max-h-12 w-auto max-w-[70%] object-contain drop-shadow-lg" />
          ) : (
            <h2 className="text-2xl font-bold drop-shadow-lg leading-tight">{movie.title}</h2>
          )}
          {movie.year && <p className="text-sm text-gray-300 mt-1">{movie.year}</p>}
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 backdrop-blur-sm hover:bg-white/25 text-sm font-medium transition-colors"
        >
          <ExternalLink size={15} /> Open
        </button>
      </div>
    </div>
  );
}

function PersonCenter({ person }: { person: DNAPerson }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 shrink-0 ring-2 ring-purple-500/40">
        {img(person.profilePath, 'w185') ? (
          <img src={img(person.profilePath, 'w185')!} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User size={36} className="text-gray-600" />
          </div>
        )}
      </div>
      <div>
        <h2 className="text-2xl font-bold leading-tight">{person.name}</h2>
        {person.role && <p className="text-sm text-gray-400 mt-1">{person.role}</p>}
      </div>
    </div>
  );
}
