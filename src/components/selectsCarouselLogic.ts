import { hydratedTitleMatchesPick, mentionNeedles, normalizeFilmTitle } from '../lib/taste/selectPickCoherence';
import { firstSentence } from '../lib/taste/selectsCache';

export function loopingSlides<T>(slides: T[]): T[] {
  if (slides.length < 2) return slides;
  return [slides[slides.length - 1], ...slides, slides[0]];
}

export function slideIdentityKey<T extends { slotId: number }>(slides: T[]): string {
  return slides.map((slide) => slide.slotId).join(',');
}

/** After a wrap animation lands on a clone, jump to the matching real slide. */
export function snapLoopIndex(index: number, count: number): number | null {
  if (count < 2) return null;
  if (index === 0) return count;
  if (index === count + 1) return 1;
  return null;
}

export const SELECTS_AUTOPLAY_MS = 6200;
export const SELECTS_TRANSITION_MS = 900;
export const SELECTS_TRANSITION_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

export type RelatedPoster = {
  title: string;
  poster: string;
  movieId?: number;
  mediaType?: 'movie' | 'tv';
};

export type PosterPoolFilm = {
  title: string;
  poster?: string;
  movieId?: number;
  mediaType?: 'movie' | 'tv';
};

/**
 * Films whose posters can illustrate why copy, in priority order. A film rated
 * straight from Selects never gets a logged night, and an onboarding pick lands
 * in neither, so all three sources have to be offered.
 */
export function relatedPosterPool(...sources: PosterPoolFilm[][]): PosterPoolFilm[] {
  const pool: PosterPoolFilm[] = [];
  const seen = new Set<string>();
  for (const row of sources.flat()) {
    const title = row.title?.trim();
    if (!title || !row.poster) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({
      title,
      poster: row.poster,
      ...(typeof row.movieId === 'number' ? { movieId: row.movieId } : {}),
      ...(row.mediaType ? { mediaType: row.mediaType } : {}),
    });
  }
  return pool;
}

export function relatedPosterRows(
  library: { title: string; poster?: string }[],
  events: { title: string; poster?: string }[],
) {
  return [...library, ...events];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGenericShortTitle(title: string) {
  return title.length < 4 && /^[\p{L}]+$/u.test(title);
}

function firstMention(why: string, needle: string): { start: number; end: number } | null {
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${escapeRegExp(needle)})($|[^\\p{L}\\p{N}])`,
    'iu',
  );
  const match = why.match(pattern);
  if (!match || match.index == null) return null;
  const start = match.index + (match[1]?.length ?? 0);
  return { start, end: start + needle.length };
}

/** Diary films named in the first sentence of whyMatch, in mention order. Exclude the current film, cap at two. */
export function relatedFromWhy(
  whyMatch: string | undefined,
  diary: PosterPoolFilm[],
  excludeTitle?: string,
  limit = 2,
): RelatedPoster[] {
  const why = firstSentence(whyMatch ?? '');
  if (!why) return [];
  const exclude = excludeTitle?.trim() ?? '';
  const seen = new Set<string>();
  const candidates: RelatedPoster[] = [];
  for (const row of diary) {
    const title = row.title?.trim();
    if (!title || !row.poster || isGenericShortTitle(title)) continue;
    const key = normalizeFilmTitle(title) || title.toLowerCase();
    if (seen.has(key)) continue;
    if (exclude && (key === exclude.toLowerCase() || hydratedTitleMatchesPick(exclude, title))) {
      continue;
    }
    seen.add(key);
    candidates.push({
      title,
      poster: row.poster,
      ...(typeof row.movieId === 'number' ? { movieId: row.movieId } : {}),
      ...(row.mediaType ? { mediaType: row.mediaType } : {}),
    });
  }

  const matches: {
    start: number;
    end: number;
    needleLen: number;
    exact: boolean;
    candidate: RelatedPoster;
  }[] = [];
  for (const candidate of candidates) {
    let best: (typeof matches)[number] | null = null;
    for (const needle of mentionNeedles(candidate.title)) {
      const hit = firstMention(why, needle);
      if (!hit) continue;
      const exact = needle.toLowerCase() === candidate.title.toLowerCase();
      const next = { ...hit, needleLen: needle.length, exact, candidate };
      if (
        !best ||
        next.start < best.start ||
        (next.start === best.start && next.needleLen > best.needleLen) ||
        (next.start === best.start && next.needleLen === best.needleLen && next.exact && !best.exact)
      ) {
        best = next;
      }
    }
    if (best) matches.push(best);
  }

  matches.sort(
    (a, b) =>
      a.start - b.start ||
      b.needleLen - a.needleLen ||
      Number(b.exact) - Number(a.exact),
  );

  const found: RelatedPoster[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (found.length >= limit) break;
    if (match.start < cursor) continue;
    found.push(match.candidate);
    cursor = match.end;
  }
  return found;
}
