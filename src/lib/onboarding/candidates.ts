import type { FilmPick } from './state';

export type Candidate = FilmPick & { genreIds: number[]; voteCount: number; popularity: number };

const TMDB_BASE = 'https://api.themoviedb.org/3';
const MAX_CANDIDATES = 12;

function tmdbKey(): string {
  return (import.meta.env?.VITE_TMDB_API_KEY as string | undefined) ?? '';
}

type TmdbLike = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  poster_path?: unknown;
  genre_ids?: unknown;
  genres?: unknown;
  vote_count?: unknown;
  popularity?: unknown;
};

export function tmdbResultToFilm(r: unknown): Candidate {
  const o = (r ?? {}) as TmdbLike;
  const date = typeof o.release_date === 'string' ? o.release_date : typeof o.first_air_date === 'string' ? o.first_air_date : '';
  const genreIds = Array.isArray(o.genre_ids)
    ? o.genre_ids.filter((g): g is number => typeof g === 'number')
    : Array.isArray(o.genres)
      ? o.genres.map((g) => (g as { id?: unknown })?.id).filter((g): g is number => typeof g === 'number')
      : [];
  return {
    id: typeof o.id === 'number' ? o.id : Number(o.id) || 0,
    title: typeof o.title === 'string' ? o.title : typeof o.name === 'string' ? o.name : 'Unknown',
    year: date.slice(0, 4),
    posterPath: typeof o.poster_path === 'string' ? o.poster_path : null,
    genreIds,
    voteCount: typeof o.vote_count === 'number' ? o.vote_count : 0,
    popularity: typeof o.popularity === 'number' ? o.popularity : 0,
  };
}

function decadeOf(year: string): number | null {
  const y = Number(year);
  return Number.isFinite(y) && y > 0 ? Math.floor(y / 10) * 10 : null;
}

/** Shared genre count plus decade proximity; the raw signals behind rankCandidates. */
export function facetOverlap(a: FilmPick, b: FilmPick): { sharedGenres: number; sameDecade: boolean; nearDecade: boolean } {
  const ag = new Set(a.genreIds ?? []);
  const sharedGenres = (b.genreIds ?? []).filter((g) => ag.has(g)).length;
  const da = decadeOf(a.year);
  const db = decadeOf(b.year);
  const sameDecade = da !== null && db !== null && da === db;
  const nearDecade = da !== null && db !== null && Math.abs(da - db) <= 10;
  return { sharedGenres, sameDecade, nearDecade };
}

export function scoreCandidate(pick: FilmPick, c: Candidate): number {
  const { sharedGenres, sameDecade, nearDecade } = facetOverlap(pick, c);
  return 3 * sharedGenres + (sameDecade ? 2 : 0) + (nearDecade ? 1 : 0) + Math.log10(c.voteCount + 1) * 0.5;
}

export function rankCandidates(pick: FilmPick, pool: Candidate[], excludeIds: Set<number>): Candidate[] {
  const seen = new Set<number>();
  const scored: { c: Candidate; score: number }[] = [];
  for (const c of pool) {
    if (c.id === pick.id || excludeIds.has(c.id) || !c.posterPath || seen.has(c.id)) continue;
    seen.add(c.id);
    scored.push({ c, score: scoreCandidate(pick, c) });
  }
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.c.id - b.c.id));
  return scored.map((s) => s.c);
}

const poolCache = new Map<number, Promise<Candidate[]>>();
const detailCache = new Map<number, Promise<number[]>>();

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

function resultsOf(data: unknown): unknown[] {
  const results = (data as { results?: unknown })?.results;
  return Array.isArray(results) ? results : [];
}

async function fetchGenreIds(id: number, fetchImpl: typeof fetch): Promise<number[]> {
  let p = detailCache.get(id);
  if (!p) {
    p = fetchJson(fetchImpl, `${TMDB_BASE}/movie/${id}?api_key=${tmdbKey()}&language=en-US`).then(
      (d) => tmdbResultToFilm(d).genreIds,
    );
    detailCache.set(id, p);
    p.catch(() => detailCache.delete(id));
  }
  return p;
}

async function fetchPool(id: number, fetchImpl: typeof fetch): Promise<Candidate[]> {
  let p = poolCache.get(id);
  if (!p) {
    const key = tmdbKey();
    p = Promise.all([
      fetchJson(fetchImpl, `${TMDB_BASE}/movie/${id}/recommendations?api_key=${key}&language=en-US&page=1`),
      fetchJson(fetchImpl, `${TMDB_BASE}/movie/${id}/similar?api_key=${key}&language=en-US&page=1`),
    ]).then(([rec, sim]) => {
      const byId = new Map<number, Candidate>();
      for (const r of [...resultsOf(rec), ...resultsOf(sim)]) {
        const c = tmdbResultToFilm(r);
        if (c.id && !byId.has(c.id)) byId.set(c.id, c);
      }
      return [...byId.values()];
    });
    poolCache.set(id, p);
    // Do not cache failures so a later pick of the same film can retry.
    p.catch(() => poolCache.delete(id));
  }
  return p;
}

export async function getCandidates(
  pick: FilmPick,
  excludeIds: Set<number>,
  fetchImpl: typeof fetch = fetch,
): Promise<FilmPick[]> {
  try {
    const [pool, genreIds] = await Promise.all([
      fetchPool(pick.id, fetchImpl),
      pick.genreIds && pick.genreIds.length ? Promise.resolve(pick.genreIds) : fetchGenreIds(pick.id, fetchImpl).catch(() => []),
    ]);
    const enriched: FilmPick = { ...pick, genreIds };
    return rankCandidates(enriched, pool, excludeIds)
      .slice(0, MAX_CANDIDATES)
      .map(({ id, title, year, posterPath, genreIds: g }) => ({ id, title, year, posterPath, genreIds: g }));
  } catch {
    return [];
  }
}

/** Test hook; clears the module caches. */
export function clearCandidateCache() {
  poolCache.clear();
  detailCache.clear();
}
