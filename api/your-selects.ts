import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai } from './_lib/xai.js';
import { readSkill } from './_lib/readSkill.js';
import { parseSelectPicks, type SelectPick } from '../src/lib/taste/parseSelectPicks.js';

type HistoryItem = { item: string; rating: number; id?: string };

type RecommendContext = {
  preferences?: string[];
  profile?: string;
  constraints?: Record<string, unknown>;
  history?: HistoryItem[];
};

export type { SelectPick };

function meaningful(context: RecommendContext): boolean {
  const prefs = context.preferences ?? [];
  const profile = (context.profile ?? '').trim();
  const history = context.history ?? [];
  return prefs.length > 0 || profile.length > 0 || history.length > 0;
}

async function recommendWithGrok(context: RecommendContext): Promise<SelectPick[]> {
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
  const parsed = JSON.parse(match[0]) as { picks?: unknown };
  return parseSelectPicks(parsed.picks).slice(0, 3);
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

  try {
    const picks = await recommendWithGrok(context);
    return res.status(200).json({
      picks: picks.filter((p) => p.confidence >= 0.5),
      source: 'grok',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'recommend failed';
    console.error('your-selects Grok failed:', err);
    return res.status(500).json({ error: message, picks: [] });
  }
}
