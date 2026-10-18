import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAdmin } from '../_lib/voice/admin.js';

// One function serves every voice route: Hobby deployments allow 12 functions.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = String(req.query.route ?? '');
  if (route === 'admin') return handleAdmin(req, res);
  return res.status(404).json({ error: 'not found' });
}
