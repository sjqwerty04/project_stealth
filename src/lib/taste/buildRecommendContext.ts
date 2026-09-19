import { historyScore } from '../library/verdict';
import type { Verdict } from '../library/types';
import { normalizeFilmTitle } from './selectPickCoherence';
import {
  AXIS_PREFERENCE,
  HISTORY_LIMIT,
  PREFERENCE_LIMIT,
  type Axis,
  type DiaryEvidence,
  type HistoryItem,
  type LibraryStats,
  type RatedFilm,
  type RecommendContext,
  type TasteIdentity,
  type TasteSnapshot,
} from './types';

export function emptySnapshot(): TasteSnapshot {
  return {
    identity: { personaLine: null, axis: null },
    pointers: { lastEventId: null, calendarLogIds: [], watchlistIds: [] },
    context: { preferences: [], profile: '', constraints: {}, history: [] },
    generated: {
      updatedAt: null,
      fromEventId: null,
      compactForChat: '',
      patterns: [],
      insightCards: [],
      lastPicks: [],
      lastPicksAt: null,
    },
  };
}

/**
 * 1 to 5 score for history. Accepts a verdict, native stars, or the legacy thumbs.
 */
export function ratingToHistoryScore(
  rating: Verdict | 'up' | 'down' | number | null | undefined,
  stars?: number | null,
): number | null {
  if (rating === 'up') return historyScore('liked', stars);
  if (rating === 'down') return historyScore('nope', stars);
  if (typeof rating === 'number') return historyScore(null, rating);
  return historyScore(rating ?? null, stars);
}

function uniqPush(list: string[], value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  list.push(trimmed);
}

export function libraryLine(stats: LibraryStats | null | undefined): string {
  if (!stats || stats.watched === 0) return '';
  const parts: string[] = [];
  const avg = stats.avgStars != null ? `, avg ${stats.avgStars.toFixed(1)}` : '';
  parts.push(`Library: ${stats.watched} watched, ${stats.rated} rated${avg}.`);
  if (stats.canon.length) parts.push(`Canon: ${stats.canon.slice(0, 6).join(', ')}.`);
  if (stats.rewatches.length) parts.push(`Rewatches: ${stats.rewatches.slice(0, 4).join(', ')}.`);
  if (stats.recent.length) parts.push(`Recent: ${stats.recent.slice(0, 5).join(', ')}.`);
  if (stats.rejects.length) parts.push(`Avoid: ${stats.rejects.slice(0, 5).join(', ')}.`);
  if (stats.tags.length) parts.push(`Often tags ${stats.tags.slice(0, 4).join(' / ')}.`);
  if (stats.quotes.length) parts.push(`In their words: ${stats.quotes.slice(0, 2).map((q) => `"${q}"`).join(' ')}`);
  return parts.join(' ');
}

export function compactTaste(context: RecommendContext, identity: TasteIdentity, library?: LibraryStats | null): string {
  const parts: string[] = [];
  if (identity.personaLine) parts.push(identity.personaLine);
  if (identity.axis) parts.push(`Cares about ${identity.axis} first.`);
  if (context.profile && context.profile !== identity.personaLine) {
    parts.push(context.profile);
  }
  const lib = libraryLine(library);
  if (lib) parts.push(lib);
  const likes = context.preferences.filter((p) => !p.toLowerCase().startsWith('dislikes:'));
  const dislikes = context.preferences.filter((p) => p.toLowerCase().startsWith('dislikes:'));
  if (likes.length) parts.push(`Likes: ${likes.slice(0, 12).join('; ')}.`);
  if (dislikes.length) parts.push(`Avoid: ${dislikes.slice(0, 8).join('; ')}.`);
  const recent = context.history.slice(0, 8).map((h) => `${h.item} (${h.rating}/5)`);
  if (recent.length) parts.push(`Recent ratings: ${recent.join(', ')}.`);
  return parts.join(' ');
}

export type CalendarLogLike = {
  title: string;
  movieId?: number;
  year?: string | number;
  rating?: 'up' | 'down' | null;
  verdict?: Verdict | null;
  stars?: number | null;
  date?: string;
};

function verdictFromLog(log: CalendarLogLike): Verdict | null {
  if (log.verdict === 'liked' || log.verdict === 'okay' || log.verdict === 'nope') return log.verdict;
  if (log.rating === 'up') return 'liked';
  if (log.rating === 'down') return 'nope';
  return null;
}

export function contextFromCalendarLogs(logs: CalendarLogLike[]): RecommendContext {
  return buildRecommendContext({
    identity: { personaLine: null, axis: null },
    favorites: [],
    disliked: [],
    rated: logs
      .filter((log) => typeof log.title === 'string' && log.title.trim())
      .map((log) => ({
        title: log.title.trim(),
        movieId: typeof log.movieId === 'number' ? log.movieId : undefined,
        year: log.year,
        verdict: verdictFromLog(log),
        stars: log.stars ?? null,
        at: log.date ? Date.parse(log.date) || 0 : 0,
      })),
    watchlist: [],
    skipped: [],
    searches: [],
    patterns: [],
  });
}

function historyIdentity(item: HistoryItem): string {
  if (item.id) return `id:${item.id}`;
  return `title:${normalizeFilmTitle(item.item)}`;
}

