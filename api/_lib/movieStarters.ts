import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, extractJSON } from './xai.js';
import { tmdb, toFilm, searchFilm, type RawTmdb, type TmdbFilm } from './tmdb.js';
import { fetchRedditContext, snippetsToPromptBlock } from './reddit.js';
import { buildStarters, type FilmRef, type Starter } from '../../src/lib/askAi/starters.js';

type Details = RawTmdb & {
  overview?: string;
  genres?: { name: string }[];
  credits?: { crew?: { job?: string; name?: string }[]; cast?: { name: string; character?: string }[] };
  created_by?: { name?: string }[];
  recommendations?: { results?: RawTmdb[] };
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  belongs_to_collection?: { id: number } | null;
};

export const STARTERS_VERSION = 3;
const LLM_BUDGET_MS = 22000;

const SYSTEM = `You write the starter questions under one film. Each question is a door into one specific thing people have already said about THIS film on X or Reddit. The question should be unaskable about a different film. Punchy, curious, the kind of thing someone would actually post. No hashtags, emojis, or em dashes. A non-spoiler question does not give away the plot.`;

type LlmOut = {
  questions?: { q: string; claim?: string; films?: string[]; spoiler?: boolean }[];
};

function prompt(film: TmdbFilm, meta: { director?: string | null; cast: string[]; overview: string; reddit: string }) {
  return `<film>
${film.title} (${film.year || 'n/a'}), directed by ${meta.director || 'unknown'}
Cast: ${meta.cast.join(', ') || 'unknown'}
Overview: ${meta.overview || 'n/a'}
</film>
<reddit>
${meta.reddit || '(no Reddit excerpts)'}
</reddit>
<task>
Search X and the web for what people are actually saying about this film. Use that plus the Reddit excerpts. Ignore a line that is only a plot summary.
Write 4 or 5 questions. Each one opens a single concrete detail: a place, a news moment, a performance choice, a line people quote, a production fact, or a comparison people are already making.
"claim" is the one or two sentence write-up the answer should give. It states the detail. It is not a second question.
"films" lists a title only when that title appears in the question. Leave it empty when the question names no other film. Do not add a second film so the question can show a poster. A comparison is allowed only when the posts compare the two films.
Do not ask what the film is about, whether it is the director's best work, whether a performance is a career best, whether it is worth the hype, or what to watch next.
One question may be about the ending, with "spoiler": true, and only if people are actually arguing about the ending.
Each question is under 90 characters.
</task>
Output ONLY JSON: {"questions":[{"q":"...","claim":"...","films":[],"spoiler":false}]}`;
}

/** GET /api/movie-starters. Served by the movie-chat function so the deploy stays within the function cap. */
export async function handleMovieStarters(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = Number(req.query.id);
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id is required' });

  const hintedTitle = typeof req.query.title === 'string' ? req.query.title.trim() : '';
  const hintedYear = typeof req.query.year === 'string' ? req.query.year.trim() : '';
  const started = Date.now();

  const [details, hintedReddit] = await Promise.all([
    tmdb<Details>(`/${type}/${id}`, { append_to_response: 'credits,recommendations' }),
    hintedTitle ? fetchRedditContext(hintedTitle, hintedYear) : Promise.resolve(null),
  ]);
  if (!details) return res.status(404).json({ error: 'film not found' });

  const film = toFilm(details)!;
  const director =
    type === 'movie'
      ? details.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null
      : details.created_by?.[0]?.name ?? null;
  const castRows = (details.credits?.cast || []).slice(0, 4);
  const related = (details.recommendations?.results || []).slice(0, 8).map(toFilm).filter((f): f is TmdbFilm => !!f);

  const titleMatches = hintedTitle.toLowerCase() === film.title.toLowerCase();
  const reddit = titleMatches && hintedReddit ? hintedReddit : await fetchRedditContext(film.title, film.year);
  const redditBlock = snippetsToPromptBlock(reddit.snippets, 1800);

  const byTitle = new Map<string, FilmRef>([film, ...related].map((f) => [f.title.toLowerCase(), f]));
  const resolve = async (title: string): Promise<FilmRef | null> => byTitle.get(title.toLowerCase()) || (await searchFilm(title));

  let questions: { text: string; films: FilmRef[]; brief?: string; spoiler?: boolean }[] = [];
  let source: 'llm' | 'empty' = 'empty';
  try {
    const text = await callXai({
      system: SYSTEM,
      reasoningEffort: 'low',
      maxTokens: 700,
      timeoutMs: LLM_BUDGET_MS,
      webSearch: true,
      messages: [
        {
          role: 'user',
          content: prompt(film, {
            director,
            cast: castRows.map((c) => (c.character ? `${c.name} (${c.character})` : c.name)),
            overview: details.overview || '',
            reddit: redditBlock,
          }),
        },
      ],
    });
    const parsed = extractJSON<LlmOut>(text);
    if (parsed?.questions?.length) {
      questions = await Promise.all(
        parsed.questions.slice(0, 8).map(async (q) => {
          const asked = (q.q || '').toLowerCase();
          const titles = (q.films || []).filter((t) => t && asked.includes(t.toLowerCase())).slice(0, 2);
          const films = (await Promise.all(titles.map(resolve))).filter(Boolean) as FilmRef[];
          return { text: q.q, brief: q.claim, spoiler: !!q.spoiler, films };
        }),
      );
      source = 'llm';
    }
  } catch (err) {
    console.error('movie-starters llm fallback:', err instanceof Error ? err.message : err);
  }

  const starters: Starter[] = buildStarters({ film, related, questions });
  if (!starters.length) source = 'empty';

  const cache =
    source === 'llm'
      ? 'public, s-maxage=604800, stale-while-revalidate=2592000'
      : 'public, s-maxage=600, stale-while-revalidate=60';
  res.setHeader('Cache-Control', cache);
  res.setHeader('CDN-Cache-Control', cache);
  return res.status(200).json({
    version: STARTERS_VERSION,
    tmdbId: id,
    type,
    source,
    generatedAt: new Date().toISOString(),
    buildMs: Date.now() - started,
    starters,
  });
}
