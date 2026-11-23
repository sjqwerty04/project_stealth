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
    <div className="flex gap-2 overflow-x-auto">
      {rows.map((film) => {
        const body = (
          <>
            {film.poster ? (
              <img src={film.poster} alt="" className="h-28 w-[72px] object-cover" />
            ) : (
              <span className="grid h-28 w-[72px] place-items-center bg-base-3 font-spec text-[10px] uppercase text-fg-3">Film</span>
            )}
            <span className="max-w-[72px] font-spec text-[10px] uppercase leading-tight tracking-widest">{film.title}</span>
          </>
        );
        if (film.movieId) {
          return (
            <button
              key={film.title}
              type="button"
              onClick={() => onOpen(film.movieId as number, film.mediaType)}
              className="inline-flex min-h-11 shrink-0 flex-col items-start gap-1.5 text-left text-fg"
            >
              {body}
            </button>
          );
        }
        return (
          <span key={film.title} className="inline-flex min-h-11 shrink-0 flex-col items-start gap-1.5 text-fg">
            {body}
          </span>
        );
      })}
    </div>
  );
}
