export type NeighborSource = 'lineage' | 'scholar';
export type NeighborAxis = 'story' | 'visual' | 'mood';

export type FilmNeighbor = {
  movieId: number;
  title: string;
  year: string;
  posterPath: string | null;
  reason: string;
  source: NeighborSource;
  axes: NeighborAxis[];
};

export type FilmAdjacency = {
  movieId: number;
  neighbors: FilmNeighbor[];
  updatedAt: number;
};

export type RankedNeighbor = FilmNeighbor & {
  score: number;
  tasteBoost: boolean;
};

export const ADJACENCY_MAX_NEIGHBORS = 24;
export const LINEAGE_POOL_MAX = 24;
export const SIMILAR_GRID_INITIAL = 8;
export const SIMILAR_GRID_MORE = 6;
