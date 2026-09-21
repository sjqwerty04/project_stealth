import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, extractJSON } from './_lib/xai.js';
import { parseNeighbors } from '../src/lib/similar/parseNeighbors.js';
import { parseSimilarAdjacencyRequest } from '../src/lib/similar/parseRequest.js';
import type { FilmNeighbor } from '../src/lib/similar/types.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbImage(path: string | undefined, size: 'w500' | 'w780') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
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

async function hydrateNeighbors(
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

async function handleAdjacency(req: VercelRequest, res: VercelResponse) {
  const request = parseSimilarAdjacencyRequest(req.body);
  if (!request) return res.status(400).json({ error: 'movieId and title are required', neighbors: [] });
  try {
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
    const raw = parseNeighbors(extractJSON(text) ?? text);
    const neighbors = await hydrateNeighbors(raw, tmdbKey(), request.movieId);
    return res.status(200).json({ neighbors, source: 'grok' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'adjacency failed';
    console.error('similar-adjacency failed:', err);
    return res.status(500).json({ error: message, neighbors: [] });
  }
}

async function handleLookup(req: VercelRequest, res: VercelResponse) {
  const title = String(req.query.title || '').trim();
  const year = String(req.query.year || '').trim();
  const id = Number(req.query.id);
  const key = tmdbKey();
  if (!key || key.includes('your_tmdb')) {
    return res.status(400).json({ error: 'unavailable' });
  }

  try {
    let movieId = id;
    let mediaType: 'movie' | 'tv' = req.query.type === 'tv' ? 'tv' : 'movie';
    let details: {
      id?: number;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      poster_path?: string;
      backdrop_path?: string;
      runtime?: number;
      episode_run_time?: number[];
    } | null = null;

    if (!movieId && title) {
      const search = new URL(`${TMDB_BASE}/search/movie`);
      search.searchParams.set('api_key', key);
      search.searchParams.set('query', title);
      if (year) search.searchParams.set('year', year);
      const found = await fetch(search.toString());
      if (!found.ok) return res.status(found.status).json({ error: 'tmdb' });
      const data = await found.json();
      const hit = data?.results?.[0];
      if (!hit?.id) return res.status(404).json({ error: 'not_found' });
      movieId = hit.id;
    }

    if (!movieId) return res.status(400).json({ error: 'unavailable' });

    const detailsUrl = new URL(`${TMDB_BASE}/${mediaType}/${movieId}`);
    detailsUrl.searchParams.set('api_key', key);
    const detailsRes = await fetch(detailsUrl.toString());
    if (detailsRes.ok) details = await detailsRes.json();

    const imagesUrl = new URL(`${TMDB_BASE}/${mediaType}/${movieId}/images`);
    imagesUrl.searchParams.set('api_key', key);
    imagesUrl.searchParams.set('include_image_language', 'en,null');
    const imagesRes = await fetch(imagesUrl.toString());
    const imagesData = imagesRes.ok ? await imagesRes.json() : {};
    const logos: { file_path?: string; iso_639_1?: string | null }[] = imagesData?.logos ?? [];
    const pngs = logos.filter((logo) => logo.file_path?.endsWith('.png'));
    const pool = pngs.length ? pngs : logos;
    const preferred =
      pool.find((logo) => logo.iso_639_1 === 'en') ||
      pool.find((logo) => !logo.iso_639_1) ||
      pool[0];

    const runtimeMins = details?.runtime || details?.episode_run_time?.[0] || 0;
    const hrs = Math.floor(runtimeMins / 60);
    const mins = runtimeMins % 60;
    const runtime = runtimeMins
      ? hrs > 0
        ? `${hrs}h ${mins}m`
        : `${mins}m`
      : '';

    return res.status(200).json({
      id: movieId,
      title: details?.title || details?.name || title,
      year: (details?.release_date || details?.first_air_date || year || '').slice(0, 4),
      poster: tmdbImage(details?.poster_path, 'w500'),
      backdrop: tmdbImage(details?.backdrop_path, 'w780'),
      logo: tmdbImage(preferred?.file_path, 'w500'),
      still: tmdbImage(imagesData?.backdrops?.[0]?.file_path, 'w780') || tmdbImage(details?.backdrop_path, 'w780'),
      runtime,
      mediaType,
    });
  } catch {
    return res.status(500).json({ error: 'failed' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'POST') return handleAdjacency(req, res);
  if (req.method === 'GET') return handleLookup(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
