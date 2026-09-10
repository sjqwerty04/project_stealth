import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, type ChatMessage } from './_lib/xai.js';
import { snippetsToPromptBlock, type RedditSnippet } from './_lib/reddit.js';
import { readSkill } from './_lib/readSkill.js';

type Movie = {
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  overview?: string;
};

const buildSystem = (movie: Movie, snippets: RedditSnippet[], taste?: string): string => {
  const skill = readSkill('movie-chat');
  const grounding = snippetsToPromptBlock(snippets || [], 5000);
  return `${skill}

THE FILM:
Title: "${movie.title}" (${movie.year || 'n/a'})
Director: ${movie.director || 'unknown'}
Genres: ${(movie.genres || []).join(', ') || 'unknown'}
Overview: ${movie.overview || 'n/a'}

${grounding ? `WHAT REAL VIEWERS DISCUSS (from Reddit):\n${grounding}\n` : ''}
${taste ? `THE USER'S TASTE (use when recommending similar films):\n${taste}\n` : ''}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, movie, snippets, taste } = req.body as {
    messages: ChatMessage[];
    movie: Movie;
    snippets?: RedditSnippet[];
    taste?: string;
  };

  if (!messages?.length || !movie?.title) {
    return res.status(400).json({ error: 'messages and movie are required' });
  }

  try {
    const text = await callXai({
      messages,
      system: buildSystem(movie, snippets || [], taste),
      maxTokens: 1024,
    });

    let reply = text;
    let recommendations: { title: string; year?: string }[] = [];
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (block) {
      try {
        const parsed = JSON.parse(block[1].replace(/,\s*([}\]])/g, '$1').trim());
        if (Array.isArray(parsed?.recommendations)) recommendations = parsed.recommendations;
      } catch {
        // ignore malformed block
      }
      reply = text.replace(block[0], '').trim();
    }

    return res.status(200).json({ text: reply, recommendations });
  } catch (err: any) {
    console.error('movie-chat error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
