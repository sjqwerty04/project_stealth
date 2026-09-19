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

export type RelatedPoster = { title: string; poster: string };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGenericShortTitle(title: string) {
  return title.length < 4 && /^[\p{L}]+$/u.test(title);
}

/** Diary titles named in whyMatch, in mention order. Exclude the current film, cap at two. */
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
    if (!title || !row.poster || isGenericShortTitle(title)) continue;
    const key = title.toLowerCase();
    if (key === exclude || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ title, poster: row.poster });
  }

  const matches: { start: number; end: number; candidate: RelatedPoster }[] = [];
  for (const candidate of candidates) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegExp(candidate.title)})($|[^\\p{L}\\p{N}])`,
      'iu',
    );
    const match = why.match(pattern);
    if (!match || match.index == null) continue;
    const start = match.index + (match[1]?.length ?? 0);
    matches.push({ start, end: start + candidate.title.length, candidate });
  }

  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

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
