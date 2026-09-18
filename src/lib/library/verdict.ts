import type { Verdict } from './types';

/** Letterboxd stars 0.5 to 5. A heart always reads as liked. */
export function verdictFromStars(stars: number | null | undefined, hearted = false): Verdict | null {
  if (hearted) return 'liked';
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return null;
  if (stars >= 3.5) return 'liked';
  if (stars <= 2) return 'nope';
  return 'okay';
}

/** IMDb 1 to 10. */
export function verdictFromImdb(score: number | null | undefined): Verdict | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= 7) return 'liked';
  if (score <= 4) return 'nope';
  return 'okay';
}

/** Firestore docs written before the verdict model carry rating 'up' | 'down'. */
export function verdictFromLegacy(rating: unknown): Verdict | null {
  if (rating === 'up') return 'liked';
  if (rating === 'down') return 'nope';
  return null;
}

export function isVerdict(value: unknown): value is Verdict {
  return value === 'liked' || value === 'okay' || value === 'nope';
}

/** Read the verdict off any stored doc, new or legacy. */
export function verdictOf(data: { verdict?: unknown; rating?: unknown } | null | undefined): Verdict | null {
  if (!data) return null;
  if (isVerdict(data.verdict)) return data.verdict;
  return verdictFromLegacy(data.rating);
}

/** Stars on the native 0.5 to 5 scale. IMDb scores are halved. */
export function starsOf(data: { stars?: unknown; letterboxdRating?: unknown; imdbRating?: unknown } | null | undefined): number | null {
  if (!data) return null;
  if (typeof data.stars === 'number' && Number.isFinite(data.stars)) return data.stars;
  if (typeof data.letterboxdRating === 'number' && Number.isFinite(data.letterboxdRating)) return data.letterboxdRating;
  if (typeof data.imdbRating === 'number' && Number.isFinite(data.imdbRating)) return data.imdbRating / 2;
  return null;
}

/**
 * 1 to 5 score for the taste history. Stars win when present because they keep
 * half-star nuance. A verdict alone maps to the bucket centre. Unrated is null.
 */
export function historyScore(verdict: Verdict | null | undefined, stars?: number | null): number | null {
  if (typeof stars === 'number' && Number.isFinite(stars)) {
    const scaled = stars > 5 ? stars / 2 : stars;
    return Math.max(1, Math.min(5, Math.round(scaled)));
  }
  if (verdict === 'liked') return 5;
  if (verdict === 'okay') return 3;
  if (verdict === 'nope') return 1;
  return null;
}
