import { X } from 'lucide-react';
import FacetLine from './ui/FacetLine';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import SwatchStrip from './ui/SwatchStrip';
import type { Swatches, TheaterLineupItem } from '../lib/theater';

type TheaterCardProps = {
  status: 'inferring' | 'showing' | 'kept';
  title: string | null;
  facets: [string, string] | null;
  insight: string | null;
  swatches: Swatches | null;
  lineup: readonly TheaterLineupItem[];
  onKeep: () => void;
  onDismiss: () => void;
  onFilmClick?: (film: TheaterLineupItem) => void;
  isKeeping?: boolean;
  compact?: boolean;
};

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

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
  const posterWidth = compact ? 32 : 40;
  return (
    <ul className="mt-4 flex flex-col gap-2" data-testid="theater-lineup">
      {lineup.map((film) => (
        <li key={`${film.mediaType}-${film.id}`}>
          <button
            type="button"
            onClick={() => onFilmClick?.(film)}
            className="flex w-full min-h-11 items-start gap-3 text-left"
          >
            <span
              className="block shrink-0 overflow-hidden bg-base-3 border border-line"
              style={{ width: posterWidth, height: posterWidth * 1.5, borderRadius: 0 }}
            >
              {posterUrl(film.posterPath) && (
                <img src={posterUrl(film.posterPath)!} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-body text-fg">
                {film.title}
                {film.year && <span className="font-spec text-label text-fg-2"> {film.year}</span>}
              </span>
              <span className="block text-meta text-fg-2">{film.reason}</span>
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
  swatches,
  lineup,
  onKeep,
  onDismiss,
  onFilmClick,
  isKeeping = false,
  compact = false,
}: TheaterCardProps) {
  const kept = status === 'kept';

  return (
    <section
      className="relative bg-base-2 border border-line"
      style={{ borderRadius: 0 }}
      aria-label="Theater"
      data-testid="theater-card"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close Theater"
        className="absolute top-0 right-0 z-10 flex min-h-11 min-w-11 items-center justify-center text-fg-2 hover:text-fg"
      >
        <X size={16} />
      </button>

      <div className={compact ? 'p-4 pr-11' : 'p-5 pr-11'}>
        <p className="font-spec text-label uppercase tracking-widest text-fg-2">Theater</p>

        {status === 'inferring' ? (
          <div className="mt-3 flex items-center gap-3" data-testid="theater-inferring">
            <SelectsChaseLoader size={compact ? 'xs' : 'sm'} />
            <span className="font-spec text-label uppercase tracking-widest text-fg-2">Reading your trail</span>
          </div>
        ) : (
          <>
            <h3 className={`mt-2 font-display text-fg ${compact ? 'text-lead' : 'text-title'}`}>{title}</h3>
            {facets && <FacetLine facets={facets} className="mt-2" />}
            {insight && <p className="mt-3 text-body text-fg-2">{insight}</p>}
            {swatches && <SwatchStrip swatches={swatches} size={compact ? 32 : 44} className="mt-4" />}

            <button
              type="button"
              onClick={onKeep}
              disabled={isKeeping || kept}
              data-testid="theater-keep"
              className={`mt-4 flex min-h-11 w-full items-center justify-center px-4 font-spec text-label uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                kept ? 'border border-line bg-base-3 text-fg-2' : 'bg-fg text-base disabled:opacity-40'
              }`}
              style={{ borderRadius: 0 }}
            >
              {isKeeping ? <SelectsChaseLoader size="xs" activeColor="#0A0A0B" idleColor="#7C7A76" /> : kept ? 'Kept' : 'Keep Theater'}
            </button>

            <Lineup lineup={lineup} onFilmClick={onFilmClick} compact={compact} />
          </>
        )}
      </div>
    </section>
  );
}
