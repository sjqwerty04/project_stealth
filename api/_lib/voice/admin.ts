import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearerMatches } from './auth.js';

const XAI = 'https://api.x.ai';

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        /secret|password|auth_token/i.test(k) ? '[redacted]' : redact(v),
      ]),
    );
  }
  return value;
}

async function xai(path: string, init: RequestInit = {}) {
  const res = await fetch(`${XAI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body: redact(body) };
}

export async function handleAdmin(req: VercelRequest, res: VercelResponse) {
  if (!bearerMatches(req.headers.authorization, process.env.VOICE_ADMIN_TOKEN)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const action = String(req.query.action ?? 'status');

  if (action === 'status') {
    const [numbers, voices] = await Promise.all([xai('/v2/phone-numbers?limit=100'), xai('/v1/tts/voices')]);
    return res.status(200).json({ hasKey: Boolean(process.env.XAI_API_KEY), numbers, voices });
  }

  if (action === 'xai') {
    const path = String(req.query.path ?? '');
    if (!path.startsWith('/v2/phone-numbers') && !path.startsWith('/v2/webhooks') && !path.startsWith('/v1/agents') && !path.startsWith('/v2/agents')) {
      return res.status(400).json({ error: 'path not allowed' });
    }
    const method = String(req.query.method ?? 'GET').toUpperCase();
    const body = method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(req.body ?? {});
    return res.status(200).json(await xai(path, { method, body }));
  }

  return res.status(400).json({ error: 'unknown action' });
}
