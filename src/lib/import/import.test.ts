import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { emptyFilm, mergeFilm } from '../library/ledger';
import type { LibraryFilm } from '../library/types';
import { headersOf, parseCsv } from './csv';
import { entriesFromZip, findEntry, type CsvEntry } from './files';
import { filmKey, looksLikeLetterboxd, parseExportFolderName, parseLetterboxdExport } from './letterboxd/parse';
import { matchFilms, resetMatchCacheForTesting, type Lookup, type MatchedFilm } from './match';
import { digestFromFilms, filmsFromBundle } from './write';

const FIXTURE_ROOT = join(__dirname, 'letterboxd/__fixtures__');
const FIXTURE_DIR = join(FIXTURE_ROOT, 'letterboxd-jane-2026-01-21-11-20-utc');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function fixtureEntries(): CsvEntry[] {
  return walk(FIXTURE_DIR).map((full) => {
    const path = relative(FIXTURE_ROOT, full).replace(/\\/g, '/');
    return { path, name: path.split('/').pop()!, text: readFileSync(full, 'utf8') };
  });
}

const TMDB: Record<string, MatchedFilm> = {
  'heat|1995': { movieId: 949, title: 'Heat', year: '1995', poster: 'p/heat', mediaType: 'movie' },
  'tron|1982': { movieId: 97, title: 'Tron', year: '1982', poster: 'p/tron', mediaType: 'movie' },
  'drive|2011': { movieId: 64690, title: 'Drive', year: '2011', poster: 'p/drive', mediaType: 'movie' },
  'her|2013': { movieId: 152601, title: 'Her', year: '2013', poster: 'p/her', mediaType: 'movie' },
  'conclave|2024': { movieId: 974576, title: 'Conclave', year: '2024', poster: 'p/conclave', mediaType: 'movie' },
  'whiplash|2014': { movieId: 244786, title: 'Whiplash', year: '2014', poster: 'p/whiplash', mediaType: 'movie' },
  'sinners|2025': { movieId: 1233413, title: 'Sinners', year: '2025', poster: 'p/sinners', mediaType: 'movie' },
  'sicario|2015': { movieId: 273481, title: 'Sicario', year: '2015', poster: 'p/sicario', mediaType: 'movie' },
  'gravity|2013': { movieId: 49047, title: 'Gravity', year: '2013', poster: 'p/gravity', mediaType: 'movie' },
};

const fakeLookup: Lookup = async (title, year) => TMDB[filmKey(title, year)] ?? null;

describe('csv', () => {
  it('normalises padded headers and keeps quoted newlines', () => {
    const { rows, headers } = parseCsv('Date , Name , Year, Letterboxd URI \n2024-01-01, Heat , 1995, https://boxd.it/x\n');
    expect(headers).toEqual(['date', 'name', 'year', 'letterboxd uri']);
    expect(rows[0]).toEqual({ date: '2024-01-01', name: 'Heat', year: '1995', 'letterboxd uri': 'https://boxd.it/x' });
    const multi = parseCsv('Name,Review\nHeat,"line one\nline two"\n');
    expect(multi.rows[0].review).toBe('line one\nline two');
    expect(headersOf('\uFEFFConst,Your Rating,Title\n')).toEqual(['const', 'your rating', 'title']);
  });

  it('detects letterboxd by header', () => {
    expect(looksLikeLetterboxd(['date', 'name', 'year', 'letterboxd uri'])).toBe(true);
    expect(looksLikeLetterboxd(['const', 'your rating', 'title'])).toBe(false);
  });
});

describe('files', () => {
  it('reads CSVs out of a zip and finds them by basename', async () => {
    const zip = new JSZip();
    for (const entry of fixtureEntries()) zip.file(entry.path, entry.text);
    const blob = await zip.generateAsync({ type: 'blob' });
    const entries = await entriesFromZip(blob, 'letterboxd-jane.zip');
    expect(entries.length).toBe(14);
    expect(findEntry(entries, 'diary.csv')?.path).toBe('letterboxd-jane.zip/letterboxd-jane-2026-01-21-11-20-utc/diary.csv');
    expect(findEntry(entries, 'films.csv', { under: 'likes' })?.path).toContain('/likes/films.csv');
    expect(findEntry(entries, 'reviews.csv')?.path).not.toContain('/likes/');
  });

  it('parses the export folder name', () => {
    expect(parseExportFolderName('letterboxd-jane-2026-01-21-11-20-utc/diary.csv')).toEqual({
      username: 'jane',
      exportedAt: '2026-01-21T11:20:00Z',
    });
    expect(parseExportFolderName('diary.csv')).toEqual({});
  });
});

