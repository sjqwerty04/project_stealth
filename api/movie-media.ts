import type { VercelRequest, VercelResponse } from '@vercel/node';
import { movieClipHandler } from './_lib/tmdb/movieClip.js';
import { movieImagesHandler } from './_lib/tmdb/movieImages.js';

// Hobby deployments allow 12 functions, so /api/movie-images and /api/movie-clip
// are rewritten here (vercel.json) and share one function.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.kind === 'clip') return movieClipHandler(req, res);
  return movieImagesHandler(req, res);
}
