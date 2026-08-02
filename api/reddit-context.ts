import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_lib/http';
import { AI_LIMIT } from './_lib/rateLimit';
import { fetchRedditContext, snippetsToPromptBlock } from './_lib/reddit';
import { callAnthropic, extractJSON } from './_lib/anthropic';

const INSIGHTS_SYSTEM = `You are a film-savvy editor who reads Reddit movie discussions and distills what a film is *actually* known for among real viewers — directorial debuts, cultural moments, standout performances, controversies, "wait what happened" moments. You never spoil endings.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await guard(req, res, { methods: ['GET'], rateLimit: AI_LIMIT });
  if (!auth.ok) return;

  const title = typeof req.query.title === 'string' ? req.query.title : '';
  const year = typeof req.query.year === 'string' ? req.query.year : '';
  const genres = typeof req.query.genres === 'string' ? req.query.genres : '';

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const reddit = await fetchRedditContext(title, year);
    const groundingBlock = snippetsToPromptBlock(reddit.snippets);

    const prompt = `<task>
From the Reddit discussion below about the film, produce:
1. "knownForTags": 2-4 very short tags (max ~6 words each) capturing what this film is KNOWN FOR among viewers (e.g. "Zoë Kravitz's directorial debut", "divisive third act"). Phrase as noun phrases, not sentences.
2. "suggestedQuestions": 4-6 of the most commonly-asked / most-discussed questions a curious viewer would have. Make them punchy and specific to THIS film. No spoilers in the question text.
</task>

<film>
Title: "${title}"
Year: ${year || 'unknown'}
Genres: ${genres || 'unknown'}
</film>

<reddit_discussion>
${groundingBlock || '(No Reddit discussion available — infer from general knowledge of this film and what audiences typically ask about it.)'}
</reddit_discussion>

<rules>
- Ground tags/questions in the discussion when available; otherwise use general knowledge.
- NO spoilers.
- Output ONLY valid JSON, no markdown.
</rules>

<output_format>
{"knownForTags": ["...", "..."], "suggestedQuestions": ["...?", "...?"]}
</output_format>`;

    const text = await callAnthropic({
      messages: [{ role: 'user', content: prompt }],
      system: INSIGHTS_SYSTEM,
      maxTokens: 700,
    });

    const parsed = extractJSON<{ knownForTags?: string[]; suggestedQuestions?: string[] }>(text) || {};

    // Cache: insights are stable for a given film.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

    return res.status(200).json({
      knownForTags: Array.isArray(parsed.knownForTags) ? parsed.knownForTags.slice(0, 4) : [],
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 6) : [],
      // Public Reddit snippets returned so the chat can reuse them as grounding
      // without re-fetching on every message.
      snippets: reddit.snippets,
      blocked: reddit.blocked,
    });
  } catch (err: any) {
    console.error('reddit-context error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error', knownForTags: [], suggestedQuestions: [], snippets: [] });
  }
}
