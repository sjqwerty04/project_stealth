import type { FilmAdjacency, FilmNeighbor, NeighborAxis } from './types';
import { ADJACENCY_MAX_NEIGHBORS } from './types';

const AXES: NeighborAxis[] = ['story', 'visual', 'mood'];

function asAxis(value: unknown): NeighborAxis | null {
  return AXES.includes(value as NeighborAxis) ? (value as NeighborAxis) : null;
}

export function parseNeighbor(raw: unknown): FilmNeighbor | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const rawId = Number(row.movieId ?? row.id);
  const movieId = Number.isFinite(rawId) && rawId > 0 ? rawId : 0;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) return null;
  const axes = Array.isArray(row.axes)
    ? row.axes.map(asAxis).filter((axis): axis is NeighborAxis => axis != null)
    : [];
  return {
    movieId,
    title,
    year: typeof row.year === 'string' || typeof row.year === 'number' ? String(row.year) : '',
    posterPath: typeof row.posterPath === 'string' ? row.posterPath : typeof row.poster_path === 'string' ? row.poster_path : null,
    reason: typeof row.reason === 'string' ? row.reason.trim() : '',
    source: 'scholar',
    axes,
  };
}

export function parseNeighbors(raw: unknown): FilmNeighbor[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { neighbors?: unknown }).neighbors)
      ? (raw as { neighbors: unknown[] }).neighbors
      : [];
  const seen = new Set<number>();
  const out: FilmNeighbor[] = [];
  for (const item of list) {
    const neighbor = parseNeighbor(item);
    if (!neighbor) continue;
    if (neighbor.movieId > 0) {
      if (seen.has(neighbor.movieId)) continue;
      seen.add(neighbor.movieId);
    }
    out.push(neighbor);
    if (out.length >= ADJACENCY_MAX_NEIGHBORS) break;
  }
  return out;
}

export function adjacencyDocId(movieId: number, mediaType: 'movie' | 'tv' = 'movie') {
  return mediaType === 'tv' ? `tv_${movieId}` : String(movieId);
}

export function adjacencyDoc(movieId: number, neighbors: FilmNeighbor[], updatedAt = Date.now()): FilmAdjacency {
  return {
    movieId,
    neighbors: neighbors.map((n) => ({ ...n, source: 'scholar' as const })).slice(0, ADJACENCY_MAX_NEIGHBORS),
    updatedAt,
  };
}
