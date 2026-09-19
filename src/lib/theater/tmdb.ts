import { hydratedTitleMatchesPick } from '../taste/selectPickCoherence';
import { finiteNumber, isRecord, nonEmptyString, parseTheaterFilm, type TheaterFilm, type TheaterPick } from './types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export type TheaterFetch = (url: string) => Promise<Response>;

export type TmdbDeps = { apiKey: string; fetch: TheaterFetch };

export type TheaterFilmSearch = (pick: TheaterPick) => Promise<TheaterFilm | null>;

function tmdbUrl(deps: TmdbDeps, path: string, params: Record<string, string>): string {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', deps.apiKey);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function getJson(deps: TmdbDeps, path: string, params: Record<string, string>): Promise<unknown> {
  const response = await deps.fetch(tmdbUrl(deps, path, params));
  if (!response.ok) return null;
  return response.json();
}

function firstSearchResult(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return null;
  const [hit] = payload.results;
  return isRecord(hit) ? hit : null;
}

function yearOf(raw: unknown): string {
  return typeof raw === 'string' ? raw.slice(0, 4) : '';
}

function stringOrNull(raw: unknown): string | null {
  return nonEmptyString(raw) ? raw : null;
}

function genreNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((genre) => (isRecord(genre) && nonEmptyString(genre.name) ? [genre.name] : []));
}

function directorOf(credits: unknown): string | null {
  if (!isRecord(credits) || !Array.isArray(credits.crew)) return null;
  const director = credits.crew.find((member) => isRecord(member) && member.job === 'Director');
  return isRecord(director) ? stringOrNull(director.name) : null;
}

function parseTmdbFilm(raw: Record<string, unknown>, extra: { genres: string[]; director: string | null }): TheaterFilm | null {
  return parseTheaterFilm({
    id: raw.id,
    title: raw.title,
    year: yearOf(raw.release_date),
    posterPath: stringOrNull(raw.poster_path),
    backdropPath: stringOrNull(raw.backdrop_path),
    genres: extra.genres,
    director: extra.director,
    mediaType: 'movie',
  });
}

export function tmdbTheaterSearch(deps: TmdbDeps): TheaterFilmSearch {
  return async (pick) => {
    const withYear = firstSearchResult(await getJson(deps, '/search/movie', { query: pick.title, year: pick.year }));
    const hit = withYear ?? firstSearchResult(await getJson(deps, '/search/movie', { query: pick.title }));
    if (!hit) return null;
    const candidate = parseTmdbFilm(hit, { genres: [], director: null });
    if (!candidate || !hydratedTitleMatchesPick(pick.title, candidate.title)) return candidate;
    if (!finiteNumber(hit.id)) return candidate;
    const details = await getJson(deps, `/movie/${hit.id}`, { append_to_response: 'credits' });
    if (!isRecord(details)) return candidate;
    const detailed = parseTmdbFilm(details, { genres: genreNames(details.genres), director: directorOf(details.credits) });
    return detailed ?? candidate;
  };
}
