import { parseNeighbors } from './parseNeighbors';
import { readAdjacency, writeAdjacency } from './adjacencyStore';
import type { FilmNeighbor } from './types';

export async function fetchScholarNeighbors(input: {
  movieId: number;
  title: string;
  year: string;
  genres?: string[];
}): Promise<FilmNeighbor[]> {
  const res = await fetch('/api/similar-adjacency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      movieId: input.movieId,
      title: input.title,
      year: input.year,
      genres: input.genres ?? [],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return parseNeighbors(data);
}

export function prefetchScholarAdjacency(
  movies: Array<{ movieId: number; title: string; year: string | number; genres?: string[] }>,
): void {
  for (const movie of movies.slice(0, 3)) {
    void (async () => {
      const existing = await readAdjacency(movie.movieId).catch(() => null);
      if (existing?.neighbors.length) return;
      const neighbors = await fetchScholarNeighbors({
        movieId: movie.movieId,
        title: movie.title,
        year: String(movie.year ?? ''),
        genres: movie.genres,
      });
      if (neighbors.length) await writeAdjacency(movie.movieId, neighbors).catch(() => {});
    })();
  }
}
