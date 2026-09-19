import { emptyBundle, type FilmSource, type ImportBundle } from '../../library/types';

export type ListIntent = 'watched' | 'watchlist' | 'unknown';

export type ParsedItem = {
  title: string;
  year?: string;
  stars?: number;
  /** Struck through, checked, or marked seen inline. Always lands in watched. */
  struck: boolean;
  raw: string;
};

export type ParsedList = {
  items: ParsedItem[];
  intent: ListIntent;
  confidence: number;
  header?: string;
};

const WATCHLIST_WORDS = /\b(to[\s-]?watch|want(?:\s+to)?\s+(?:see|watch)|watch\s?list|queue|someday|need to see|up next|backlog|must[\s-]?see)\b/i;
const WATCHED_WORDS = /\b(watched|seen|ranked|ranking|favou?rites?|best of|top \d+|rewatch|diary|log(?:ged)?|all[\s-]?time)\b/i;
const STRIKE_COMBINING = /[\u0335\u0336\u0337\u0338]/g;
const CHECK_PREFIX = /^\s*(?:\[\s*[xX✓✔]\s*\]|[✓✔☑]|\(x\)|\bx\b)\s+/;
const UNCHECK_PREFIX = /^\s*(?:\[\s*\]|[☐▢◻]|\(\s*\))\s*/;
const BULLET = /^\s*(?:[-*•·▪◦‣–—]+|\d{1,3}[.):]|\(\d{1,3}\))\s*/;
const SEEN_SUFFIX = /\s*[-–—(]?\s*\b(watched|seen|done|rewatched)\b\s*\)?\s*$/i;

function stripStrike(text: string): { text: string; struck: boolean } {
  const combining = (text.match(STRIKE_COMBINING) || []).length;
  const letters = text.replace(STRIKE_COMBINING, '').replace(/\s/g, '').length;
  let struck = letters > 0 && combining >= Math.ceil(letters * 0.5);
  let out = text.replace(STRIKE_COMBINING, '');
  const tilde = out.match(/~~(.+?)~~/);
  if (tilde) {
    out = out.replace(tilde[0], tilde[1]);
    struck = true;
  }
  const tag = out.match(/<(?:s|del|strike)>(.+?)<\/(?:s|del|strike)>/i);
  if (tag) {
    out = out.replace(tag[0], tag[1]);
    struck = true;
  }
  return { text: out, struck };
}

export function parseStars(text: string): { stars?: number; rest: string } {
  const glyphs = text.match(/(★+)(½)?|(⭐+)/);
  if (glyphs) {
    const full = (glyphs[1] ?? glyphs[3] ?? '').length;
    const stars = Math.min(5, full + (glyphs[2] ? 0.5 : 0));
    return { stars, rest: text.replace(glyphs[0], ' ') };
  }
  const asciiRun = text.match(/(?:^|\s)(\*{1,5})(?=\s|$)/);
  if (asciiRun) return { stars: asciiRun[1].length, rest: text.replace(asciiRun[0], ' ') };
  const outOfFive = text.match(/\b(\d(?:\.\d)?)\s*\/\s*5\b/);
  if (outOfFive) return { stars: Math.min(5, Number(outOfFive[1])), rest: text.replace(outOfFive[0], ' ') };
  const outOfTen = text.match(/\b(\d{1,2}(?:\.\d)?)\s*\/\s*10\b/);
  if (outOfTen) return { stars: Math.min(5, Number(outOfTen[1]) / 2), rest: text.replace(outOfTen[0], ' ') };
  const word = text.match(/\b(\d(?:\.\d)?)\s*(?:stars?|\*)\b/i);
  if (word) return { stars: Math.min(5, Number(word[1])), rest: text.replace(word[0], ' ') };
  const trailing = text.match(/[\s\-–—:]+([0-5](?:\.5)?)\s*$/);
  if (trailing && /[a-z]/i.test(text.slice(0, trailing.index))) {
    return { stars: Number(trailing[1]), rest: text.slice(0, trailing.index) };
  }
  return { rest: text };
}

export function parseYear(text: string): { year?: string; rest: string } {
  const paren = text.match(/\(\s*((?:18|19|20)\d{2})\s*\)/);
  if (paren) return { year: paren[1], rest: text.replace(paren[0], ' ') };
  const trailing = text.match(/[\s,\-–—]+((?:18|19|20)\d{2})\s*$/);
  if (trailing && /[a-z]/i.test(text.slice(0, trailing.index))) {
    return { year: trailing[1], rest: text.slice(0, trailing.index) };
  }
  return { rest: text };
}

