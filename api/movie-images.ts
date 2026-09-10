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

  const id = Number(req.query.id);
  const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
  const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!id || !key || key.includes('your_tmdb')) {
    return res.status(400).json({ error: 'unavailable' });
  }

  try {
    const url = new URL(`${TMDB_BASE}/${mediaType}/${id}/images`);
    url.searchParams.set('api_key', key);
    url.searchParams.set('include_image_language', 'en,null');
    const r = await fetch(url.toString());
    if (!r.ok) return res.status(r.status).json({ error: 'tmdb' });
    const data = await r.json();
    const logos: { file_path?: string; iso_639_1?: string | null }[] = data?.logos ?? [];
    const pngs = logos.filter((logo) => logo.file_path?.endsWith('.png'));
    const pool = pngs.length ? pngs : logos;
    const preferred =
      pool.find((logo) => logo.iso_639_1 === 'en') ||
      pool.find((logo) => !logo.iso_639_1) ||
      pool[0];
    const stillPath = data?.stills?.[0]?.file_path || data?.backdrops?.[0]?.file_path || null;
    return res.status(200).json({
      logo: tmdbImage(preferred?.file_path, 'w500'),
      still: tmdbImage(stillPath, 'w780'),
    });
  } catch {
    return res.status(500).json({ error: 'failed' });
  }
}
