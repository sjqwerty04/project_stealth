import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { adjacencyDoc, parseNeighbors } from './parseNeighbors';
import type { FilmAdjacency, FilmNeighbor } from './types';

export function adjacencyRef(movieId: number) {
  return doc(db, 'film_adjacency', String(movieId));
}

export async function readAdjacency(movieId: number): Promise<FilmAdjacency | null> {
  const snap = await getDoc(adjacencyRef(movieId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const neighbors = parseNeighbors(data.neighbors);
  if (!neighbors.length) return null;
  return {
    movieId,
    neighbors,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
}

export async function writeAdjacency(movieId: number, neighbors: FilmNeighbor[]): Promise<FilmAdjacency> {
  const payload = adjacencyDoc(movieId, neighbors);
  await setDoc(adjacencyRef(movieId), payload);
  return payload;
}
