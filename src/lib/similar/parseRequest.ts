export type SimilarAdjacencyRequest = {
  movieId: number;
  title: string;
  year: string;
  genres: string[];
};

export function parseSimilarAdjacencyRequest(body: unknown): SimilarAdjacencyRequest | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const movieId = Number(row.movieId ?? row.id);
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!Number.isFinite(movieId) || movieId <= 0 || !title) return null;
  const year = typeof row.year === 'string' || typeof row.year === 'number' ? String(row.year) : '';
  const genres = Array.isArray(row.genres)
    ? row.genres.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    : [];
  return { movieId, title, year, genres };
}
