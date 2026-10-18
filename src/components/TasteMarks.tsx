import type { ProfileFilm } from '../hooks/useProfileFilms';
import type { TasteSnapshot } from '../lib/taste/types';

export function knownTasteFilms(profileFilms: ProfileFilm[], snapshot: TasteSnapshot): ProfileFilm[] {
  const map = new Map<string, ProfileFilm>();
  for (const film of profileFilms) map.set(film.title.toLowerCase(), film);
  for (const pick of snapshot.generated.lastPicks) {
    const key = pick.title.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        title: pick.title,
        poster: pick.poster || undefined,
        movieId: pick.movieId,
        mediaType: pick.mediaType ?? 'movie',
      });
    }
  }
  for (const row of snapshot.context.history) {
    const key = row.item.toLowerCase();
    if (map.has(key)) continue;
    const id = row.id ? Number(row.id) : NaN;
    map.set(key, {
      title: row.item,
      ...(Number.isFinite(id) ? { movieId: id, mediaType: 'movie' as const } : {}),
    });
  }
  return [...map.values()];
}

export function filmsForMarks(
  titles: string[],
  known: ProfileFilm[],
): Array<ProfileFilm & { title: string }> {
  return titles.map((title) => {
    const hit = known.find((film) => film.title.toLowerCase() === title.toLowerCase());
    return hit ? { ...hit, title } : { title };
  });
}

export default function TasteMarks({
  titles,
  films,
  onOpen,
}: {
  titles: string[];
  films: ProfileFilm[];
  onOpen: (movieId: number, mediaType?: string) => void;
}) {
  if (!titles.length) return null;
  const rows = filmsForMarks(titles, films);
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((film) => {
        const body = (
          <>
            {film.poster ? (
              <img src={film.poster} alt="" className="h-8 w-6 object-cover" />
            ) : null}
            <span className="font-spec text-[10px] uppercase tracking-widest">{film.title}</span>
          </>
        );
        if (film.movieId) {
          return (
            <button
              key={film.title}
              type="button"
              onClick={() => onOpen(film.movieId as number, film.mediaType)}
              className="inline-flex items-center gap-1.5 min-h-11 border border-line px-2 text-fg"
            >
              {body}
            </button>
          );
        }
        return (
          <span key={film.title} className="inline-flex items-center gap-1.5 min-h-11 border border-line px-2 text-fg">
            {body}
          </span>
        );
      })}
    </div>
  );
}
