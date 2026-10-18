export const AI_SEARCH_MAX_TOKENS = 480;
export const AI_SEARCH_MODEL = 'grok-4.3';
/** grok-4.3 can skip reasoning. grok-4.6 cannot, and even "low" waits several seconds. */
export const AI_SEARCH_REASONING = 'none' as const;
export const AI_SEARCH_LIMIT = 12;
/** Kept short on purpose. A long system prompt delays the first title. */
export const AI_SEARCH_SYSTEM = 'Name real films. JSON array only. First character is [.';

export type FilmTitle = { title: string; year: string };

/**
 * One short turn. Item 1 is the obvious hit so it can stream immediately.
 * The rest split the query so the list is not eight versions of the same film.
 */
export function buildAiSearchPrompt(query: string): string {
  return `Q:${JSON.stringify(query)}
[{"title":"Title","year":"YYYY"}]
12 films. First character is [.
Item 1 is the obvious film, not a title the query already names.
Films only. Keep every named person and trait. Vary the decade and the country. One title from each series.`;
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
    const title = typeof obj?.title === 'string' ? obj.title.trim() : '';
    if (!title || title.length > 160) return null;
    const year = String(obj.year ?? '').replace(/[^\d]/g, '').slice(0, 4);
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
