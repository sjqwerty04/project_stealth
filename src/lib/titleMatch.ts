/**
 * Title matching for "has the user already seen this?".
 *
 * Titles reach us from three sources with inconsistent punctuation, casing, and
 * article placement: the calendar, Letterboxd/IMDb imports, and the LLM. Raw
 * string comparison misses obvious duplicates, and recommending an
 * already-watched film is the single most-cited complaint about this product
 * category — so matching is deliberately loose.
 */

/**
 * Strips everything that varies between sources so titles compare reliably.
 *
 * Diacritics are folded first: Letterboxd exports keep them ("Amélie") while
 * TMDB and the LLM often don't, and dropping the combining marks without
 * decomposing would turn "Amélie" into "amlie" and never match.
 */
export const titleKey = (title: string): string =>
  (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Removes a trailing "(1999)" style year suffix. */
export const stripYearSuffix = (entry: string): string =>
  (entry || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * Builds the exclusion set from entries that may or may not carry a year suffix.
 */
export const buildSeenKeys = (entries: string[]): Set<string> => {
  const keys = new Set<string>();
  for (const entry of entries) {
    const bare = stripYearSuffix(entry);
    if (bare) keys.add(titleKey(bare));
  }
  return keys;
};

/**
 * Matches on title alone, ignoring year. A remake being filtered out is a far
 * cheaper mistake than showing someone a film they have already watched.
 */
export const isSeen = (title: string | undefined | null, seenKeys: Set<string>): boolean => {
  if (!title) return false;
  return seenKeys.has(titleKey(title));
};