function looksLikeHeader(line: string, nextLine: string | undefined): boolean {
  const clean = line.trim();
  if (!clean || clean.length > 60) return false;
  if (/\(\s*(?:18|19|20)\d{2}\s*\)/.test(clean)) return false;
  if (BULLET.test(clean) && !/:$/.test(clean)) return false;
  if (/:$/.test(clean)) return true;
  if ((WATCHLIST_WORDS.test(clean) || WATCHED_WORDS.test(clean)) && clean.split(/\s+/).length <= 6) return true;
  return Boolean(nextLine && /^#+\s/.test(clean));
}

export function parseListLine(raw: string): ParsedItem | null {
  let line = raw.replace(/\t/g, ' ').trim();
  if (!line) return null;
  line = line.replace(BULLET, '');
  const struckPrefix = CHECK_PREFIX.test(line);
  line = line.replace(CHECK_PREFIX, '').replace(UNCHECK_PREFIX, '');
  line = line.replace(BULLET, '');
  const strike = stripStrike(line);
  line = strike.text;
  let struck = struckPrefix || strike.struck;
  if (SEEN_SUFFIX.test(line) && line.replace(SEEN_SUFFIX, '').trim().length > 1) {
    line = line.replace(SEEN_SUFFIX, '');
    struck = true;
  }
  const { stars, rest: afterStars } = parseStars(line);
  const { year, rest } = parseYear(afterStars.replace(/["“”]/g, '').replace(/[\s,;:|\-–—]+$/g, ''));
  const title = rest
    .replace(/["“”]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:|-]+$/g, '')
    .trim();
  if (title.length < 2 || /^\d+$/.test(title)) return null;
  return { title, year, stars, struck, raw };
}

/**
 * Turn pasted text into items plus an intent guess. Struck or checked items always mean
 * watched. A header with "to watch" words means watchlist. Mostly starred lines mean watched.
 */
export function parseListText(text: string): ParsedList {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length);
  let header: string | undefined;
  let start = 0;
  if (lines.length > 1 && looksLikeHeader(lines[0], lines[1])) {
    header = lines[0].replace(/^#+\s*/, '').replace(/:$/, '').trim();
    start = 1;
  }
  const items: ParsedItem[] = [];
  for (const line of lines.slice(start)) {
    if (/^[-=_*]{3,}$/.test(line.trim())) continue;
    const item = parseListLine(line);
    if (item) items.push(item);
  }

  let intent: ListIntent = 'unknown';
  let confidence = 0.3;
  const struck = items.filter((i) => i.struck).length;
  const starred = items.filter((i) => i.stars != null).length;
  const haystack = `${header ?? ''} ${text.slice(0, 200)}`;

  if (header && WATCHLIST_WORDS.test(header)) {
    intent = 'watchlist';
    confidence = 0.9;
  } else if (header && WATCHED_WORDS.test(header)) {
    intent = 'watched';
    confidence = 0.9;
  } else if (items.length && starred / items.length >= 0.6) {
    intent = 'watched';
    confidence = 0.85;
  } else if (WATCHLIST_WORDS.test(haystack)) {
    intent = 'watchlist';
    confidence = 0.7;
  } else if (WATCHED_WORDS.test(haystack)) {
    intent = 'watched';
    confidence = 0.7;
  } else if (struck > 0 && struck < items.length) {
    intent = 'watchlist';
    confidence = 0.65;
  } else if (struck > 0 && struck === items.length) {
    intent = 'watched';
    confidence = 0.8;
  }

  return { items, intent, confidence, header };
}

/** Resolve each item to a bucket given the list intent the user confirmed or flipped. */
export function bucketFor(item: ParsedItem, intent: ListIntent): 'watched' | 'watchlist' {
  if (item.struck || item.stars != null) return 'watched';
  return intent === 'watchlist' ? 'watchlist' : 'watched';
}

export function bundleFromList(
  items: ParsedItem[],
  intent: ListIntent,
  source: FilmSource,
  overrides: Map<string, 'watched' | 'watchlist'> = new Map(),
): ImportBundle {
  const bundle = emptyBundle(source);
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.title.toLowerCase()}|${item.year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bucket = overrides.get(key) ?? bucketFor(item, intent);
    if (bucket === 'watched') {
      bundle.films.push({ title: item.title, year: item.year, stars: item.stars, watched: true });
    } else {
      bundle.watchlist.push({ title: item.title, year: item.year });
    }
  }
  bundle.meta.counts = { films: bundle.films.length, watchlist: bundle.watchlist.length };
  bundle.meta.filesSeen = [source];
  return bundle;
}
