import type { VercelRequest, VercelResponse } from '@vercel/node';
import { streamXai, type ChatMessage } from './_lib/xai.js';
import { snippetsToPromptBlock, type RedditSnippet } from './_lib/reddit.js';
import { readSkill } from './_lib/readSkill.js';
import { searchFilm, searchPerson } from './_lib/tmdb.js';
import { createAnswerStream, type RawEntities } from '../src/lib/askAi/answerStream.js';
import type { MentionEntity } from '../src/lib/askAi/mentions.js';
import { handleMovieStarters } from './_lib/movieStarters.js';

type Movie = {
  id?: number;
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  overview?: string;
};

const buildSystem = (movie: Movie, snippets: RedditSnippet[], taste?: string): string => {
  const skill = readSkill('movie-chat');
  const grounding = snippetsToPromptBlock(snippets || [], 2500);
  return `${skill}

THE FILM:
Title: "${movie.title}" (${movie.year || 'n/a'})
Director: ${movie.director || 'unknown'}
Genres: ${(movie.genres || []).join(', ') || 'unknown'}
Overview: ${movie.overview || 'n/a'}

${grounding ? `WHAT REAL VIEWERS DISCUSS (from Reddit):\n${grounding}\n` : ''}
${taste ? `THE USER'S TASTE (use when recommending similar films):\n${taste}\n` : ''}`;
};

async function resolveEntities(raw: RawEntities, movie: Movie): Promise<MentionEntity[]> {
  const films = (raw.films || [])
    .filter((f) => f?.title)
    .slice(0, 6);
  const people = (raw.people || []).filter((p) => typeof p === 'string' && p.trim()).slice(0, 6);
  const [filmHits, personHits] = await Promise.all([
    Promise.all(films.map((f) => searchFilm(f.title, f.year))),
    Promise.all(people.map((p) => searchPerson(p))),
  ]);
  const out: MentionEntity[] = [];
  filmHits.forEach((hit, i) => {
    // Keep the model's spelling as the name so it can be found in the answer text.
    if (hit) out.push({ kind: 'film', id: hit.id, name: films[i].title, year: hit.year, image: hit.posterPath });
  });
  personHits.forEach((hit, i) => {
    if (hit) out.push({ kind: 'person', id: hit.id, name: people[i], image: hit.profilePath });
  });
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  // /api/movie-starters rewrites here so starters don't cost a 13th serverless function.
  if (req.query.route === 'starters' || (req.url || '').includes('/api/movie-starters')) {
    return handleMovieStarters(req, res);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, movie, snippets, taste, stream } = req.body as {
    messages: ChatMessage[];
    movie: Movie;
    snippets?: RedditSnippet[];
    taste?: string;
    stream?: boolean;
  };

  if (!messages?.length || !movie?.title) {
    return res.status(400).json({ error: 'messages and movie are required' });
  }

  const answer = createAnswerStream();
  const deltas = streamXai({
    messages: messages.slice(-8),
    system: buildSystem(movie, snippets || [], taste),
    maxTokens: 480,
    reasoningEffort: 'low',
  });

  if (!stream) {
    try {
      for await (const d of deltas) answer.push(d);
      const { text, entities } = answer.finish();
      const resolved = await resolveEntities(entities, movie);
      return res.status(200).json({ text, entities: resolved });
    } catch (err) {
      console.error('movie-chat error:', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj: unknown) => res.write(`${JSON.stringify(obj)}\n`);
  try {
    for await (const d of deltas) {
      const visible = answer.push(d);
      if (visible) send({ t: 'd', v: visible });
    }
    const { text, entities } = answer.finish();
    send({ t: 'done', text, entities: await resolveEntities(entities, movie) });
  } catch (err) {
    console.error('movie-chat stream error:', err);
    send({ t: 'error', error: err instanceof Error ? err.message : 'stream failed' });
  }
  res.end();
}