export function mergeRecommendContext(
  diary: RecommendContext,
  snapshot: RecommendContext
): RecommendContext {
  const seen = new Set<string>();
  const history: HistoryItem[] = [];
  for (const item of [...snapshot.history, ...diary.history]) {
    const key = historyIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(item);
  }
  const preferences = snapshot.preferences.length ? snapshot.preferences : diary.preferences;
  const profile = snapshot.profile.trim() || diary.profile;
  return {
    preferences,
    profile,
    constraints: Object.keys(snapshot.constraints).length ? snapshot.constraints : diary.constraints,
    history: history.slice(0, HISTORY_LIMIT),
  };
}

export function hasMeaningfulContext(context: RecommendContext): boolean {
  return (
    context.preferences.length > 0 ||
    context.profile.trim().length > 0 ||
    context.history.length > 0
  );
}

export function selectConfidentPicks<T extends { confidence?: number }>(recs: T[], min = 0.5): T[] {
  return recs.filter((rec) => (rec.confidence ?? 1) >= min);
}

/** Unrated watches count as a 3 so the model knows the film was seen. */
function scoreOf(item: RatedFilm): number {
  return historyScore(item.verdict, item.stars) ?? 3;
}

function isCanon(item: RatedFilm): boolean {
  return item.hearted === true || (item.stars ?? 0) >= 4.5 || (item.watchCount ?? 0) >= 2;
}

/**
 * Pick at most HISTORY_LIMIT films in a deliberate mix: canon first, then the most
 * recent, then rejects, then the rest by recency. Titles dedupe case-insensitively.
 */
export function selectHistory(rated: RatedFilm[], limit = HISTORY_LIMIT): HistoryItem[] {
  const byRecency = [...rated].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const seen = new Set<string>();
  const out: HistoryItem[] = [];
  const push = (item: RatedFilm) => {
    const key = item.title.toLowerCase();
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({
      item: item.title,
      rating: scoreOf(item),
      ...(item.movieId != null ? { id: String(item.movieId) } : {}),
    });
  };
  const canonCap = Math.floor(limit * 0.3);
  const recentCap = Math.floor(limit * 0.4);
  const rejectCap = Math.floor(limit * 0.16);

  const canonPool = byRecency
    .filter((item) => isCanon(item) && item.verdict !== 'nope')
    .sort((a, b) => (b.stars ?? 0) + (b.watchCount ?? 0) - ((a.stars ?? 0) + (a.watchCount ?? 0)));
  let n = 0;
  for (const item of canonPool) {
    if (n >= canonCap) break;
    push(item);
    n++;
  }
  n = 0;
  for (const item of byRecency) {
    if (n >= recentCap) break;
    if (!seen.has(item.title.toLowerCase())) {
      push(item);
      n++;
    }
  }
  n = 0;
  for (const item of byRecency) {
    if (n >= rejectCap) break;
    if (item.verdict === 'nope' && !seen.has(item.title.toLowerCase())) {
      push(item);
      n++;
    }
  }
  for (const item of byRecency) push(item);
  return out;
}

const PLATFORM_TAGS = new Set(['plex', 'netflix', 'prime', 'hulu', 'disney', 'max', 'hbo', 'apple', 'tv', 'home', 'rewatch', 'cinema', 'theater', 'theatre', 'imax']);

export function meaningfulTags(tags: string[], cap = 5): string[] {
  const counts = new Map<string, number>();
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (!t || PLATFORM_TAGS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([t]) => t);
}

export function buildRecommendContext(evidence: DiaryEvidence): RecommendContext {
  const preferences: string[] = [];
  if (evidence.identity.axis) {
    uniqPush(preferences, AXIS_PREFERENCE[evidence.identity.axis]);
  }
  for (const film of evidence.favorites) {
    uniqPush(preferences, film.title);
  }
  for (const title of evidence.library?.canon.slice(0, 6) ?? []) {
    uniqPush(preferences, title);
  }
  for (const film of evidence.disliked) {
    uniqPush(preferences, `dislikes: ${film.title}`);
  }
  for (const film of evidence.skipped) {
    uniqPush(preferences, `dislikes: ${film.title}`);
  }
  for (const title of evidence.library?.rejects.slice(0, 5) ?? []) {
    uniqPush(preferences, `dislikes: ${title}`);
  }
  for (const film of evidence.watchlist.slice(0, 5)) {
    uniqPush(preferences, `something like ${film.title}`);
  }
  for (const film of (evidence.curious ?? []).slice(0, 5)) {
    uniqPush(preferences, `curious about ${film.title}`);
  }
  for (const query of evidence.searches.slice(0, 8)) {
    uniqPush(preferences, `something like ${query}`);
  }
  for (const tag of evidence.library?.tags.slice(0, 5) ?? []) {
    uniqPush(preferences, `often tags ${tag}`);
  }

  const history = selectHistory(evidence.rated);

  const profile =
    evidence.identity.personaLine ||
    (evidence.identity.axis ? `Cares about ${evidence.identity.axis} first.` : '');

  return {
    preferences: preferences.slice(0, PREFERENCE_LIMIT),
    profile,
    constraints: {},
    history,
  };
}

export function withCompact(snapshot: TasteSnapshot, library?: LibraryStats | null): TasteSnapshot {
  return {
    ...snapshot,
    generated: {
      ...snapshot.generated,
      compactForChat: compactTaste(snapshot.context, snapshot.identity, library ?? snapshot.generated.library ?? null),
    },
  };
}

export function axisFromUnknown(value: unknown): Axis | null {
  if (value === 'story' || value === 'visual' || value === 'mood') return value;
  return null;
}
