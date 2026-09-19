import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai } from './_lib/xai.js';
import { readSkill } from './_lib/readSkill.js';
import { normalizeStats, parseSelectsProfile, templateProfile, type TasteStats } from '../src/lib/onboarding/profile.js';

type ProfileRequest = {
  stats: TasteStats;
  picks: { positive: string[]; negative: string[]; axes: string[] };
};

function parseRequest(body: unknown): ProfileRequest | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as Record<string, unknown>;
  const stats = data.stats;
  if (!stats || typeof stats !== 'object' || typeof (stats as TasteStats).filmsRead !== 'number') return null;
  const picksRaw = (data.picks && typeof data.picks === 'object' ? data.picks : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5) : []);
  return {
    stats: normalizeStats(stats as Partial<TasteStats>),
    picks: { positive: list(picksRaw.positive), negative: list(picksRaw.negative), axes: list(picksRaw.axes) },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = parseRequest(req.body);
  if (!request) return res.status(400).json({ error: 'stats required' });

  const fallback = templateProfile(request.stats);
  try {
    const skill = readSkill('selects-profile');
    const text = await callXai({
      system: skill || 'Write a ten card taste profile as JSON. Eight warm, two sharp.',
      maxTokens: 1800,
      reasoningEffort: 'low',
      messages: [
        {
          role: 'user',
          content: `Write the Selects profile for this person. Quote only numbers present in stats.\n\n${JSON.stringify(request)}\n\nReturn ONLY the JSON object.`,
        },
      ],
    });
    const match = text.match(/\{[\s\S]*\}/);
    const profile = match ? parseSelectsProfile(JSON.parse(match[0])) : null;
    if (!profile) return res.status(200).json({ profile: fallback, source: 'template', reason: 'unparseable' });
    return res.status(200).json({ profile, source: 'grok' });
  } catch (err) {
    console.error('selects-profile failed:', err);
    return res.status(200).json({ profile: fallback, source: 'template', reason: 'error' });
  }
}
