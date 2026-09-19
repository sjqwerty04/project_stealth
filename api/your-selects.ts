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

type SelectCount = 1 | 3;

export type SelectExclusion = {
  title?: string;
  id?: string;
};

export type RecommendRequest = {
  context: RecommendContext;
  count: SelectCount;
  excluded: SelectExclusion[];
};

export type { SelectPick };

function meaningful(context: RecommendContext): boolean {
  const prefs = context.preferences ?? [];
  const profile = (context.profile ?? '').trim();
  const history = context.history ?? [];
  return prefs.length > 0 || profile.length > 0 || history.length > 0;
}

export function parseRecommendRequest(body: unknown): RecommendRequest | null {
  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const count = data.count ?? 3;
  if (count !== 1 && count !== 3) return null;
  const context =
    data.context && typeof data.context === 'object'
      ? (data.context as RecommendContext)
      : {};
  const excluded: SelectExclusion[] = [];
  if (Array.isArray(data.excluded)) {
    for (const value of data.excluded) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const id =
        typeof row.id === 'string' || typeof row.id === 'number'
          ? String(row.id).trim()
          : '';
      if (!title && !id) continue;
      excluded.push({
        ...(title ? { title } : {}),
        ...(id ? { id } : {}),
      });
    }
  }
  return { context, count, excluded };
}

function normalizedTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

export function filterExcludedPicks(
  picks: SelectPick[],
  excluded: SelectExclusion[],
  count: SelectCount,
): SelectPick[] {
  const titles = new Set(
    excluded.flatMap((row) => (row.title ? [normalizedTitle(row.title)] : [])),
  );
  const ids = new Set(excluded.flatMap((row) => (row.id ? [row.id] : [])));
  return picks
    .filter((pick) => !titles.has(normalizedTitle(pick.title)) && (!pick.id || !ids.has(pick.id)))
    .slice(0, count);
}

async function recommendWithGrok(
  context: RecommendContext,
  count: SelectCount,
  excluded: SelectExclusion[],
): Promise<SelectPick[]> {
  const skill = readSkill('your-selects');
  const countWord = count === 1 ? 'ONE' : 'THREE';
  const exclusions =
    excluded.length > 0
      ? `Do not recommend any of these currently visible films, matching by title or ID:\n${JSON.stringify(excluded)}\n\n`
      : '';
  const text = await callXai({
    system: `${
      skill || 'Recommend films that match this viewer. JSON only.'
    }\nFor this request, return exactly ${count} film${count === 1 ? '' : 's'}.`,
    maxTokens: count === 1 ? 500 : 900,
    messages: [
      {
        role: 'user',
        content: `Recommend ${countWord} film${count === 1 ? '' : 's'} this person has not listed in history. Use this context and no other title lists.

${JSON.stringify(context)}

${exclusions}Each whyMatch is two or three sentences. Name a film from their history. Do not use em dashes.

Return ONLY JSON:
{"picks":[{"title":"Film","year":"2015","whyMatch":"Two or three sentences. Name a history title.","confidence":0.8}]}`,
      },
    ],
  });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]) as { picks?: unknown };
  return filterExcludedPicks(parseSelectPicks(parsed.picks), excluded, count);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = parseRecommendRequest(req.body);
  if (!request) {
    return res.status(400).json({ error: 'count must be 1 or 3', picks: [] });
  }
  const { context, count, excluded } = request;
  if (!meaningful(context)) {
    return res.status(200).json({ picks: [], empty: true, source: 'empty' });
  }

  try {
    const picks = await recommendWithGrok(context, count, excluded);
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
