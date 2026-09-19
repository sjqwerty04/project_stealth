import { Sparkles, Bookmark, Check, X } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import type { TheaterLineupItem } from '../lib/theater';

type TheaterCardProps = {
  status: 'inferring' | 'showing' | 'kept';
  title: string | null;
  facets: [string, string] | null;
  insight: string | null;
  lineup: readonly TheaterLineupItem[];
  onKeep: () => void;
  onDismiss: () => void;
  onFilmClick?: (film: TheaterLineupItem) => void;
  isKeeping?: boolean;
  compact?: boolean;
};

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

function FacetLine({ facets, compact }: { facets: [string, string]; compact: boolean }) {
  return (
    <p className={`font-spec uppercase tracking-wide text-purple-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {facets[0]}
      <span aria-hidden="true"> × </span>
      <span className="sr-only"> and </span>
      {facets[1]}
    </p>
  );
}

function Lineup({
  lineup,
  onFilmClick,
  compact,
}: {
  lineup: readonly TheaterLineupItem[];
  onFilmClick?: (film: TheaterLineupItem) => void;
  compact: boolean;
}) {
  if (lineup.length === 0) return null;
  return (
    <ul className={compact ? 'mt-3 space-y-2' : 'mt-4 space-y-2.5'} data-testid="theater-lineup">
      {lineup.map((film) => (
        <li key={`${film.mediaType}-${film.id}`}>
          <button
            type="button"
            onClick={() => onFilmClick?.(film)}
            className="flex w-full items-start gap-2.5 text-left group"
          >
            {posterUrl(film.posterPath) ? (
              <img
                src={posterUrl(film.posterPath)!}
                alt=""
                className={`flex-shrink-0 object-cover border border-purple-500/30 ${compact ? 'w-8 h-12' : 'w-10 h-[60px]'}`}
              />
            ) : (
              <div
                className={`flex-shrink-0 bg-gray-800 border border-purple-500/30 ${compact ? 'w-8 h-12' : 'w-10 h-[60px]'}`}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-gray-200 group-hover:text-white transition-colors">
                {film.title} {film.year && <span className="text-gray-500">{film.year}</span>}
              </span>
              <span className="block text-[11px] text-gray-400 leading-snug">{film.reason}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function TheaterCard({
  status,
  title,
  facets,
  insight,
  lineup,
  onKeep,
  onDismiss,
  onFilmClick,
  isKeeping = false,
  compact = false,
}: TheaterCardProps) {
  const kept = status === 'kept';
  const inferring = status === 'inferring';
  const shell = compact
    ? 'rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden'
    : 'bg-gradient-to-r from-[#1a0a2e] via-[#0f1a3d] to-[#1a0a2e] border-b border-purple-500/50 rounded-xl';

  return (
    <section className={`relative ${shell}`} aria-label="Theater" data-testid="theater-card">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close Theater"
        className="absolute top-2 right-2 z-10 p-1 rounded-full text-gray-500 hover:text-white hover:bg-black/40 transition-colors"
      >
        <X size={14} />
      </button>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`text-purple-400 flex-shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          <span className="font-spec text-[10px] uppercase tracking-widest text-purple-300">
            {inferring ? 'Theater forming' : 'Theater'}
          </span>
        </div>

        {inferring ? (
          <div className="flex items-center gap-2 text-gray-400">
            <SelectsChaseLoader size={compact ? 'xs' : 'sm'} />
            <span className="text-sm italic">Reading your trail…</span>
          </div>
        ) : (
          <>
            <h3 className={`font-display text-fg leading-tight ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
            {facets && <FacetLine facets={facets} compact={compact} />}
            {insight && <p className="mt-2 text-sm text-gray-300 leading-relaxed">{insight}</p>}

            <button
              type="button"
              onClick={onKeep}
              disabled={isKeeping || kept}
              data-testid="theater-keep"
              className={`mt-3 flex items-center justify-center gap-2 min-h-11 py-2.5 px-4 font-medium text-sm border transition-colors disabled:cursor-not-allowed ${
                kept
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 disabled:opacity-50'
              }`}
            >
              {isKeeping ? <SelectsChaseLoader size="xs" /> : kept ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{kept ? 'Kept' : 'Keep Theater'}</span>
            </button>

            <Lineup lineup={lineup} onFilmClick={onFilmClick} compact={compact} />
          </>
        )}
      </div>
    </section>
  );
}
