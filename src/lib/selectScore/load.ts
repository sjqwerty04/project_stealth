import {
  extractNextData,
  findQueueStats,
  letterboxdFromHtml,
  mapMdbList,
  mapOmdb,
  mergePublicScores,
  queueFromNextData,
  queuePercent,
  queueSlug,
} from './public.js';
import type { PublicScore, PublicScores } from './types.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export type SelectScoreRequest = {
  imdbId: string;
  tmdbId: string;
  title: string;
  year: string;
};

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  return { ok: response.ok, status: response.status, text: await response.text(), finalUrl: response.url };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetchText(url);
    if (!response.ok) return null;
    return JSON.parse(response.text) as unknown;
  } catch {
    return null;
  }
}

async function loadMdbList(imdbId: string): Promise<Partial<PublicScores>> {
  const key = process.env.MDBLIST_API_KEY || '';
  if (!key || !imdbId) return {};
  const json = await fetchJson(`https://api.mdblist.com/imdb/${encodeURIComponent(imdbId)}?apikey=${encodeURIComponent(key)}`);
  return mapMdbList(json);
}

async function loadOmdb(imdbId: string): Promise<Partial<PublicScores>> {
  const key = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
  if (!key || !imdbId) return {};
  const json = await fetchJson(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`);
  return mapOmdb(json);
}

async function loadLetterboxd(tmdbId: string, title: string, year: string): Promise<PublicScore | null> {
  const slug = title ? queueSlug(title, year) : '';
  const candidates = [
    slug ? `https://letterboxd.com/film/${slug}/` : '',
    tmdbId ? `https://letterboxd.com/tmdb/${encodeURIComponent(tmdbId)}/` : '',
  ].filter(Boolean);
  for (const url of candidates) {
    try {
      const page = await fetchText(url);
      if (!page.ok && page.status !== 200) continue;
      if (page.finalUrl.includes('/tmdb/')) continue;
      const parsed = letterboxdFromHtml(page.text);
      if (parsed) return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  if (!title) return null;
  try {
    const search = await fetchText(`https://letterboxd.com/search/films/${encodeURIComponent(`${title} ${year}`)}/`);
    if (!search.ok) return null;
    const slugMatch = search.text.match(/href="(\/film\/[^/"]+\/)"/);
    if (!slugMatch) return null;
    const film = await fetchText(`https://letterboxd.com${slugMatch[1]}`);
    if (!film.ok) return null;
    return letterboxdFromHtml(film.text);
  } catch {
    return null;
  }
}

async function loadQueue(title: string, year: string): Promise<PublicScore | null> {
  if (!title) return null;
  const slug = queueSlug(title, year);
  let page: Awaited<ReturnType<typeof fetchText>> | null = null;
  for (const candidate of [slug, `${slug}-1`]) {
    try {
      const next = await fetchText(`https://www.queue.co/movies/${candidate}`);
      if (next.ok) {
        page = next;
        break;
      }
    } catch {
      // A collided slug may still resolve with a -1 suffix.
    }
  }
  if (!page) return null;
  const data = extractNextData(page.text);
  const embedded = data ? queueFromNextData(data, slug) : { id: null, score: null };
  const collided = data ? queueFromNextData(data, `${slug}-1`) : { id: null, score: null };
  const id = embedded.id || collided.id;
  if (id) {
    const live = await fetchJson(`https://api.queue.co/public/titles/${encodeURIComponent(id)}/feed/stats`);
    const stats = findQueueStats(live);
    const score = stats ? queuePercent(stats) : null;
    if (score) return score;
  }
  return embedded.score || collided.score;
}

export async function loadSelectScores(input: SelectScoreRequest): Promise<PublicScores> {
  const [mdb, omdb, letterboxd, queue] = await Promise.all([
    loadMdbList(input.imdbId).catch(() => ({})),
    loadOmdb(input.imdbId).catch(() => ({})),
    loadLetterboxd(input.tmdbId, input.title, input.year).catch(() => null),
    loadQueue(input.title, input.year).catch(() => null),
  ]);

  return mergePublicScores([mdb, omdb, letterboxd ? { letterboxd } : {}, queue ? { queue } : {}]);
}
