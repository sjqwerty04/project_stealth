/**
 * The single TMDB adapter.
 *
 * Before this existed the codebase had eleven hand-rolled image URL builders,
 * eight copies of `searchTMDB`, two genre maps and fourteen files calling the API
 * directly — which meant a fix to any of them fixed one caller.
 */

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

export const TMDB_BASE = 'https://api.themoviedb.org/3';

const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const hasTmdbKey = (): boolean => Boolean(TMDB_API_KEY);

export type PosterSize = 'w92' | 'w185' | 'w200' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

const POSTER_PLACEHOLDER = 'https://placehold.co/200x300?text=Movie';

/**
 * Builds a TMDB image URL, falling back to a placeholder so callers never render
 * a broken <img>. Pass `null` as the fallback when the caller wants to branch on
 * absence itself.
 */
export function buildImageUrl(
  path: string | null | undefined,
  size: PosterSize = 'w200',
  fallback: string | null = POSTER_PLACEHOLDER
): string {
  if (!path) return fallback as string;
  return `${IMAGE_BASE}/${size}${path}`;
}

/** Same as buildImageUrl but returns null rather than a placeholder. */
export function imageUrlOrNull(
  path: string | null | undefined,
  size: PosterSize = 'w200'
): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const genreNames = (ids: number[] | undefined | null): string[] =>
  (ids || []).map((id) => GENRE_MAP[id]).filter(Boolean);

export function formatRuntime(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return 'Feature';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export type MediaType = 'movie' | 'tv';

/** The shape every screen agrees on. Adapters below normalise TMDB into this. */
export type Movie = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  genreIds: number[];
  mediaType: MediaType;
  voteAverage: number;
  runtimeMinutes: number | null;
};

type TmdbUrlParams = Record<string, string | number | boolean | undefined>;

function tmdbUrl(path: string, params: TmdbUrlParams = {}): string {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function tmdbFetch<T>(path: string, params?: TmdbUrlParams, signal?: AbortSignal): Promise<T | null> {
  if (!TMDB_API_KEY) {
    console.error('TMDB request skipped: VITE_TMDB_API_KEY is not configured');
    return null;
  }

  try {
    const response = await fetch(tmdbUrl(path, params), { signal });
    if (!response.ok) {
      console.error('TMDB request failed:', response.status, path);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return null;
    console.error('TMDB request threw:', path, error);
    return null;
  }
}

/** Raw TMDB result, kept loose because the API returns different shapes per endpoint. */
type TmdbRaw = Record<string, any>;

export function normalizeMovie(raw: TmdbRaw, mediaType: MediaType = 'movie'): Movie {
  const title = raw.title || raw.name || 'Untitled';
  const date = raw.release_date || raw.first_air_date || '';

  return {
    id: raw.id,
    title,
    year: date ? String(date).slice(0, 4) : '',
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    overview: raw.overview || '',
    genreIds: raw.genre_ids || (raw.genres || []).map((g: TmdbRaw) => g.id) || [],
    mediaType,
    voteAverage: raw.vote_average ?? 0,
    runtimeMinutes: raw.runtime ?? null,
  };
}

/**
 * Resolves a title to a TMDB record. Retries without the year because the model
 * and Letterboxd frequently disagree with TMDB by a year on release dates.
 */
export async function searchMovie(
  title: string,
  year?: string | number,
  signal?: AbortSignal
): Promise<TmdbRaw | null> {
  if (!title) return null;

  const withYear = await tmdbFetch<{ results?: TmdbRaw[] }>(
    '/search/movie',
    { query: title, year },
    signal
  );
  if (withYear?.results?.length) return withYear.results[0];

  if (!year) return null;

  const withoutYear = await tmdbFetch<{ results?: TmdbRaw[] }>(
    '/search/movie',
    { query: title },
    signal
  );
  return withoutYear?.results?.[0] ?? null;
}

export async function searchMulti(
  query: string,
  page = 1,
  mediaType: MediaType = 'movie',
  signal?: AbortSignal
): Promise<TmdbRaw[]> {
  const endpoint = mediaType === 'tv' ? '/search/tv' : '/search/movie';
  const data = await tmdbFetch<{ results?: TmdbRaw[] }>(
    endpoint,
    { query, page, include_adult: false },
    signal
  );
  return data?.results ?? [];
}

export async function getMovie(
  id: number,
  options: { credits?: boolean; mediaType?: MediaType } = {},
  signal?: AbortSignal
): Promise<TmdbRaw | null> {
  const endpoint = options.mediaType === 'tv' ? 'tv' : 'movie';
  return tmdbFetch<TmdbRaw>(
    `/${endpoint}/${id}`,
    options.credits ? { append_to_response: 'credits' } : {},
    signal
  );
}

export function directorOf(details: TmdbRaw | null | undefined): string | undefined {
  return details?.credits?.crew?.find((c: TmdbRaw) => c.job === 'Director')?.name;
}

export async function getTrending(
  window: 'day' | 'week' = 'week',
  signal?: AbortSignal
): Promise<TmdbRaw[]> {
  const data = await tmdbFetch<{ results?: TmdbRaw[] }>(`/trending/movie/${window}`, {}, signal);
  return data?.results ?? [];
}
