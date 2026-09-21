import {
  FALLBACK_SWATCHES,
  TRAIL_POSTER_CAP,
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
  trail: TheaterArchiveFilm[];
  keptAt: number;
};

export type TheaterCardView = {
  id: string;
  title: string;
  trail: TheaterArchiveFilm[];
  extraCount: number;
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

function trailFromSignals(raw: unknown): TheaterArchiveFilm[] {
  if (!Array.isArray(raw)) return [];
  const trail: TheaterArchiveFilm[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || item.kind !== 'detail_view') continue;
    const film = parseArchiveFilm(item.film);
    if (!film) continue;
    const key = `${film.mediaType}:${film.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    trail.push(film);
  }
  return trail;
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
  const trail = trailFromSignals(raw.sourceSignals);
  return {
    id,
    title,
    facets: parseFacets(raw.facets),
    insight: nonEmptyString(raw.insight) ? raw.insight.trim() : title,
    swatches: parseSwatches(raw.swatches) ?? FALLBACK_SWATCHES,
    films,
    trail: trail.length > 0 ? trail : films,
    keptAt: timestampMillis(raw.keptAt) ?? timestampMillis(raw.createdAt) ?? 0,
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export type TheaterArchiveRow = { theater: KeptTheater; card: TheaterCardView };

export type TheaterArchiveState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; rows: TheaterArchiveRow[] };

export type TheaterArchiveSources = {
  theaters: readonly KeptTheater[];
  archiveLoading: boolean;
  archiveError: string | null;
  ledgerLoading: boolean;
  watchedFilmIds: ReadonlySet<number>;
};

export function theaterArchiveState(sources: TheaterArchiveSources): TheaterArchiveState {
  if (sources.archiveError) return { status: 'error' };
  if (sources.archiveLoading || sources.ledgerLoading) return { status: 'loading' };
  if (sources.theaters.length === 0) return { status: 'empty' };
  return {
    status: 'ready',
    rows: sources.theaters.map((theater) => ({
      theater,
      card: theaterCardView(theater, sources.watchedFilmIds),
    })),
  };
}

export function theaterCardView(theater: KeptTheater, watchedFilmIds: ReadonlySet<number>): TheaterCardView {
  const posters = theater.trail.length > 0 ? theater.trail : theater.films;
  const filmIds = new Set(posters.map((film) => film.id));
  const filmCount = filmIds.size;
  let unseenCount = 0;
  for (const filmId of filmIds) if (!watchedFilmIds.has(filmId)) unseenCount += 1;
  const spoken = `${filmCount} ${plural(filmCount, 'film', 'films')}, ${unseenCount} unseen.`;
  return {
    id: theater.id,
    title: theater.title,
    trail: posters,
    extraCount: Math.max(0, posters.length - TRAIL_POSTER_CAP),
    filmCount,
    unseenCount,
    countLine: `${filmCount} ${plural(filmCount, 'FILM', 'FILMS')} · ${unseenCount} UNSEEN`,
    accessibleName: `${theater.title}. ${spoken}`,
  };
}
