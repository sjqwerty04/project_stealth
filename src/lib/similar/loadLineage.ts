import type { FilmNeighbor } from './types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const LINEAGE_JOBS = new Set(['Director', 'Director of Photography', 'Writer']);

type CreditFilm = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
  job?: string;
};

function isLineageCredit(film: CreditFilm): boolean {
  return !film.job || LINEAGE_JOBS.has(film.job);
}

export function lineageFromCredits(
  movieId: number,
  people: Array<{ films: CreditFilm[] }>,
): FilmNeighbor[] {
  const byId = new Map<number, { film: CreditFilm; pop: number }>();
  for (const person of people) {
    for (const film of person.films) {
      if (!film.id || film.id === movieId || !film.poster_path) continue;
      if (!isLineageCredit(film)) continue;
      const pop = film.popularity || 0;
      const existing = byId.get(film.id);
      if (!existing || pop > existing.pop) byId.set(film.id, { film, pop });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.pop - a.pop)
    .slice(0, 8)
    .map(({ film }) => ({
      movieId: film.id,
      title: film.title || 'Untitled',
      year: film.release_date?.slice(0, 4) || '',
      posterPath: film.poster_path ?? null,
      reason: 'Same creative lineage',
      source: 'lineage' as const,
      axes: [],
    }));
}

export async function loadLineageNeighbors(movieId: number, personIds: number[]): Promise<FilmNeighbor[]> {
  const key = import.meta.env.VITE_TMDB_API_KEY || '';
  const ids = [...new Set(personIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 4);
  if (!key || !ids.length) return [];
  const people = await Promise.all(
    ids.map(async (personId) => {
      const res = await fetch(
        `${TMDB_BASE}/person/${personId}?api_key=${key}&append_to_response=movie_credits`,
      );
      if (!res.ok) return { films: [] as CreditFilm[] };
      const data = await res.json();
      const crew = (data.movie_credits?.crew || []) as CreditFilm[];
      return {
        films: crew.filter(isLineageCredit),
      };
    }),
  );
  return lineageFromCredits(movieId, people);
}