describe('parseLetterboxdExport', () => {
  const bundle = parseLetterboxdExport(fixtureEntries());
  const byKey = new Map(bundle.films.map((f) => [filmKey(f.title, f.year), f]));

  it('reads counts from every file it uses and skips tombstones', () => {
    expect(bundle.source).toBe('letterboxd');
    expect(bundle.meta.username).toBe('jane');
    expect(bundle.meta.exportedAt).toBe('2026-01-21T11:20:00Z');
    expect(bundle.meta.counts).toMatchObject({ watched: 6, ratings: 5, diary: 5, reviews: 2, watchlist: 2, likes: 1, likedReviews: 2, lists: 2, films: 6 });
    expect(bundle.meta.filesSeen.some((p) => p.includes('deleted/'))).toBe(false);
    expect(bundle.meta.filesSeen.some((p) => p.includes('comments.csv'))).toBe(false);
    expect(byKey.has('deleted film|2000')).toBe(false);
  });

  it('takes stars from ratings and nights from diary only', () => {
    expect(byKey.get('heat|1995')).toMatchObject({ stars: 5, watchCount: 2, letterboxdUri: 'https://boxd.it/29Pq', hearted: true });
    expect(byKey.get('heat|1995')?.tags?.sort()).toEqual(['cinema', 'crime', 'plex']);
    expect(byKey.get('heat|1995')?.listNames).toEqual(['favorites']);
    expect(byKey.get('heat|1995')?.review).toBe('Night drives and moral math. Every frame is a negotiation.');
    expect(byKey.get('tron|1982')).toMatchObject({ stars: 1.5, watchCount: 1 });
    expect(byKey.get('tron|1982')?.review).toBeUndefined();
    expect(byKey.get('drive|2011')).toMatchObject({ stars: 3, hearted: true, listNames: ['rainy days'] });
    expect(byKey.get('drive|2011')?.watchCount).toBeUndefined();
    expect(bundle.diary.map((d) => d.watchedDate)).toEqual(['2024-04-30', '2025-01-02', '2024-06-01', '2024-07-01', '2025-11-03']);
    expect(bundle.diary[1]).toMatchObject({ title: 'Heat', rewatch: true, tags: ['plex', 'crime'] });
  });

  it('keeps unwatched watchlist rows and curious films from liked reviews', () => {
    expect(bundle.watchlist.map((w) => w.title)).toEqual(['Whiplash', 'Sinners']);
    expect(bundle.curious.map((c) => c.title)).toEqual(['Sicario']);
  });
});

describe('matchFilms', () => {
  it('matches by title and year, never guesses across years, and reports misses', async () => {
    resetMatchCacheForTesting();
    const calls: string[] = [];
    const lookup: Lookup = async (title, year) => {
      calls.push(filmKey(title, year));
      if (filmKey(title, year) === 'gravity|2019') return TMDB['gravity|2013'];
      return fakeLookup(title, year);
    };
    const result = await matchFilms(
      [
        { title: 'Heat', year: '1995' },
        { title: 'Heat', year: '1995' },
        { title: 'Gravity', year: '2019' },
        { title: 'Unmatchable Film', year: '1901' },
      ],
      { lookup, concurrency: 2 },
    );
    expect(calls.length).toBe(3);
    expect(result.matched.get('heat|1995')?.movieId).toBe(949);
    expect(result.unresolved).toEqual([
      { title: 'Gravity', year: '2019', reason: 'year_mismatch' },
      { title: 'Unmatchable Film', year: '1901', reason: 'not_found' },
    ]);
  });
});

describe('filmsFromBundle and digest', () => {
  const bundle = parseLetterboxdExport(fixtureEntries());
  const matched = new Map(Object.entries(TMDB));
  const now = Date.parse('2026-01-22T00:00:00Z');

  it('turns the bundle into ledger films with verdicts, counts, and dates', () => {
    const films = filmsFromBundle(bundle, matched, new Map(), now);
    const byId = new Map(films.map((f) => [f.movieId, f]));
    expect(byId.get(949)).toMatchObject({
      title: 'Heat',
      watched: true,
      verdict: 'liked',
      stars: 5,
      hearted: true,
      watchCount: 2,
      firstWatchedAt: '2024-04-30',
      lastWatchedAt: '2025-01-02',
      watchDates: ['2024-04-30', '2025-01-02'],
      onWatchlist: false,
      sources: ['letterboxd'],
      external: { letterboxdUri: 'https://boxd.it/29Pq' },
    });
    expect(byId.get(97)).toMatchObject({ verdict: 'nope', stars: 1.5, watchCount: 1 });
    expect(byId.get(64690)).toMatchObject({ verdict: 'liked', stars: 3, hearted: true, watchCount: 1, firstWatchedAt: null });
    expect(byId.get(974576)).toMatchObject({ verdict: 'liked', stars: 3.5 });
    expect(byId.get(244786)).toMatchObject({ title: 'Whiplash', watched: false, onWatchlist: true });
    expect(byId.has(273481)).toBe(false);
    expect(films.length).toBe(7);
  });

  it('merges over an existing ledger without losing manual state', () => {
    const existing = new Map<number, LibraryFilm>([
      [949, mergeFilm(emptyFilm(949, 'Heat'), { watched: true, watchCount: 3, firstWatchedAt: '2010-01-01', tags: ['manual'] }, 1)],
    ]);
    const films = filmsFromBundle(bundle, matched, existing, now);
    const heat = films.find((f) => f.movieId === 949)!;
    expect(heat.watchCount).toBe(3);
    expect(heat.firstWatchedAt).toBe('2010-01-01');
    expect(heat.tags).toContain('manual');
  });

  it('builds the digest', () => {
    const films = filmsFromBundle(bundle, matched, new Map(), now);
    const digest = digestFromFilms(films, bundle, matched);
    expect(digest.canon.map((f) => f.title)).toEqual(['Heat', 'Her', 'Drive']);
    expect(digest.rejects.map((f) => f.title)).toEqual(['Tron']);
    expect(digest.recent.map((f) => f.title)).toEqual(['Conclave', 'Heat', 'Her', 'Tron']);
    expect(digest.avgStars).toBe(3.4);
    expect(digest.counts).toEqual({ watched: 5, rated: 5, diary: 5, watchlist: 2 });
    expect(digest.curious?.map((f) => f.title)).toEqual(['Sicario']);
  });
});
