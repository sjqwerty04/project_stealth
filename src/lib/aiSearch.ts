export const AI_SEARCH_MAX_TOKENS = 512;
export const AI_SEARCH_MODEL = 'grok-4.3';
export const AI_SEARCH_REASONING = 'none' as const;
export const AI_SEARCH_CACHE_KEY = 'hunt-search';
export const AI_SEARCH_LIMIT = 12;
/** Extra slots for the web-search pass, after the fast list has already rendered. */
export const AI_SEARCH_RECENT_EXTRA = 4;
export const AI_SEARCH_SYSTEM = 'Real films. JSON.';

export type FilmTitle = { title: string; year: string };

/** Short keys so twelve films fit in the token cap. Item 1 streams first. */
export function buildAiSearchPrompt(query: string): string {
  return `Q:${JSON.stringify(query)}
[{"t":"Title","y":1995}]
12 real films. [ first. No invented titles.
1=obvious film, not a title already named.
Films. Keep each named person and trait. Vary decade and country. One per series.`;
}

/** Later pass. Asks only for films from the last 18 months that fit the same sentence. */
export function buildRecencyPrompt(query: string, today = '2026-10-18'): string {
  return `Today:${today}
Q:${JSON.stringify(query)}
[{"t":"Title","y":1995}]
Real films from the last 18 months only. No invented titles. [ first.`;
}

function findObjectEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseTitle(slice: string): FilmTitle | null {
  try {
    const obj = JSON.parse(slice);
    const rawTitle = obj?.t ?? obj?.title;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title || title.length > 160) return null;
    const year = String(obj?.y ?? obj?.year ?? '').replace(/[^\d]/g, '').slice(0, 4);
    return { title, year };
  } catch {
    return null;
  }
}

/**
 * Pull every closed {"title","year"} object out of a partial model stream.
 * `rest` is the unfinished object, so the caller can append the next delta.
 */
export function takeFilmTitles(buffer: string): { titles: FilmTitle[]; rest: string } {
  const titles: FilmTitle[] = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf('{', cursor);
    if (start < 0) return { titles, rest: '' };
    const end = findObjectEnd(buffer, start);
    if (end < 0) return { titles, rest: buffer.slice(start) };
    const parsed = parseTitle(buffer.slice(start, end + 1));
    if (parsed) titles.push(parsed);
    cursor = end + 1;
  }
  return { titles, rest: '' };
}
