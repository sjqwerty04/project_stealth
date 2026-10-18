import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAdmin } from '../_lib/voice/admin.js';
import { dispatchVoice } from '../_lib/voice/router.js';

async function readJson(req: VercelRequest): Promise<{ raw: string; json: unknown }> {
  if (typeof req.body === 'string') {
    return { raw: req.body, json: req.body ? JSON.parse(req.body) : {} };
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return { raw: JSON.stringify(req.body), json: req.body };
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return { raw, json: raw ? JSON.parse(raw) : {} };
  } catch {
    return { raw, json: {} };
  }
}

// Leave the body as bytes. Standard Webhooks signs the exact payload, and a
// re-serialized JSON object would fail that check.
export const config = { api: { bodyParser: false } };

// One function serves every voice route. Hobby deployments allow 12 functions.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = String(req.query.route ?? '');
  const { raw, json } = await readJson(req);
  if (route === 'admin') {
    req.body = json;
    return handleAdmin(req, res);
  }
  const result = await dispatchVoice(route, {
    headers: req.headers as Record<string, string | string[] | undefined>,
    rawBody: raw,
    json,
  });
  return res.status(result.status).json(result.body);
}
