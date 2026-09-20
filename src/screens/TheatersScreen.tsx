import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import FacetLine from '../components/ui/FacetLine';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import SwatchStrip from '../components/ui/SwatchStrip';
import { useLibrary, watchedFilmIds } from '../lib/library';
import { theaterCardView, useTheaters, type KeptTheater, type TheaterArchiveFilm } from '../lib/theater';

const CARD_HEIGHT = 190;

const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w200${path}` : null);

function ArchiveCard({
  theater,
  watched,
  onOpen,
}: {
  theater: KeptTheater;
  watched: ReadonlySet<number>;
  onOpen: () => void;
}) {
  const view = theaterCardView(theater, watched);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={view.accessibleName}
      data-testid="theater-archive-card"
      className="w-full overflow-hidden border border-line bg-base-2 p-5 text-left"
      style={{ height: CARD_HEIGHT, borderRadius: 0 }}
    >
      <p className="font-display text-lead text-fg line-clamp-2">{view.title}</p>
      {view.facets && <FacetLine facets={view.facets} className="mt-2" />}
      <SwatchStrip swatches={view.swatches} className="mt-3" />
      <p className="mt-3 font-spec text-label tracking-widest text-fg-2" data-testid="theater-card-counts">
        {view.countLine}
      </p>
    </button>
  );
}

function LineupRow({ film, onOpen }: { film: TheaterArchiveFilm; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full min-h-11 items-start gap-3 text-left">
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
        {film.reason && <span className="block text-meta text-fg-2">{film.reason}</span>}
      </span>
    </button>
  );
}

function TheaterSheet({ theater, onClose }: { theater: KeptTheater; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="theater-sheet">
      <div className="absolute inset-0 bg-base/90" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col border border-line bg-base-2">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-title text-fg">{theater.title}</h2>
            {theater.facets && <FacetLine facets={theater.facets} className="mt-2" />}
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
          <SwatchStrip swatches={theater.swatches} />
          <p className="mt-4 text-body text-fg-2">{theater.insight}</p>
          <ul className="mt-5 flex flex-col gap-3">
            {theater.films.map((film) => (
              <li key={`${film.mediaType}-${film.id}`}>
                <LineupRow
                  film={film}
                  onOpen={() => {
                    onClose();
                    navigate(`/movie/${film.id}?type=${film.mediaType}`);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TheatersScreen() {
  const navigate = useNavigate();
  const { theaters, loading, error } = useTheaters();
  const { films } = useLibrary();
  const watched = useMemo(() => watchedFilmIds(films), [films]);
  const [selected, setSelected] = useState<KeptTheater | null>(null);

  return (
    <div className="min-h-screen bg-base text-fg" data-testid="theaters-screen">
      <div className="mx-auto max-w-md px-7 pt-8">
        <h1 data-spec className="text-label tracking-widest text-fg">THEATERS</h1>
        <p className="mt-2 font-spec text-label tracking-widest text-fg-3">FACETS YOU KEPT WALKING BACK INTO</p>

        <div className="mt-6 flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <SelectsChaseLoader size="lg" />
            </div>
          ) : error ? (
            <p className="py-16 text-center text-body text-fg-2" data-testid="theaters-error">
              The archive could not load. Try again.
            </p>
          ) : theaters.length === 0 ? (
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
            theaters.map((theater) => (
              <ArchiveCard key={theater.id} theater={theater} watched={watched} onOpen={() => setSelected(theater)} />
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
