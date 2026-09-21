import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, extractJSON } from './_lib/xai.js';
import { parseNeighbors } from '../src/lib/similar/parseNeighbors.js';
import type { FilmNeighbor } from '../src/lib/similar/types.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

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

function tmdbKey(): string {
  return process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
}

async function tmdbMovie(id: number, key: string): Promise<{ poster_path?: string | null; title?: string; release_date?: string } | null> {
  const res = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${key}&language=en-US`);
  if (!res.ok) return null;
  return res.json();
}

async function tmdbSearch(title: string, year: string, key: string): Promise<number | null> {
  const url = new URL(`${TMDB_BASE}/search/movie`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('year', year);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const id = data.results?.[0]?.id;
  return typeof id === 'number' ? id : null;
}

export async function hydrateNeighbors(
  neighbors: FilmNeighbor[],
  key: string,
  excludeId: number,
): Promise<FilmNeighbor[]> {
  const out: FilmNeighbor[] = [];
  const seen = new Set<number>([excludeId]);
  for (const row of neighbors) {
    let movieId = row.movieId;
    if (!movieId && row.title && key) {
      movieId = (await tmdbSearch(row.title, row.year, key)) ?? 0;
    }
    if (!movieId || seen.has(movieId)) continue;
    seen.add(movieId);
    let posterPath = row.posterPath;
    let title = row.title;
    let year = row.year;
    if (key && (!posterPath || !title)) {
      const details = await tmdbMovie(movieId, key);
      if (details) {
        posterPath = posterPath || details.poster_path || null;
        title = title || details.title || title;
        year = year || details.release_date?.slice(0, 4) || year;
      }
    }
    out.push({ ...row, movieId, title, year, posterPath, source: 'scholar' });
  }
  return out;
}

async function recommendAdjacency(request: SimilarAdjacencyRequest): Promise<FilmNeighbor[]> {
  const text = await callXai({
    system:
      'You are a film scholar. Recommend films with deep craft connections. Output JSON only. Never invent TMDB ids. If you are unsure of an id, omit movieId.',
    maxTokens: 900,
    reasoningEffort: 'low',
    messages: [
      {
        role: 'user',
        content: `Recommend 16 films adjacent to "${request.title}" (${request.year}). Genres: ${request.genres.join(', ') || 'unknown'}. TMDB id of the reference: ${request.movieId}.

Do not include the reference film.
Each item needs title, year, movieId (TMDB), reason (film-to-film, under 12 words), axes (subset of story, visual, mood).

Return ONLY JSON:
{"neighbors":[{"movieId":27205,"title":"Inception","year":"2010","reason":"Nested heist architecture","axes":["story"]}]}`,
      },
    ],
  });
  return parseNeighbors(extractJSON(text) ?? text);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = parseSimilarAdjacencyRequest(req.body);
  if (!request) return res.status(400).json({ error: 'movieId and title are required', neighbors: [] });

  try {
    const raw = await recommendAdjacency(request);
    const neighbors = await hydrateNeighbors(raw, tmdbKey(), request.movieId);
    return res.status(200).json({ neighbors, source: 'grok' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'adjacency failed';
    console.error('similar-adjacency failed:', err);
    return res.status(500).json({ error: message, neighbors: [] });
  }
}
