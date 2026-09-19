import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, extractJSON, XaiConfigError } from './_lib/xai.js';

type ExtractedItem = { title: string; year?: string; stars?: number; struck?: boolean };
type Extracted = { items: ExtractedItem[]; intent: 'watched' | 'watchlist' | 'unknown'; confidence: number };

const SYSTEM = `You read films from images or pasted text. Images may be app screenshots (Letterboxd, Notes, Reminders, IMDb, a spreadsheet, a chat), but also photos of cinema ticket stubs, cinema marquees or lobby posters, handwritten lists, and pages from a paper diary or notebook.
Return every film title you can see or confidently read from the image, one item per film. Keep the user's order. Read handwriting and printed stubs as best you can, and treat a ticket stub or marquee as a film the user has watched.
For each item: title, year if visible, stars on a 0.5 to 5 scale if any rating is visible (convert /10 by halving), struck true if the line is crossed out, checked, ticked, greyed as done, or marked watched or seen.
Decide intent for the whole list: "watched" if it reads as things they have seen (diary, ratings, ranked, favourites), "watchlist" if it reads as things they want to see (to watch, queue, saved), else "unknown".
Return ONLY JSON: {"items":[{"title":"Heat","year":"1995","stars":4.5,"struck":false}],"intent":"watched","confidence":0.8}`;

const MAX_IMAGE_CHARS = 6_000_000;

function clean(raw: unknown): Extracted {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items: ExtractedItem[] = [];
  if (Array.isArray(data.items)) {
    for (const row of data.items) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      if (title.length < 2) continue;
      const item: ExtractedItem = { title };
      if (typeof r.year === 'string' && /^\d{4}$/.test(r.year)) item.year = r.year;
      if (typeof r.year === 'number') item.year = String(r.year);
      if (typeof r.stars === 'number' && r.stars > 0) item.stars = Math.min(5, Math.round(r.stars * 2) / 2);
      if (r.struck === true) item.struck = true;
      items.push(item);
    }
  }
  const intent = data.intent === 'watched' || data.intent === 'watchlist' ? data.intent : 'unknown';
  const confidence = typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.5;
  return { items, intent, confidence };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 20_000) : '';
  const images = Array.isArray(req.body?.images)
    ? (req.body.images as unknown[]).filter((u): u is string => typeof u === 'string' && u.length < MAX_IMAGE_CHARS).slice(0, 4)
    : [];
  if (!text && !images.length) return res.status(400).json({ error: 'text or images required' });

  try {
    const prompt = text
      ? `Extract the films from this text.\n\n${text}`
      : 'Extract the films from the attached screenshot(s).';
    const out = await callXai({ system: SYSTEM, maxTokens: 3000, messages: [{ role: 'user', content: prompt }], images });
    const parsed = clean(extractJSON(out));
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof XaiConfigError) return res.status(503).json({ error: 'unavailable' });
    const message = err instanceof Error ? err.message : 'extract failed';
    console.error('list-extract failed:', err);
    return res.status(500).json({ error: message });
  }
}
