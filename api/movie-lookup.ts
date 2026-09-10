import type { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbImage(path: string | undefined, size: 'w500' | 'w780') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const title = String(req.query.title || '').trim();
  const year = String(req.query.year || '').trim();
  const id = Number(req.query.id);
  const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
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
