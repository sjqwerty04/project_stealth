const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
const BASE = 'https://api.themoviedb.org/3';

export async function tmdb<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!TMDB_KEY) return null;
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type TmdbFilm = { id: number; title: string; year?: string; posterPath: string | null };
export type TmdbPerson = { id: number; name: string; profilePath: string | null };

export type RawTmdb = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  profile_path?: string | null;
};

export function toFilm(r: RawTmdb | undefined): TmdbFilm | null {
  const title = r?.title || r?.name;
  if (!r?.id || !title) return null;
  const year = (r.release_date || r.first_air_date || '').slice(0, 4) || undefined;
  return { id: r.id, title, year, posterPath: r.poster_path ?? null };
}

export async function searchFilm(title: string, year?: string): Promise<TmdbFilm | null> {
  const data = await tmdb<{ results: RawTmdb[] }>('/search/movie', { query: title, year: year || '' });
  const exact = data?.results?.find((r) => (r.title || '').toLowerCase() === title.toLowerCase());
  return toFilm(exact || data?.results?.[0]);
}

export async function searchPerson(name: string): Promise<TmdbPerson | null> {
  const data = await tmdb<{ results: RawTmdb[] }>('/search/person', { query: name });
  const hit = data?.results?.[0];
  return hit?.id && hit.name ? { id: hit.id, name: hit.name, profilePath: hit.profile_path ?? null } : null;
}
