import { emptyBundle, type BundleFilm, type ImportBundle } from '../../library/types';
import { parseCsv, type CsvRow } from '../csv';
import { entriesUnder, findEntry, type CsvEntry } from '../files';

export const LETTERBOXD_FILM_HEADERS = ['name', 'year', 'letterboxd uri'];

export function looksLikeLetterboxd(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  return set.has('letterboxd uri') && set.has('name');
}

export function filmKey(title: string, year?: string | number | null): string {
  const y = year == null || year === '' ? '' : String(year).slice(0, 4);
  return `${title.trim().toLowerCase()}|${y}`;
}

function stars(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(5, Math.max(0.5, Math.round(n * 2) / 2));
}

function tags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function isoDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

function isFilmRow(row: CsvRow): row is CsvRow & { name: string } {
  return typeof row.name === 'string' && row.name.length > 0;
}

/** Turn a parsed folder name like "letterboxd-jane-2026-01-21-11-20-utc" into its parts. */
export function parseExportFolderName(path: string): { username?: string; exportedAt?: string } {
  const m = path.match(/letterboxd-(.+?)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-utc/i);
  if (!m) return {};
  return { username: m[1], exportedAt: `${m[2]}T${m[3]}:${m[4]}:00Z` };
}

function listNameFromPath(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base
    .replace(/\.csv$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/**
 * Letterboxd list CSVs carry a preamble: a metadata header row, a data row, a blank line,
 * then the film table. Slice from the first line whose header includes "Name".
 */
function listTable(text: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /(^|,)\s*name\s*(,|$)/i.test(line) && /(^|,)\s*year\s*(,|$)/i.test(line));
  return start > 0 ? lines.slice(start).join('\n') : text;
}

/**
 * Fold a Letterboxd export into an ImportBundle.
 *
 * ratings.csv is the canonical star. diary.csv is the only source of watch nights and
 * rewatch counts. watched.csv marks membership only; its Date column is the click, not
 * a viewing. likes/films.csv sets hearted. reviews.csv keeps a short excerpt for 4+ star
 * films. lists/*.csv fill listNames; favorites also hearts. likes/reviews.csv becomes a
 * soft "curious" list. deleted/, orphaned/, comments.csv, and likes/lists.csv are ignored.
 */
export function parseLetterboxdExport(entries: CsvEntry[]): ImportBundle {
  const bundle = emptyBundle('letterboxd');
  const films = new Map<string, BundleFilm>();
  const seen: string[] = [];

  const get = (name: string, year?: string): BundleFilm => {
    const key = filmKey(name, year);
    let film = films.get(key);
    if (!film) {
      film = { title: name.trim(), year: year || undefined };
      films.set(key, film);
    }
    return film;
  };

  const first = entries[0];
  if (first) Object.assign(bundle.meta, parseExportFolderName(first.path));

  const profile = findEntry(entries, 'profile.csv');
  if (profile) {
    seen.push(profile.path);
    const { rows } = parseCsv(profile.text);
    const username = rows[0]?.username;
    if (username) bundle.meta.username = username;
  }

  const watched = findEntry(entries, 'watched.csv');
  if (watched) {
    seen.push(watched.path);
    const { rows } = parseCsv(watched.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.watched = true;
      if (row['letterboxd uri']) film.letterboxdUri = row['letterboxd uri'];
    }
    bundle.meta.counts.watched = rows.length;
  }

  const ratings = findEntry(entries, 'ratings.csv');
  if (ratings) {
    seen.push(ratings.path);
    const { rows } = parseCsv(ratings.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.watched = true;
      const s = stars(row.rating);
      if (s != null) film.stars = s;
      if (row['letterboxd uri']) film.letterboxdUri = row['letterboxd uri'];
    }
    bundle.meta.counts.ratings = rows.length;
  }

  const diary = findEntry(entries, 'diary.csv');
  if (diary) {
    seen.push(diary.path);
    const { rows } = parseCsv(diary.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.watched = true;
      const day = isoDay(row['watched date']) ?? isoDay(row.date);
      const s = stars(row.rating);
      const rowTags = tags(row.tags);
      if (rowTags.length) film.tags = Array.from(new Set([...(film.tags ?? []), ...rowTags]));
      if (film.stars == null && s != null) film.stars = s;
      if (day) {
        bundle.diary.push({
          title: film.title,
          year: film.year,
          watchedDate: day,
          stars: s,
          rewatch: /^yes$/i.test(row.rewatch ?? ''),
          tags: rowTags,
        });
      }
      film.watchCount = (film.watchCount ?? 0) + 1;
    }
    bundle.meta.counts.diary = rows.length;
  }

  const reviews = findEntry(entries, 'reviews.csv');
  if (reviews) {
    seen.push(reviews.path);
    const { rows } = parseCsv(reviews.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.watched = true;
      const s = stars(row.rating);
      if (film.stars == null && s != null) film.stars = s;
      const text = (row.review ?? '').replace(/\s+/g, ' ').trim();
      if (text && (s ?? film.stars ?? 0) >= 4 && !film.review) film.review = text.slice(0, 280);
    }
    bundle.meta.counts.reviews = rows.length;
  }

  const watchlist = findEntry(entries, 'watchlist.csv');
  if (watchlist) {
    seen.push(watchlist.path);
    const { rows } = parseCsv(watchlist.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const key = filmKey(row.name, row.year);
      if (films.get(key)?.watched) continue;
      bundle.watchlist.push({ title: row.name.trim(), year: row.year || undefined });
    }
    bundle.meta.counts.watchlist = bundle.watchlist.length;
  }

  const likedFilms = findEntry(entries, 'films.csv', { under: 'likes' });
  if (likedFilms) {
    seen.push(likedFilms.path);
    const { rows } = parseCsv(likedFilms.text);
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.hearted = true;
      film.watched = true;
    }
    bundle.meta.counts.likes = rows.length;
  }

  const likedReviews = findEntry(entries, 'reviews.csv', { under: 'likes' });
  if (likedReviews) {
    seen.push(likedReviews.path);
    const { rows } = parseCsv(likedReviews.text);
    const curious = new Set<string>();
    for (const row of rows) {
      const name = row.name ?? row.film ?? '';
      if (!name) continue;
      const key = filmKey(name, row.year);
      if (films.get(key)?.watched || curious.has(key)) continue;
      curious.add(key);
      bundle.curious.push({ title: name.trim(), year: row.year || undefined });
    }
    bundle.meta.counts.likedReviews = rows.length;
  }

  for (const entry of entriesUnder(entries, 'lists')) {
    seen.push(entry.path);
    const listName = listNameFromPath(entry.path);
    const { rows } = parseCsv(listTable(entry.text));
    for (const row of rows) {
      if (!isFilmRow(row)) continue;
      const film = get(row.name, row.year);
      film.listNames = Array.from(new Set([...(film.listNames ?? []), listName]));
      if (/^favou?rites?$/i.test(listName)) {
        film.hearted = true;
        film.watched = true;
      }
    }
    bundle.meta.counts.lists = (bundle.meta.counts.lists ?? 0) + 1;
  }

  bundle.films = Array.from(films.values());
  bundle.meta.filesSeen = seen;
  bundle.meta.counts.films = bundle.films.length;
  return bundle;
}
