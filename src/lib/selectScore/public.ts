import { emptyPublicScores, SOURCE_KEYS, type PublicScore, type PublicScores, type SourceKey } from './types.js';

export type QueueStats = {
  liked: number;
  loved: number;
  meh: number;
  disliked: number;
};

const SOURCE_ALIAS: Record<string, SourceKey> = {
  imdb: 'imdb',
  letterboxd: 'letterboxd',
  tomatoes: 'tomatoes',
  tomatoesaudience: 'audience',
  metacritic: 'metacritic',
};

export function queueSlug(title: string, year: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = year.trim();
  return trimmed ? `${base}-${trimmed}` : base;
}

export function queuePercent(stats: QueueStats): { value: number; count: number } | null {
  const count = stats.liked + stats.loved + stats.meh + stats.disliked;
  if (!(count > 0)) return null;
  return { value: Math.round(((stats.liked + stats.loved) / count) * 100), count };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A') return null;
  const parsed = Number.parseFloat(trimmed.replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isStats(value: unknown): value is QueueStats {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['liked', 'loved', 'meh', 'disliked'].every((key) => typeof row[key] === 'number' && Number.isFinite(row[key]));
}

export function findQueueStats(data: unknown): QueueStats | null {
  const stack: unknown[] = [data];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (isStats(node)) {
      return { liked: node.liked, loved: node.loved, meh: node.meh, disliked: node.disliked };
    }
    if (Array.isArray(node)) stack.push(...node);
    else stack.push(...Object.values(node));
  }
  return null;
}

type DehydratedQuery = {
  queryKey?: unknown;
  state?: { data?: unknown };
};

function dehydratedQueries(data: unknown): DehydratedQuery[] {
  const stack: unknown[] = [data];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every((item) => item && typeof item === 'object' && 'queryKey' in (item as object))) {
        return node as DehydratedQuery[];
      }
      stack.push(...node);
      continue;
    }
    stack.push(...Object.values(node as Record<string, unknown>));
  }
  return [];
}

/** Title id and the embedded feed stats for this slug, when the page already dehydrated them. */
export function queueFromNextData(data: unknown, slug: string): { id: string | null; score: { value: number; count: number } | null } {
  const film = `movies/${slug}`;
  let id: string | null = null;
  let score: { value: number; count: number } | null = null;
  for (const query of dehydratedQueries(data)) {
    if (!Array.isArray(query.queryKey)) continue;
    const [kind, name, path] = query.queryKey;
    if (path !== film) continue;
    if (kind === 'title' && name === 'get') {
      const row = query.state?.data;
      if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
        id = (row as { id: string }).id;
      }
    }
    if (kind === 'review' && name === 'stats') {
      const stats = findQueueStats(query.state?.data);
      if (stats) score = queuePercent(stats);
    }
  }
  return { id, score };
}

export function extractNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

function nativeValue(key: SourceKey, value: number): number {
  if (key === 'letterboxd' && value > 5 && value <= 100) return (value / 100) * 5;
  if (key === 'imdb' && value > 10 && value <= 100) return value / 10;
  return value;
}

function readRatings(json: unknown): Partial<PublicScores> {
  if (!json || typeof json !== 'object') return {};
  const ratings = (json as { ratings?: unknown }).ratings;
  if (!Array.isArray(ratings)) return {};
  const out: Partial<PublicScores> = {};
  for (const row of ratings) {
    if (!row || typeof row !== 'object') continue;
    const source = String((row as { source?: unknown }).source ?? '').toLowerCase();
    const key = SOURCE_ALIAS[source];
    if (!key) continue;
    const value = asNumber((row as { value?: unknown }).value);
    if (value == null) continue;
    const votes = asNumber((row as { votes?: unknown }).votes);
    out[key] = { value: nativeValue(key, value), count: votes == null ? null : Math.round(votes) };
  }
  return out;
}

export function mapMdbList(json: unknown): Partial<PublicScores> {
  return readRatings(json);
}

