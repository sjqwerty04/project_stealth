import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callXai, extractJSON } from './_lib/xai.js';
import { tmdb, toFilm, searchFilm, type RawTmdb, type TmdbFilm } from './_lib/tmdb.js';

type Details = RawTmdb & {
  overview?: string;
  genres?: { name: string }[];
  credits?: { crew?: { job?: string; name?: string }[]; cast?: { name: string; character?: string }[] };
  created_by?: { name?: string }[];
  recommendations?: { results?: RawTmdb[] };
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  belongs_to_collection?: { id: number } | null;
};
import { buildStarters, type FilmRef, type Starter } from '../src/lib/askAi/starters.js';

export const STARTERS_VERSION = 2;
const LLM_BUDGET_MS = 6000;

const SYSTEM = `You write the starter questions under a film in a movie app. They read like posts on film X (Twitter): punchy, curious, opinionated, specific to this film. Never generic. No hashtags, emojis, or em dashes. Never spoil the plot in a non-spoiler question.`;

type LlmOut = {
  compareOrder?: string[];
  questions?: { q: string; films?: string[]; spoiler?: boolean }[];
};

function prompt(film: TmdbFilm, meta: { director?: string | null; cast: string[]; genres: string[]; overview: string; candidates: TmdbFilm[] }) {
  return `<film>
${film.title} (${film.year || 'n/a'}), directed by ${meta.director || 'unknown'}
Cast: ${meta.cast.join(', ') || 'unknown'}
Genres: ${meta.genres.join(', ') || 'unknown'}
Overview: ${meta.overview || 'n/a'}
</film>
<candidates>
${meta.candidates.map((c) => `${c.title} (${c.year || 'n/a'})`).join('\n') || '(none)'}
</candidates>
<task>
1. "compareOrder": up to 3 titles from <candidates>, best head-to-head comparison first (closest in tone and premise, not just same genre).
2. "questions": 5 questions people would actually post about this film, each under 60 characters:
   - one head-to-head with your top compareOrder film, naming both films
   - one about what it means or a moment everyone talks about
   - one about the director or a lead performance, naming them
   - one debate or hot take
   - one about context or what to watch next
   Then one more about the ending with "spoiler": true.
   "films" lists the exact film titles named in that question.
</task>
Output ONLY JSON: {"compareOrder":["..."],"questions":[{"q":"...","films":["..."],"spoiler":false}]}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = Number(req.query.id);
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id is required' });

  const started = Date.now();
  const details = await tmdb<Details>(`/${type}/${id}`, { append_to_response: 'credits,keywords,recommendations' });
  if (!details) return res.status(404).json({ error: 'film not found' });

  const film = toFilm(details)!;
  const director =
    type === 'movie'
      ? details.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null
      : details.created_by?.[0]?.name ?? null;
  const castRows = (details.credits?.cast || []).slice(0, 4);
  const related = (details.recommendations?.results || []).slice(0, 8).map(toFilm).filter((f): f is TmdbFilm => !!f);

  let collection: TmdbFilm[] = [];
  if (details.belongs_to_collection?.id) {
    const c = await tmdb<{ parts?: RawTmdb[] }>(`/collection/${details.belongs_to_collection.id}`);
    collection = (c?.parts || [])
      .filter((p) => p.release_date)
      .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
      .map(toFilm)
      .filter((f): f is TmdbFilm => !!f);
  }

  const candidates = [...collection.filter((c) => c.id !== film.id), ...related];
  const byTitle = new Map<string, FilmRef>([film, ...candidates].map((f) => [f.title.toLowerCase(), f]));
  const resolve = async (title: string): Promise<FilmRef | null> =>
    byTitle.get(title.toLowerCase()) || (await searchFilm(title));

  let llm: { text: string; films: FilmRef[]; spoiler?: boolean }[] = [];
  let reranked = related;
  let source: 'llm' | 'template' = 'template';
  try {
    const text = await callXai({
      system: SYSTEM,
      reasoningEffort: 'low',
      maxTokens: 700,
      timeoutMs: LLM_BUDGET_MS,
      messages: [
        {
          role: 'user',
          content: prompt(film, {
            director,
            cast: castRows.map((c) => c.name),
            genres: (details.genres || []).map((g) => g.name),
            overview: details.overview || '',
            candidates,
          }),
        },
      ],
    });
    const parsed = extractJSON<LlmOut>(text);
    if (parsed?.questions?.length) {
      const order = (parsed.compareOrder || []).map((t) => byTitle.get(t.toLowerCase())).filter(Boolean) as TmdbFilm[];
      reranked = [...order, ...related.filter((r) => !order.some((o) => o.id === r.id))];
      llm = await Promise.all(
        parsed.questions.slice(0, 6).map(async (q) => ({
          text: q.q,
          spoiler: !!q.spoiler,
          films: ((await Promise.all((q.films || []).slice(0, 2).map(resolve))).filter(Boolean) as FilmRef[]),
        })),
      );
      source = 'llm';
    }
  } catch (err) {
    console.error('movie-starters llm fallback:', err instanceof Error ? err.message : err);
  }

  const starters: Starter[] = buildStarters({
    film,
    genres: (details.genres || []).map((g) => g.name),
    director,
    cast: castRows,
    collection,
    related: reranked,
    keywords: ((details.keywords?.keywords || details.keywords?.results || []) as { name: string }[]).map((k) => k.name),
    llm,
  });

  // LLM sets are stable for a week; a template fallback is retried soon so the LLM set replaces it.
  res.setHeader(
    'Cache-Control',
    source === 'llm' ? 'public, s-maxage=604800, stale-while-revalidate=2592000' : 'public, s-maxage=300',
  );
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
