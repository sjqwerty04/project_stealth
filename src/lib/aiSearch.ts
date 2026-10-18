export const AI_SEARCH_MAX_TOKENS = 480;
export const AI_SEARCH_MODEL = 'grok-4.3';
/** grok-4.3 can skip reasoning. grok-4.6 cannot, and even "low" waits several seconds. */
export const AI_SEARCH_REASONING = 'none' as const;

export type FilmTitle = { title: string; year: string };

/** Short user turn. The search-intent skill stays the system prompt. */
export function buildAiSearchPrompt(query: string): string {
  return `The user is searching for films: ${JSON.stringify(query)}

Return only a JSON array of 8 films, closest match first:
[{"title":"Film Title","year":"YYYY"}]

No markdown. No prose. Start with [. Always return films.
If the query names actors, those actors are in the films. If it names a mood, genre, or a mix of titles, match that mix. Do not answer with an unrelated best-of list.`;
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
