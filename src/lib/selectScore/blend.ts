import { SOURCE_KEYS, type SourceKey } from './types';

/** Room weights sum to 60. For you is 40 when it exists. */
export const ROOM_WEIGHTS: Record<SourceKey, number> = {
  letterboxd: 18,
  queue: 12,
  imdb: 10,
  audience: 8,
  tomatoes: 6,
  metacritic: 6,
};

export const FOR_YOU_WEIGHT = 40;

export type BlendSource = {
  key: SourceKey;
  native: number | null;
  count: number | null;
};

export type BlendRow = {
  key: SourceKey;
  native: number | null;
  normalized: number | null;
  count: number | null;
  thin: boolean;
  used: boolean;
  weight: number;
};

export type BlendResult = {
  score: number | null;
  /** Mean before rounding. Null when nothing was blended. */
  weighted: number | null;
  rows: BlendRow[];
};

const THIN_KEYS = new Set<SourceKey>(['letterboxd', 'queue']);

export function normalizeSource(key: SourceKey, native: number): number {
  if (key === 'letterboxd') return (native / 5) * 100;
  if (key === 'imdb') return (native / 10) * 100;
  return native;
}

export function isThinSample(key: SourceKey, count: number | null): boolean {
  if (!THIN_KEYS.has(key) || count == null) return false;
  return count < 50;
}

export function formatNative(key: SourceKey, value: number): string {
  if (key === 'letterboxd') return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  if (key === 'imdb') {
    const text = value.toFixed(1);
    return text.endsWith('.0') ? text.slice(0, -2) : text;
  }
  return String(Math.round(value));
}

function usable(source: BlendSource | undefined): source is BlendSource & { native: number } {
  return source != null && typeof source.native === 'number' && Number.isFinite(source.native) && !isThinSample(source.key, source.count);
}

/**
 * One integer. A missing or thin source is dropped and the remaining room
 * weights are scaled back to 60 (or to 100 when there is no For you).
 * A missing source is never scored as 0.
 */
export function blendSelect(forYou: number | null, sources: BlendSource[]): BlendResult {
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const present = SOURCE_KEYS.filter((key) => usable(byKey.get(key)));
  const roomSum = present.reduce((sum, key) => sum + ROOM_WEIGHTS[key], 0);
  const forYouOk = typeof forYou === 'number' && Number.isFinite(forYou);

  let scale = 0;
  let forYouWeight = 0;
  if (forYouOk && roomSum > 0) {
    scale = 60 / roomSum;
    forYouWeight = FOR_YOU_WEIGHT;
  } else if (!forYouOk && roomSum > 0) {
    scale = 100 / roomSum;
  } else if (forYouOk) {
    forYouWeight = 100;
  }

  const rows: BlendRow[] = SOURCE_KEYS.map((key) => {
    const source = byKey.get(key);
    const native = source && typeof source.native === 'number' && Number.isFinite(source.native) ? source.native : null;
    const count = source?.count ?? null;
    const thin = native != null && isThinSample(key, count);
    const used = present.includes(key) && scale > 0;
    return {
      key,
      native,
      normalized: native == null ? null : normalizeSource(key, native),
      count,
      thin,
      used,
      weight: used ? ROOM_WEIGHTS[key] * scale : 0,
    };
  });

  if (!forYouOk && roomSum === 0) return { score: null, weighted: null, rows };

  let total = forYouOk ? forYouWeight * (forYou as number) : 0;
  let weight = forYouWeight;
  for (const row of rows) {
    if (!row.used || row.normalized == null) continue;
    total += row.weight * row.normalized;
    weight += row.weight;
  }
  if (weight <= 0) return { score: null, weighted: null, rows };
  const mean = total / weight;
  return { score: Math.max(0, Math.min(100, Math.round(mean))), weighted: mean, rows };
}
