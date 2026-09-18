export function loopingSlides<T>(slides: T[]): T[] {
  if (slides.length < 2) return slides;
  return [slides[slides.length - 1], ...slides, slides[0]];
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

export type RelatedPoster = { title: string; poster: string };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Diary titles named in whyMatch. Longer titles first, exclude the current film, cap at two. */
export function relatedFromWhy(
  whyMatch: string | undefined,
  diary: { title: string; poster?: string }[],
  excludeTitle?: string,
  limit = 2,
): RelatedPoster[] {
  const why = whyMatch?.trim();
  if (!why) return [];
  const exclude = excludeTitle?.trim().toLowerCase() ?? '';
  const seen = new Set<string>();
  const candidates: RelatedPoster[] = [];
  for (const row of diary) {
    const title = row.title?.trim();
    if (!title || title.length < 4 || !row.poster) continue;
    const key = title.toLowerCase();
    if (key === exclude || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ title, poster: row.poster });
  }
  candidates.sort((a, b) => b.title.length - a.title.length);
  let remaining = why;
  const found: RelatedPoster[] = [];
  for (const candidate of candidates) {
    if (found.length >= limit) break;
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(candidate.title)}($|[^\\p{L}\\p{N}])`,
      'iu',
    );
    const match = remaining.match(pattern);
    if (!match || match.index == null) continue;
    found.push(candidate);
    remaining = remaining.slice(0, match.index) + remaining.slice(match.index + match[0].length);
  }
  return found;
}
