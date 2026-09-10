import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai } from './_lib/xai.js';
import { readSkill } from './_lib/readSkill.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const title = typeof req.query.title === 'string' ? req.query.title : '';
  const year  = typeof req.query.year  === 'string' ? req.query.year  : '';
  const taste = typeof req.query.taste === 'string' ? req.query.taste : '';

  if (!title) return res.status(400).json({ error: 'title is required' });

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const skill = readSkill('movie-hook');

  try {
    const text = await callXai({
      system: skill || 'Write a 7-word audience-POV hook. Present tense. Specific.',
      webSearch: true,
      maxTokens: 80,
      messages: [
        {
          role: 'user',
          content: `Today is ${currentDate}. Search the web for what "${title}"${year ? ` (${year})` : ''} is known for among audiences. Write ONE hook line, max 7 words, present tense, audience-POV.${taste ? ` Tilt it toward this viewer without naming them: ${taste}` : ''} Output ONLY the line, no quotes.`,
        },
      ],
    });

    const knownFor = text.trim().replace(/^["'"']|["'"']$/g, '') || null;

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate');
    return res.status(200).json({ knownFor });
  } catch (err: any) {
    console.error('movie-known-for error:', err?.message);
    return res.status(200).json({ knownFor: null });
  }
}
