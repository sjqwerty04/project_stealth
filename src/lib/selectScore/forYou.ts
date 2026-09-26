import type { HistoryItem, LibraryStats, TastePick } from '../taste/types';

export type ForYouInput = {
  movieId?: number | null;
  title: string;
  stars?: number | null;
  history?: HistoryItem[];
  lastPicks?: Array<Pick<TastePick, 'movieId' | 'confidence'>>;
  library?: Pick<LibraryStats, 'canon' | 'rejects' | 'recent'> | null;
};

type Signal = { s: number; w: number };

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function historyMatch(input: ForYouInput): HistoryItem | undefined {
  const history = input.history ?? [];
  if (input.movieId != null) {
    const byId = history.find((item) => item.id === String(input.movieId));
    if (byId) return byId;
  }
  const title = norm(input.title);
  if (!title) return undefined;
  return history.find((item) => norm(item.item) === title);
}

function listed(titles: string[] | undefined, title: string): boolean {
  if (!titles?.length || !title) return false;
  return titles.some((item) => norm(item) === title);
}

/**
 * The score's only read of the taste snapshot. Stars the person already gave
 * replace every other signal. With no signal at all, the result is null and
 * the room takes the whole Select score.
 */
export function forYouScore(input: ForYouInput): number | null {
  if (typeof input.stars === 'number' && Number.isFinite(input.stars)) {
    return clamp((input.stars / 5) * 100);
  }

  const signals: Signal[] = [];
  const history = historyMatch(input);
  if (history && [1, 2, 4, 5].includes(history.rating)) {
    signals.push({ s: (history.rating / 5) * 100, w: 0.8 });
  }

  if (input.movieId != null) {
    const pick = (input.lastPicks ?? []).find((item) => item.movieId === input.movieId);
    if (pick) {
      const confidence = pick.confidence ?? 1;
      if (confidence >= 0.5) signals.push({ s: Math.max(0, Math.min(1, confidence)) * 100, w: 0.7 });
    }
  }

  const title = norm(input.title);
  const library = input.library;
  if (listed(library?.canon, title)) signals.push({ s: 92, w: 0.55 });
  else if (listed(library?.rejects, title)) signals.push({ s: 15, w: 0.55 });
  else if (listed(library?.recent, title)) signals.push({ s: 68, w: 0.25 });

  if (!signals.length) return null;
  const weight = signals.reduce((sum, signal) => sum + signal.w, 0);
  const total = signals.reduce((sum, signal) => sum + signal.w * signal.s, 0);
  return clamp(total / weight);
}
