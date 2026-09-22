import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { adjacencyDoc, adjacencyDocId, parseNeighbors } from './parseNeighbors';
import type { FilmAdjacency, FilmNeighbor } from './types';

export type AdjacencyMediaType = 'movie' | 'tv';

export function adjacencyRef(movieId: number, mediaType: AdjacencyMediaType = 'movie') {
  return doc(db, 'film_adjacency', adjacencyDocId(movieId, mediaType));
}

export async function readAdjacency(
  movieId: number,
  mediaType: AdjacencyMediaType = 'movie',
): Promise<FilmAdjacency | null> {
  const snap = await getDoc(adjacencyRef(movieId, mediaType));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const neighbors = parseNeighbors(data.neighbors).filter((n) => n.movieId > 0);
  if (!neighbors.length) return null;
  return {
    movieId,
    neighbors,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
}

export async function writeAdjacency(
  movieId: number,
  neighbors: FilmNeighbor[],
  mediaType: AdjacencyMediaType = 'movie',
): Promise<FilmAdjacency> {
  const payload = adjacencyDoc(movieId, neighbors);
  await setDoc(adjacencyRef(movieId, mediaType), payload);
  return payload;
}
