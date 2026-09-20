import {
  FALLBACK_SWATCHES,
  filmIdentity,
  finiteNumber,
  isRecord,
  nonEmptyString,
  parseFacets,
  parseSwatches,
  timestampMillis,
  type MediaType,
  type Swatches,
} from './types';

export type TheaterArchiveFilm = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  mediaType: MediaType;
  reason: string;
};

export type KeptTheater = {
  id: string;
  title: string;
  facets: [string, string] | null;
  insight: string;
  swatches: Swatches;
  films: TheaterArchiveFilm[];
  keptAt: number;
};

export type TheaterCardView = {
  id: string;
  title: string;
  facets: [string, string] | null;
  swatches: Swatches;
  filmCount: number;
  unseenCount: number;
  countLine: string;
  accessibleName: string;
};

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseArchiveFilm(raw: unknown): TheaterArchiveFilm | null {
  if (!isRecord(raw) || !finiteNumber(raw.id) || !nonEmptyString(raw.title)) return null;
  return {
    id: raw.id,
    title: raw.title,
    year: typeof raw.year === 'number' ? String(raw.year) : optionalString(raw.year),
    posterPath: typeof raw.posterPath === 'string' ? raw.posterPath : null,
    mediaType: raw.mediaType === 'tv' ? 'tv' : 'movie',
    reason: optionalString(raw.reason),
  };
}

function parseFilmList(raw: unknown): TheaterArchiveFilm[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseArchiveFilm).filter((film): film is TheaterArchiveFilm => film !== null);
}

/**
 * Firestore boundary. A canonical document keeps its facets, swatches, and per-film reasons.
 * A legacy document names itself with `pattern`, carries no facets, and leaves every reason blank.
 */
export function parseTheaterDoc(id: string, raw: unknown): KeptTheater | null {
  if (!isRecord(raw)) return null;
  const title = nonEmptyString(raw.title) ? raw.title.trim() : nonEmptyString(raw.pattern) ? raw.pattern.trim() : null;
  if (!title) return null;
  const films = Array.isArray(raw.lineup) ? parseFilmList(raw.lineup) : parseFilmList(raw.movies);
  return {
    id,
    title,
    facets: parseFacets(raw.facets),
    insight: nonEmptyString(raw.insight) ? raw.insight.trim() : title,
    swatches: parseSwatches(raw.swatches) ?? FALLBACK_SWATCHES,
    films,
    keptAt: timestampMillis(raw.keptAt) ?? timestampMillis(raw.createdAt) ?? 0,
  };
}

export type TheaterReasonRow = TheaterArchiveFilm & { swatch: string };

export type FilmTheaterSection = {
  theaterId: string;
  kicker: string;
  rows: TheaterReasonRow[];
};

export function filmTheaterSection(
  theaters: readonly KeptTheater[],
  film: { id: number; mediaType: MediaType },
): FilmTheaterSection | null {
  const identity = filmIdentity(film);
  const holding = theaters.filter((theater) => theater.films.some((entry) => filmIdentity(entry) === identity));
  if (holding.length === 0) return null;
  const newest = holding.reduce((best, theater) => (theater.keptAt > best.keptAt ? theater : best));
  const rows = newest.films
    .filter((entry) => filmIdentity(entry) !== identity)
    .map((entry, index) => ({ ...entry, swatch: newest.swatches[index % newest.swatches.length] }));
  if (rows.length === 0) return null;
  return { theaterId: newest.id, kicker: newest.title.toUpperCase(), rows };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function theaterCardView(theater: KeptTheater, watchedFilmIds: ReadonlySet<number>): TheaterCardView {
  const filmIds = new Set(theater.films.map((film) => film.id));
  const filmCount = filmIds.size;
  let unseenCount = 0;
  for (const filmId of filmIds) if (!watchedFilmIds.has(filmId)) unseenCount += 1;
  const spoken = `${filmCount} ${plural(filmCount, 'film', 'films')}, ${unseenCount} unseen.`;
  return {
    id: theater.id,
    title: theater.title,
    facets: theater.facets,
    swatches: theater.swatches,
    filmCount,
    unseenCount,
    countLine: `${filmCount} ${plural(filmCount, 'FILM', 'FILMS')} · ${unseenCount} UNSEEN`,
    accessibleName: theater.facets
      ? `${theater.title}. ${theater.facets[0]} and ${theater.facets[1]}. ${spoken}`
      : `${theater.title}. ${spoken}`,
  };
}
