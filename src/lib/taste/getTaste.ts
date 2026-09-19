import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { emptySnapshot, axisFromUnknown } from './buildRecommendContext';
import type { HistoryItem, LibraryStats, TastePick, TasteSnapshot } from './types';

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parsePicks(value: unknown): TastePick[] {
  if (!Array.isArray(value)) return [];
  const out: TastePick[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const title = typeof row.title === 'string' ? row.title : '';
    const movieIdRaw = row.movieId;
    const movieId = typeof movieIdRaw === 'number' ? movieIdRaw : Number(movieIdRaw);
    if (!title || !Number.isFinite(movieId)) continue;
    const pick: TastePick = {
      movieId,
      title,
      year: typeof row.year === 'string' || typeof row.year === 'number' ? row.year : '',
      poster: typeof row.poster === 'string' ? row.poster : '',
      whyMatch: typeof row.whyMatch === 'string' ? row.whyMatch : '',
      confidence: typeof row.confidence === 'number' ? row.confidence : 1,
    };
    if (typeof row.backdrop === 'string') pick.backdrop = row.backdrop;
    if (typeof row.runtime === 'string') pick.runtime = row.runtime;
    if (row.mediaType === 'tv' || row.mediaType === 'movie') pick.mediaType = row.mediaType;
    out.push(pick);
  }
  return out;
}

export function parseSnapshot(raw: unknown): TasteSnapshot {
  const empty = emptySnapshot();
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Record<string, unknown>;
  const identity = (data.identity && typeof data.identity === 'object' ? data.identity : {}) as Record<string, unknown>;
  const pointers = (data.pointers && typeof data.pointers === 'object' ? data.pointers : {}) as Record<string, unknown>;
  const context = (data.context && typeof data.context === 'object' ? data.context : {}) as Record<string, unknown>;
  const generated = (data.generated && typeof data.generated === 'object' ? data.generated : {}) as Record<string, unknown>;
  const constraints = (context.constraints && typeof context.constraints === 'object' ? context.constraints : {}) as Record<string, unknown>;
  const history: HistoryItem[] = [];
  if (Array.isArray(context.history)) {
    for (const item of context.history) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (typeof row.item !== 'string' || typeof row.rating !== 'number') continue;
      const next: HistoryItem = { item: row.item, rating: row.rating };
      if (typeof row.id === 'string') next.id = row.id;
      history.push(next);
    }
  }

  return {
    identity: {
      personaLine: typeof identity.personaLine === 'string' ? identity.personaLine : null,
      axis: axisFromUnknown(identity.axis),
    },
    pointers: {
      lastEventId: typeof pointers.lastEventId === 'string' ? pointers.lastEventId : null,
      calendarLogIds: asStringArray(pointers.calendarLogIds),
      watchlistIds: asStringArray(pointers.watchlistIds),
    },
    context: {
      preferences: asStringArray(context.preferences),
      profile: typeof context.profile === 'string' ? context.profile : '',
      constraints: {
        ...(asStringArray(constraints.exclude_genres).length
          ? { exclude_genres: asStringArray(constraints.exclude_genres) }
          : {}),
        ...(typeof constraints.max_length_minutes === 'number'
          ? { max_length_minutes: constraints.max_length_minutes }
          : {}),
      },
      history,
    },
    generated: {
      updatedAt: typeof generated.updatedAt === 'number' ? generated.updatedAt : null,
      fromEventId: typeof generated.fromEventId === 'string' ? generated.fromEventId : null,
      compactForChat: typeof generated.compactForChat === 'string' ? generated.compactForChat : '',
      patterns: asStringArray(generated.patterns),
      insightCards: asStringArray(generated.insightCards),
      lastPicks: parsePicks(generated.lastPicks),
      lastPicksAt: typeof generated.lastPicksAt === 'number' ? generated.lastPicksAt : null,
      library: parseLibraryStats(generated.library),
    },
  };
}

function parseLibraryStats(raw: unknown): LibraryStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.watched !== 'number') return null;
  return {
    watched: row.watched,
    rated: typeof row.rated === 'number' ? row.rated : 0,
    avgStars: typeof row.avgStars === 'number' ? row.avgStars : null,
    canon: asStringArray(row.canon),
    rewatches: asStringArray(row.rewatches),
    recent: asStringArray(row.recent),
    rejects: asStringArray(row.rejects),
    tags: asStringArray(row.tags),
    quotes: asStringArray(row.quotes),
  };
}

export function tasteDoc(uid: string) {
  return doc(db, 'users', uid, 'taste', 'current');
}

export async function getTaste(uid: string): Promise<TasteSnapshot> {
  const snap = await getDoc(tasteDoc(uid));
  if (!snap.exists()) return emptySnapshot();
  return parseSnapshot(snap.data());
}
