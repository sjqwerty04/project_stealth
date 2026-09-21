import { X } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import { TRAIL_POSTER_CAP, type TheaterFilm } from '../lib/theater';

type TheaterCardProps = {
  status: 'inferring' | 'showing' | 'kept';
  title: string | null;
  insight: string | null;
  trail: readonly TheaterFilm[];
  onKeep: () => void;
  onDismiss: () => void;
  onFilmClick?: (film: TheaterFilm) => void;
  isKeeping?: boolean;
  compact?: boolean;
};

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

function TrailPosters({
  trail,
  onFilmClick,
}: {
  trail: readonly TheaterFilm[];
  onFilmClick?: (film: TheaterFilm) => void;
}) {
  if (trail.length === 0) return null;
  const shown = trail.slice(0, TRAIL_POSTER_CAP);
  const extra = trail.length - shown.length;
  return (
    <ul className="mt-3 flex items-end gap-1.5" data-testid="theater-trail">
      {shown.map((film) => (
        <li key={`${film.mediaType}-${film.id}`}>
          <button
            type="button"
            onClick={() => onFilmClick?.(film)}
            className="block overflow-hidden bg-base-3 border border-line"
            style={{ width: 40, height: 60, borderRadius: 0 }}
            title={film.title}
          >
            {posterUrl(film.posterPath) ? (
              <img src={posterUrl(film.posterPath)!} alt={film.title} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center px-0.5 text-center text-[8px] text-fg-3">
                {film.title}
              </span>
            )}
          </button>
        </li>
      ))}
      {extra > 0 && (
        <li className="font-spec text-label text-fg-2" data-testid="theater-trail-more">
          +{extra}
        </li>
      )}
    </ul>
  );
}

export default function TheaterCard({
  status,
  title,
  insight,
  trail,
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
            <TrailPosters trail={trail} onFilmClick={onFilmClick} />
            {insight && <p className="mt-3 text-body text-fg-2">{insight}</p>}

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
          </>
        )}
      </div>
    </section>
  );
}
