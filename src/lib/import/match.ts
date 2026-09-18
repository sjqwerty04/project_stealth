import type { MediaType } from '../library/types';
import { filmKey } from './letterboxd/parse';

export type MatchedFilm = {
  movieId: number;
  title: string;
  year: string;
  poster: string;
  backdrop?: string;
  runtime?: string;
  mediaType: MediaType;
};

export type MatchResult = {
  matched: Map<string, MatchedFilm>;
  unresolved: Array<{ title: string; year?: string; reason: 'not_found' | 'year_mismatch' | 'error' }>;
};

export type Lookup = (title: string, year?: string, imdbId?: string) => Promise<MatchedFilm | null>;

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_API_KEY = !TMDB_KEY || TMDB_KEY.includes('your_tmdb') ? '' : TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

function image(path: string | null | undefined, size: 'w500' | 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

async function lookupViaApi(title: string, year?: string): Promise<MatchedFilm | null> {
  const params = new URLSearchParams({ title });
  if (year) params.set('year', year);
  try {
    const res = await fetch(`/api/movie-lookup?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id) return null;
    return {
      movieId: data.id,
      title: data.title || title,
      year: String(data.year || year || ''),
      poster: data.poster || '',
      backdrop: data.backdrop || data.still || undefined,
      runtime: data.runtime || undefined,
      mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
    };
  } catch {
    return null;
  }
}

async function lookupViaImdb(imdbId: string): Promise<MatchedFilm | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const res = await fetch(`${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.movie_results?.[0] ?? data.tv_results?.[0];
    if (!hit?.id) return null;
    return {
      movieId: hit.id,
      title: hit.title || hit.name,
      year: String((hit.release_date || hit.first_air_date || '').slice(0, 4)),
      poster: image(hit.poster_path, 'w500'),
      backdrop: image(hit.backdrop_path, 'w780') || undefined,
      mediaType: data.movie_results?.[0] ? 'movie' : 'tv',
    };
  } catch {
    return null;
  }
}

async function lookupViaTmdb(title: string, year?: string): Promise<MatchedFilm | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const url = new URL(`${TMDB_BASE}/search/movie`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('query', title);
    if (year) url.searchParams.set('year', year);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit?.id) return null;
    return {
      movieId: hit.id,
      title: hit.title,
      year: String((hit.release_date || '').slice(0, 4)),
      poster: image(hit.poster_path, 'w500'),
      backdrop: image(hit.backdrop_path, 'w780') || undefined,
      mediaType: 'movie',
    };
  } catch {
    return null;
  }
}

/** Default lookup: IMDb id when present, then the serverless proxy, then the client TMDB key. */
export const defaultLookup: Lookup = async (title, year, imdbId) => {
  if (imdbId) {
    const byId = await lookupViaImdb(imdbId);
    if (byId) return byId;
  }
  return (await lookupViaApi(title, year)) ?? (await lookupViaTmdb(title, year));
};

const cache = new Map<string, MatchedFilm | null>();

function yearOk(wanted?: string, got?: string): boolean {
  if (!wanted || !got) return true;
  const a = Number(wanted);
  const b = Number(got);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) <= 1;
}

export type MatchInput = { title: string; year?: string; imdbId?: string };

/**
 * Match titles to TMDB with a small concurrency pool. A hit whose year is more than one
 * off the requested year is treated as unresolved rather than guessed.
 */
export async function matchFilms(
  inputs: MatchInput[],
  opts: { lookup?: Lookup; concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<MatchResult> {
  const lookup = opts.lookup ?? defaultLookup;
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const unique = new Map<string, MatchInput>();
  for (const input of inputs) {
    const key = filmKey(input.title, input.year);
    if (!unique.has(key)) unique.set(key, input);
  }
  const keys = Array.from(unique.keys());
  const matched = new Map<string, MatchedFilm>();
  const unresolved: MatchResult['unresolved'] = [];
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < keys.length) {
      const key = keys[cursor++];
      const input = unique.get(key)!;
      try {
        let hit = cache.get(key);
        if (hit === undefined) {
          hit = await lookup(input.title, input.year, input.imdbId);
          cache.set(key, hit);
        }
        if (!hit) unresolved.push({ title: input.title, year: input.year, reason: 'not_found' });
        else if (!input.imdbId && !yearOk(input.year, hit.year)) unresolved.push({ title: input.title, year: input.year, reason: 'year_mismatch' });
        else matched.set(key, hit);
      } catch {
        unresolved.push({ title: input.title, year: input.year, reason: 'error' });
      }
      done++;
      opts.onProgress?.(done, keys.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
  return { matched, unresolved };
}

export function resetMatchCacheForTesting() {
  cache.clear();
}
