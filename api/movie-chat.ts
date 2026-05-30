import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callAnthropic, type ChatMessage } from './_lib/anthropic';
import { snippetsToPromptBlock, type RedditSnippet } from './_lib/reddit';

type Movie = {
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  overview?: string;
};

const buildSystem = (movie: Movie, snippets: RedditSnippet[], taste?: string): string => {
  const grounding = snippetsToPromptBlock(snippets || [], 5000);
  return `You are a sharp, funny film companion embedded in a movie app. You are talking with a user about ONE specific film and nothing else.

THE FILM:
Title: "${movie.title}" (${movie.year || 'n/a'})
Director: ${movie.director || 'unknown'}
Genres: ${(movie.genres || []).join(', ') || 'unknown'}
Overview: ${movie.overview || 'n/a'}

${grounding ? `WHAT REAL VIEWERS DISCUSS (from Reddit — use to ground answers about plot details, theories, trivia):\n${grounding}\n` : ''}
${taste ? `THE USER'S TASTE (use only when recommending similar films):\n${taste}\n` : ''}

YOUR RULES:
- Only help with TWO things: (1) answering questions about THIS film — plot, themes, trivia, "what did X mean", theories, cast; (2) recommending OTHER movies similar to this one, especially by mood/attributes the user names ("more like this but gripping with a twist").
- If the user asks about anything unrelated (general chit-chat, other topics, coding, etc.), gently redirect back to the film.
- Do NOT reveal major spoilers unless the user explicitly asks (e.g. "spoil the ending"). If they ask a spoiler-y question without opting in, give a spoiler-free answer and offer to go deeper.
- Keep answers tight and conversational (2-5 sentences). A little wit is good.
- When you recommend specific movies, ALWAYS end your message with a fenced code block containing JSON of the form:
\`\`\`json
{"recommendations":[{"title":"Movie Name","year":"2019"},{"title":"Another","year":"2021"}]}
\`\`\`
Only include the block when you are actually recommending films. Put your conversational text BEFORE the block.`;
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
    const text = await callAnthropic({
      messages,
      system: buildSystem(movie, snippets || [], taste),
      maxTokens: 1024,
    });

    // Split conversational text from the optional recommendations JSON block.
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