export function mapOmdb(json: unknown): Partial<PublicScores> {
  if (!json || typeof json !== 'object') return {};
  const row = json as Record<string, unknown>;
  if (row.Response === 'False') return {};
  const out: Partial<PublicScores> = {};
  const imdb = asNumber(row.imdbRating);
  if (imdb != null) {
    const votes = asNumber(row.imdbVotes);
    out.imdb = { value: nativeValue('imdb', imdb), count: votes == null ? null : Math.round(votes) };
  }
  const metacritic = asNumber(row.Metascore);
  if (metacritic != null) out.metacritic = { value: metacritic, count: null };
  if (Array.isArray(row.Ratings)) {
    for (const entry of row.Ratings) {
      if (!entry || typeof entry !== 'object') continue;
      const source = String((entry as { Source?: unknown }).Source ?? '');
      const value = asNumber((entry as { Value?: unknown }).Value);
      if (value == null) continue;
      if (source === 'Rotten Tomatoes') out.tomatoes = { value, count: null };
    }
  }
  return out;
}

function aggregateFrom(node: unknown): PublicScore | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = aggregateFrom(item);
      if (found) return found;
    }
    return null;
  }
  const row = node as Record<string, unknown>;
  const aggregate = row.aggregateRating;
  if (aggregate && typeof aggregate === 'object') {
    const value = asNumber((aggregate as { ratingValue?: unknown }).ratingValue);
    if (value != null) {
      const count = asNumber((aggregate as { ratingCount?: unknown }).ratingCount);
      return { value, count: count == null ? null : Math.round(count) };
    }
  }
  for (const value of Object.values(row)) {
    const found = aggregateFrom(value);
    if (found) return found;
  }
  return null;
}

export function letterboxdFromHtml(html: string): PublicScore | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const found = aggregateFrom(JSON.parse(block[1]) as unknown);
      if (found) return found;
    } catch {
      // The next JSON-LD block may still parse.
    }
  }
  const rating = html.match(/"ratingValue":\s*"?([\d.]+)"?/);
  if (!rating) return null;
  const value = Number.parseFloat(rating[1]);
  if (!Number.isFinite(value)) return null;
  const countMatch = html.match(/"ratingCount":\s*"?([\d,]+)"?/);
  const count = countMatch ? Number.parseInt(countMatch[1].replace(/,/g, ''), 10) : null;
  return { value, count: count != null && Number.isFinite(count) ? count : null };
}

export function mergePublicScores(layers: Array<Partial<PublicScores>>): PublicScores {
  const out = emptyPublicScores();
  for (const key of SOURCE_KEYS) {
    for (const layer of layers) {
      const row = layer[key];
      if (row && typeof row.value === 'number' && Number.isFinite(row.value)) {
        out[key] = { value: row.value, count: row.count ?? null };
        break;
      }
    }
  }
  return out;
}

export function hasAnyScore(scores: PublicScores): boolean {
  return SOURCE_KEYS.some((key) => scores[key].value != null);
}

export function cacheControlFor(scores: PublicScores): string {
  return hasAnyScore(scores) ? 'public, s-maxage=43200' : 'public, s-maxage=60';
}

function clientNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/%/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fill IMDb, Tomatometer, and Metacritic holes from the OMDb payload the movie page already loaded. */
export function fillClientRatings(
  scores: PublicScores,
  client: { imdb?: string | null; rottenTomatoes?: string | null; metacritic?: string | null } | null | undefined,
): PublicScores {
  if (!client) return scores;
  const next: PublicScores = {
    letterboxd: { ...scores.letterboxd },
    imdb: { ...scores.imdb },
    tomatoes: { ...scores.tomatoes },
    audience: { ...scores.audience },
    metacritic: { ...scores.metacritic },
    queue: { ...scores.queue },
  };
  if (next.imdb.value == null) {
    const value = clientNumber(client.imdb);
    if (value != null) next.imdb = { value, count: null };
  }
  if (next.tomatoes.value == null) {
    const value = clientNumber(client.rottenTomatoes);
    if (value != null) next.tomatoes = { value, count: null };
  }
  if (next.metacritic.value == null) {
    const value = clientNumber(client.metacritic);
    if (value != null) next.metacritic = { value, count: null };
  }
  return next;
}

export function parsePublicScores(json: unknown): PublicScores {
  const out = emptyPublicScores();
  if (!json || typeof json !== 'object') return out;
  const row = json as Record<string, unknown>;
  for (const key of SOURCE_KEYS) {
    const source = row[key];
    if (!source || typeof source !== 'object') continue;
    const value = asNumber((source as { value?: unknown }).value);
    const count = asNumber((source as { count?: unknown }).count);
    out[key] = { value, count: count == null ? null : Math.round(count) };
  }
  return out;
}
