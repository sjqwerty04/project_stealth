import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callOpenRouter } from './_lib/openrouter';

const SYSTEM = `You write ultra-short audience-perspective hooks for films. Max 7 words. Rules:
1. Present tense only — never "upcoming", "drops", "next year", "debut drops".
2. NEVER mention the director by name unless they are globally iconic (Nolan, Kubrick, Spielberg, Scorsese, Tarantino, Kubrick, Fincher). Unknown directors mean nothing to audiences.
3. Focus on what AUDIENCES know this film for: box office, awards, premise, cultural moment, reputation.
Good: "$1M budget. $80M gross. Earned every dollar.", "The horror film nobody saw coming", "Oscar winner for Best Cinematography", "36-year-late sequel that justified every year".
Bad: "Barker's directorial debut" (nobody knows Barker), "drops next year" (stale), "Baker's horror debut" (same problem).`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const title = typeof req.query.title === 'string' ? req.query.title : '';
  const year  = typeof req.query.year  === 'string' ? req.query.year  : '';

  if (!title) return res.status(400).json({ error: 'title is required' });

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  try {
    const text = await callOpenRouter({
      model: 'google/gemini-3.1-flash-lite',
      plugins: [{ id: 'web', max_results: 3 }],
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Today is ${currentDate}. Search the web for what "${title}"${year ? ` (${year})` : ''} is known for among audiences — box office, awards, cultural reputation. Then write ONE hook line, max 7 words, present tense, audience-POV. Output ONLY the line, no quotes.`,
        },
      ],
      maxTokens: 40,
    });

    const knownFor = text.trim().replace(/^["'"']|["'"']$/g, '') || null;

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate');
    return res.status(200).json({ knownFor });
  } catch (err: any) {
    console.error('movie-known-for error:', err?.message);
    return res.status(200).json({ knownFor: null });
  }
}
