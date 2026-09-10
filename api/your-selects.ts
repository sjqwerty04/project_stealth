import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai } from './_lib/xai.js';
import { readSkill } from './_lib/readSkill.js';

type HistoryItem = { item: string; rating: number; id?: string };

type RecommendContext = {
  preferences?: string[];
  profile?: string;
  constraints?: Record<string, unknown>;
  history?: HistoryItem[];
};

type TasteRayRec = {
  item?: { name?: string; title?: string; year?: string | number; id?: string };
  name?: string;
  title?: string;
  year?: string | number;
  confidence?: number;
  score?: number;
  match_score?: number;
  explanation?: { why_match?: string };
  why_match?: string;
};

export type SelectPick = {
  title: string;
  year: string;
  whyMatch: string;
  confidence: number;
  id?: string;
};

function meaningful(context: RecommendContext): boolean {
  const prefs = context.preferences ?? [];
  const profile = (context.profile ?? '').trim();
  const history = context.history ?? [];
  return prefs.length > 0 || profile.length > 0 || history.length > 0;
}

function parseRecs(raw: unknown): SelectPick[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { recommendations?: unknown }).recommendations)
      ? (raw as { recommendations: unknown[] }).recommendations
      : [];

  return list
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as TasteRayRec;
      const title = rec.item?.name || rec.item?.title || rec.name || rec.title || '';
      if (!title) return null;
      const yearSource = rec.item?.year ?? rec.year ?? '';
      const confidence = rec.confidence ?? rec.score ?? rec.match_score ?? 1;
      const whyMatch = rec.explanation?.why_match || rec.why_match || '';
      return {
        title,
        year: String(yearSource),
        whyMatch,
        confidence: typeof confidence === 'number' ? confidence : 1,
        id: rec.item?.id,
      } satisfies SelectPick;
    })
    .filter((row): row is SelectPick => row != null);
}

async function fallbackClaude(context: RecommendContext): Promise<SelectPick[]> {
  const skill = readSkill('your-selects');
  const text = await callXai({
    system: skill || 'Recommend three films that match this viewer. JSON only.',
    maxTokens: 600,
    messages: [
      {
        role: 'user',
        content: `Recommend THREE films this person has not listed in history. Use this context and no other title lists.

${JSON.stringify(context)}

Return ONLY JSON:
{"picks":[{"title":"Film","year":"2015","whyMatch":"one sentence naming their history","confidence":0.8}]}`,
      },
    ],
  });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]) as { picks?: TasteRayRec[] };
  return parseRecs(parsed.picks).slice(0, 3);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const context = (req.body?.context ?? {}) as RecommendContext;
  if (!meaningful(context)) {
    return res.status(200).json({ picks: [], empty: true, source: 'empty' });
  }

  const key = process.env.TASTERAY_KEY || '';
  if (!key) {
    console.warn('your-selects: TASTERAY_KEY missing, using LLM fallback');
    try {
      const picks = await fallbackClaude(context);
      return res.status(200).json({ picks: picks.filter((p) => p.confidence >= 0.5), source: 'fallback' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'fallback failed';
      return res.status(500).json({ error: message, picks: [] });
    }
  }

  const started = Date.now();
  try {
    const response = await fetch('https://api.tasteray.com/v1/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        vertical: 'movies',
        context: {
          preferences: context.preferences ?? [],
          profile: context.profile ?? '',
          constraints: context.constraints ?? {},
          history: (context.history ?? []).slice(0, 50),
        },
        count: 3,
        explain: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TasteRay ${response.status}: ${text}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - started;
    const picks = parseRecs(data).filter((p) => p.confidence >= 0.5).slice(0, 3);
    return res.status(200).json({
      picks,
      source: 'tasteray',
      meta: { latency_ms: data?.meta?.latency_ms ?? latencyMs },
    });
  } catch (err: unknown) {
    console.error('your-selects TasteRay failed, trying fallback:', err);
    try {
      const picks = await fallbackClaude(context);
      return res.status(200).json({ picks: picks.filter((p) => p.confidence >= 0.5), source: 'fallback' });
    } catch (fallbackErr: unknown) {
      const message = fallbackErr instanceof Error ? fallbackErr.message : 'recommend failed';
      return res.status(500).json({ error: message, picks: [] });
    }
  }
}
