import {
  AXIS_PREFERENCE,
  HISTORY_LIMIT,
  PREFERENCE_LIMIT,
  type Axis,
  type DiaryEvidence,
  type HistoryItem,
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

export function ratingToHistoryScore(
  rating: 'up' | 'down' | number | null | undefined
): number | null {
  if (rating === 'up') return 5;
  if (rating === 'down') return 1;
  if (typeof rating === 'number' && Number.isFinite(rating)) {
    const scaled = rating > 5 ? rating / 2 : rating;
    return Math.max(1, Math.min(5, Math.round(scaled)));
  }
  return null;
}

function uniqPush(list: string[], value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  list.push(trimmed);
}

export function compactTaste(context: RecommendContext, identity: TasteIdentity): string {
  const parts: string[] = [];
  if (identity.personaLine) parts.push(identity.personaLine);
  if (identity.axis) parts.push(`Cares about ${identity.axis} first.`);
  if (context.profile && context.profile !== identity.personaLine) {
    parts.push(context.profile);
  }
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
  date?: string;
};

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
        rating: log.rating === 'up' || log.rating === 'down' ? log.rating : 3,
        at: log.date ? Date.parse(log.date) || 0 : 0,
      })),
    watchlist: [],
    skipped: [],
    searches: [],
    patterns: [],
  });
}

export function mergeRecommendContext(
  diary: RecommendContext,
  snapshot: RecommendContext
): RecommendContext {
  const history = diary.history.length ? diary.history : snapshot.history;
  const preferences = snapshot.preferences.length ? snapshot.preferences : diary.preferences;
  const profile = snapshot.profile.trim() || diary.profile;
  return {
    preferences,
    profile,
    constraints: Object.keys(snapshot.constraints).length ? snapshot.constraints : diary.constraints,
    history,
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

export function buildRecommendContext(evidence: DiaryEvidence): RecommendContext {
  const preferences: string[] = [];
  if (evidence.identity.axis) {
    uniqPush(preferences, AXIS_PREFERENCE[evidence.identity.axis]);
  }
  for (const film of evidence.favorites) {
    uniqPush(preferences, film.title);
  }
  for (const film of evidence.disliked) {
    uniqPush(preferences, `dislikes: ${film.title}`);
  }
  for (const film of evidence.skipped) {
    uniqPush(preferences, `dislikes: ${film.title}`);
  }
  for (const film of evidence.watchlist.slice(0, 5)) {
    uniqPush(preferences, `something like ${film.title}`);
  }
  for (const query of evidence.searches.slice(0, 8)) {
    uniqPush(preferences, `something like ${query}`);
  }

  const history: HistoryItem[] = [];
  const seen = new Set<string>();
  const rated = [...evidence.rated].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  for (const item of rated) {
    const score = ratingToHistoryScore(item.rating);
    if (score == null) continue;
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    history.push({
      item: item.title,
      rating: score,
      ...(item.movieId != null ? { id: String(item.movieId) } : {}),
    });
    if (history.length >= HISTORY_LIMIT) break;
  }

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

export function withCompact(snapshot: TasteSnapshot): TasteSnapshot {
  return {
    ...snapshot,
    generated: {
      ...snapshot.generated,
      compactForChat: compactTaste(snapshot.context, snapshot.identity),
    },
  };
}

export function axisFromUnknown(value: unknown): Axis | null {
  if (value === 'story' || value === 'visual' || value === 'mood') return value;
  return null;
}
