import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import { TrailPosterRow } from '../components/TheaterCard';
import { useLibrary, watchedFilmIds } from '../lib/library';
import {
  theaterArchiveState,
  useTheaters,
  type KeptTheater,
  type TheaterArchiveFilm,
  type TheaterCardView,
} from '../lib/theater';

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

function ArchiveCard({ view, onOpen }: { view: TheaterCardView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={view.accessibleName}
      data-testid="theater-archive-card"
      className="w-full overflow-hidden border border-line bg-base-2 p-5 text-left"
      style={{ borderRadius: 0 }}
    >
      <p className="font-display text-lead text-fg line-clamp-2">{view.title}</p>
      <div className="mt-3">
        <TrailPosterRow trail={view.trail} />
      </div>
    </button>
  );
}

function TrailRow({ film, onOpen }: { film: TheaterArchiveFilm; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full min-h-11 items-center gap-3 text-left">
      <span
        className="block shrink-0 overflow-hidden border border-line bg-base-3"
        style={{ width: 40, height: 60, borderRadius: 0 }}
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
      </span>
    </button>
  );
}

function TheaterSheet({ theater, onClose }: { theater: KeptTheater; onClose: () => void }) {
  const navigate = useNavigate();
  const open = (film: TheaterArchiveFilm) => {
    onClose();
    navigate(`/movie/${film.id}?type=${film.mediaType}`);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="theater-sheet">
      <div className="absolute inset-0 bg-base/90" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col border border-line bg-base-2">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-title text-fg">{theater.title}</h2>
            <p className="mt-2 text-body text-fg-2">{theater.insight}</p>
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
          {theater.trail.length > 0 && (
            <>
              <p className="font-spec text-label uppercase tracking-widest text-fg-3">Opened</p>
              <ul className="mt-3 flex flex-col gap-3" data-testid="theater-sheet-trail">
                {theater.trail.map((film) => (
                  <li key={`${film.mediaType}-${film.id}`}>
                    <TrailRow film={film} onOpen={() => open(film)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {theater.films.length > 0 && (
            <>
              <p className="mt-6 font-spec text-label uppercase tracking-widest text-fg-3">More in this vein</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" data-testid="theater-sheet-picks">
                {theater.films.map((film) => (
                  <li key={`${film.mediaType}-${film.id}`} className="w-14 shrink-0">
                    <button type="button" onClick={() => open(film)} className="block" title={film.title}>
                      <span
                        className="block overflow-hidden border border-line bg-base-3"
                        style={{ width: 56, height: 84, borderRadius: 0 }}
                      >
                        {posterUrl(film.posterPath) ? (
                          <img src={posterUrl(film.posterPath)!} alt={film.title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center px-0.5 text-center text-[8px] text-fg-3">
                            {film.title}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-fg-3">{film.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TheatersScreen() {
  const navigate = useNavigate();
  const { theaters, loading: archiveLoading, error: archiveError } = useTheaters();
  const { films, loading: ledgerLoading } = useLibrary();
  const watched = useMemo(() => watchedFilmIds(films), [films]);
  const archive = theaterArchiveState({ theaters, archiveLoading, archiveError, ledgerLoading, watchedFilmIds: watched });
  const [selected, setSelected] = useState<KeptTheater | null>(null);

  return (
    <div className="min-h-screen bg-base text-fg" data-testid="theaters-screen">
      <div className="mx-auto max-w-md px-7 pt-8">
        <h1 data-spec className="text-label tracking-widest text-fg">THEATERS</h1>
        <p className="mt-2 font-spec text-label tracking-widest text-fg-3">PATTERNS YOU KEPT WALKING BACK INTO</p>

        <div className="mt-6 flex flex-col gap-3">
          {archive.status === 'loading' ? (
            <div className="flex justify-center py-16">
              <SelectsChaseLoader size="lg" />
            </div>
          ) : archive.status === 'error' ? (
            <p className="py-16 text-center text-body text-fg-2" data-testid="theaters-error">
              The archive could not load. Try again.
            </p>
          ) : archive.status === 'empty' ? (
            <div className="py-16" data-testid="theaters-empty">
              <p className="font-display text-lead text-fg">Nothing kept yet.</p>
              <p className="mt-2 text-body text-fg-2">
                Hunt a few films. When a Theater forms, keep it and it lands here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/discover')}
                className="mt-5 flex min-h-11 items-center justify-center bg-fg px-5 font-spec text-label tracking-widest text-base"
                style={{ borderRadius: 0 }}
              >
                START HUNTING
              </button>
            </div>
          ) : (
            archive.rows.map(({ theater, card }) => (
              <ArchiveCard key={theater.id} view={card} onOpen={() => setSelected(theater)} />
            ))
          )}
        </div>

        <p className="py-8 font-spec text-label text-fg-3" data-testid="theater-archive-footer">
          A THEATER IS WHAT A TRAIL BECOMES WHEN YOU KEEP IT
        </p>
      </div>

      {selected && <TheaterSheet theater={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
