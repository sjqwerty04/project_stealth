import type { ImportBundle } from '../library/types';
import { headersOf } from './csv';
import type { CsvEntry } from './files';
import { looksLikeImdb, parseImdbExport } from './imdb/parse';
import { looksLikeLetterboxd, parseLetterboxdExport } from './letterboxd/parse';

export type DetectedSource = 'letterboxd' | 'imdb' | 'unknown';

export function detectSource(entries: CsvEntry[]): DetectedSource {
  let letterboxd = 0;
  let imdb = 0;
  for (const entry of entries) {
    const headers = headersOf(entry.text);
    if (looksLikeLetterboxd(headers)) letterboxd++;
    else if (looksLikeImdb(headers)) imdb++;
  }
  if (letterboxd && letterboxd >= imdb) return 'letterboxd';
  if (imdb) return 'imdb';
  return 'unknown';
}

export function bundleFromEntries(entries: CsvEntry[]): ImportBundle | null {
  const source = detectSource(entries);
  if (source === 'letterboxd') return parseLetterboxdExport(entries);
  if (source === 'imdb') return parseImdbExport(entries);
  return null;
}
