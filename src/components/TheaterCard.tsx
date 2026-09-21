import { useEffect, useId, useState } from 'react';
import { Info, X } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import { THEATER_INFO, TRAIL_POSTER_CAP, type TheaterFilm, type TheaterLineupItem } from '../lib/theater';

type TheaterCardProps = {
  status: 'inferring' | 'showing' | 'kept';
  title: string | null;
  insight: string | null;
  trail: readonly TheaterFilm[];
  picks?: readonly TheaterLineupItem[];
  onKeep: () => void;
  onDismiss: () => void;
  onFilmClick?: (film: TrailPosterFilm) => void;
  isKeeping?: boolean;
  compact?: boolean;
};

type TrailPosterFilm = {
  id: number;
  title: string;
  posterPath: string | null;
  mediaType: 'movie' | 'tv';
};

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

function PosterTile({
  film,
  size,
  onClick,
}: {
  film: TrailPosterFilm;
  size: 'sm' | 'md';
  onClick?: (film: TrailPosterFilm) => void;
}) {
  const width = size === 'sm' ? 40 : 56;
  const height = size === 'sm' ? 60 : 84;
  const src = posterUrl(film.posterPath);
  return (
    <button
      type="button"
      onClick={() => onClick?.(film)}
      className="block overflow-hidden bg-base-3 border border-line"
      style={{ width, height, borderRadius: 0 }}
      title={film.title}
    >
      {src ? (
        <img src={src} alt={film.title} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center px-0.5 text-center text-[8px] text-fg-3">{film.title}</span>
      )}
    </button>
  );
}

export function TrailPosterRow({
  trail,
  cap = TRAIL_POSTER_CAP,
  onFilmClick,
  testId = 'theater-trail',
}: {
  trail: readonly TrailPosterFilm[];
  cap?: number;
  onFilmClick?: (film: TrailPosterFilm) => void;
  testId?: string;
}) {
  if (trail.length === 0) return null;
  const shown = trail.slice(0, cap);
  const extra = trail.length - shown.length;
  return (
    <ul className="flex items-end gap-1.5 overflow-x-auto" data-testid={testId}>
      {shown.map((film) => (
        <li key={`${film.mediaType}-${film.id}`} className="shrink-0">
          <PosterTile film={film} size="sm" onClick={onFilmClick} />
        </li>
      ))}
      {extra > 0 && (
        <li className="font-spec text-label text-fg-2" data-testid={`${testId}-more`}>
          +{extra}
        </li>
      )}
    </ul>
  );
}

function SessionSheet({
  insight,
  trail,
  picks,
  kept,
  isKeeping,
  onKeep,
  onClose,
  onFilmClick,
}: {
  insight: string | null;
  trail: readonly TheaterFilm[];
  picks: readonly TheaterLineupItem[];
  kept: boolean;
  isKeeping: boolean;
  onKeep: () => void;
  onClose: () => void;
  onFilmClick?: (film: TrailPosterFilm) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="theater-session-sheet">
      <div className="absolute inset-0 bg-base/90" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col border border-line bg-base-2">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <p className="font-spec text-label uppercase tracking-widest text-fg-2">Your Theater</p>
            {insight && <p className="mt-2 text-body text-fg-2">{insight}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Theater"
            className="flex min-h-11 min-w-11 items-center justify-center text-fg-2 hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {trail.length > 0 && (
            <>
              <p className="font-spec text-label uppercase tracking-widest text-fg-3">Opened</p>
              <ul className="mt-3 flex flex-col gap-3" data-testid="theater-sheet-trail">
                {trail.map((film) => (
                  <li key={`${film.mediaType}-${film.id}`}>
                    <button type="button" onClick={() => onFilmClick?.(film)} className="flex w-full min-h-11 items-center gap-3 text-left">
                      <PosterTile film={film} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-body text-fg">{film.title}</span>
                        {film.year && <span className="font-spec text-label text-fg-2">{film.year}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {picks.length > 0 && (
            <>
              <p className="mt-6 font-spec text-label uppercase tracking-widest text-fg-3">More in this vein</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" data-testid="theater-sheet-picks">
                {picks.map((film) => (
                  <li key={`${film.mediaType}-${film.id}`} className="w-14 shrink-0">
                    <PosterTile film={film} size="md" onClick={onFilmClick} />
                    <p className="mt-1 truncate text-[10px] text-fg-3">{film.title}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!kept && (
            <button
              type="button"
              onClick={onKeep}
              disabled={isKeeping}
              data-testid="theater-sheet-keep"
              className="mt-6 flex min-h-11 w-full items-center justify-center bg-fg px-4 font-spec text-label uppercase tracking-widest text-base disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderRadius: 0 }}
            >
              {isKeeping ? <SelectsChaseLoader size="xs" activeColor="#0A0A0B" idleColor="#7C7A76" /> : 'Save Theater'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TheaterCard({
  status,
  insight,
  trail,
  picks = [],
  onKeep,
  onDismiss,
  onFilmClick,
  isKeeping = false,
  compact = false,
}: TheaterCardProps) {
  const kept = status === 'kept';
  const ready = status !== 'inferring';
  const [infoOpen, setInfoOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const infoId = useId();

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInfoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoOpen]);

  return (
    <>
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
          <div className="flex items-center justify-between gap-3">
            <p className="font-spec text-label uppercase tracking-widest text-fg-2">Trend found</p>
            <div className="flex items-center gap-1">
              <p className="font-spec text-label uppercase tracking-widest text-fg-2">Your Theater</p>
              <button
                type="button"
                aria-label="About Your Theater"
                aria-expanded={infoOpen}
                aria-controls={infoId}
                data-testid="theater-info"
                onClick={() => setInfoOpen((open) => !open)}
                className="flex min-h-11 min-w-11 items-center justify-center text-fg-2 hover:text-fg"
              >
                <Info size={14} />
              </button>
            </div>
          </div>

          {infoOpen && (
            <p id={infoId} className="mt-3 text-meta text-fg-2" data-testid="theater-info-copy">
              {THEATER_INFO}
            </p>
          )}

          {status === 'inferring' ? (
            <div className="mt-3 flex items-center gap-3" data-testid="theater-inferring">
              <SelectsChaseLoader size={compact ? 'xs' : 'sm'} />
              <span className="font-spec text-label uppercase tracking-widest text-fg-2">Reading your trail</span>
            </div>
          ) : (
            <>
              <div className="mt-3">
                <TrailPosterRow trail={trail} onFilmClick={onFilmClick} />
              </div>
              {insight && <p className="mt-3 text-body text-fg-2">{insight}</p>}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onKeep}
                  disabled={isKeeping || kept}
                  data-testid="theater-keep"
                  className={`flex min-h-11 flex-1 items-center justify-center px-4 font-spec text-label uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                    kept ? 'border border-line bg-base-3 text-fg-2' : 'bg-fg text-base disabled:opacity-40'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {isKeeping ? <SelectsChaseLoader size="xs" activeColor="#0A0A0B" idleColor="#7C7A76" /> : kept ? 'Saved' : 'Save Theater'}
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  data-testid="theater-see-more"
                  className="flex min-h-11 items-center justify-center border border-line px-4 font-spec text-label uppercase tracking-widest text-fg"
                  style={{ borderRadius: 0 }}
                >
                  See more
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {sheetOpen && ready && (
        <SessionSheet
          insight={insight}
          trail={trail}
          picks={picks}
          kept={kept}
          isKeeping={isKeeping}
          onKeep={onKeep}
          onClose={() => setSheetOpen(false)}
          onFilmClick={onFilmClick}
        />
      )}
    </>
  );
}
