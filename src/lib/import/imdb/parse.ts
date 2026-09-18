import { emptyBundle, type ImportBundle } from '../../library/types';
import { parseCsv } from '../csv';
import type { CsvEntry } from '../files';

export function looksLikeImdb(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  return set.has('const') && (set.has('title') || set.has('your rating'));
}

function isoDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/**
 * IMDb ratings.csv and watchlist exports share the Const/Title/Year columns. Rows with
 * "Your Rating" become watched films with stars on the 0.5 to 5 scale and one night on
 * Date Rated. Rows without a rating in a watchlist export become watchlist entries.
 */
export function parseImdbExport(entries: CsvEntry[]): ImportBundle {
  const bundle = emptyBundle('imdb');
  for (const entry of entries) {
    const { rows, headers } = parseCsv(entry.text);
    if (!looksLikeImdb(headers)) continue;
    bundle.meta.filesSeen.push(entry.path);
    const isWatchlist = headers.includes('position') || /watchlist/i.test(entry.name);
    for (const row of rows) {
      const imdbId = row.const;
      const title = row.title || row['original title'];
      if (!imdbId || !title || !imdbId.startsWith('tt')) continue;
      const type = (row['title type'] ?? '').toLowerCase();
      if (type && !/movie|tv|short|video|special/.test(type)) continue;
      const year = row.year ? row.year.slice(0, 4) : undefined;
      const score = Number(row['your rating']);
      const stars = Number.isFinite(score) && score > 0 ? Math.round(score) / 2 : undefined;
      if (stars == null && isWatchlist) {
        bundle.watchlist.push({ title, year });
        continue;
      }
      bundle.films.push({ title, year, imdbId, stars, watched: true });
      const day = isoDay(row['date rated']);
      if (day) bundle.diary.push({ title, year, watchedDate: day, stars, rewatch: false, tags: [] });
    }
    bundle.meta.counts[isWatchlist ? 'watchlist' : 'ratings'] = rows.length;
  }
  bundle.meta.counts.films = bundle.films.length;
  return bundle;
}
