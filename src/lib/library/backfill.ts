import { collection, doc, getDoc, getDocs, setDoc, type DocumentData, type Firestore } from 'firebase/firestore';
import { db as defaultDb } from '../firebase';
import { emptyFilm, mergeFilm, writeFilms } from './ledger';
import { withLibraryWriteLock } from './lock';
import type { FilmSource, LibraryFilm } from './types';
import { starsOf, verdictFromStars, verdictOf } from './verdict';

export const BACKFILL_VERSION = 1;

type Row = DocumentData;

function dayOf(value: unknown): string | null {
  if (typeof value === 'string' && value) {
    const iso = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function sourceOf(value: unknown, fallback: FilmSource): FilmSource {
  const known: FilmSource[] = ['letterboxd', 'imdb', 'paste', 'screenshot', 'manual', 'calendar', 'discovery', 'rec'];
  return known.includes(value as FilmSource) ? (value as FilmSource) : fallback;
}

/**
 * Pure fold of the three legacy collections into ledger films.
 * Exported for tests. Idempotent: the same input always yields the same output.
 */
export function foldLegacy(input: {
  calendarLogs: Row[];
  watched: Row[];
  watchlist: Row[];
  existing?: LibraryFilm[];
  now?: number;
}): LibraryFilm[] {
  const now = input.now ?? Date.now();
  const films = new Map<number, LibraryFilm>();
  for (const f of input.existing ?? []) films.set(f.movieId, f);

  const get = (movieId: number, title: string) => films.get(movieId) ?? emptyFilm(movieId, title);

  const nightsByFilm = new Map<number, string[]>();
  for (const row of input.calendarLogs) {
    const movieId = typeof row.movieId === 'number' ? row.movieId : null;
    const title = typeof row.title === 'string' ? row.title : '';
    if (movieId == null || !title) continue;
    if (row.status === 'planned') continue;
    const day = dayOf(row.date);
    const today = new Date(now).toISOString().slice(0, 10);
    if (day && day > today) continue;
    const nights = nightsByFilm.get(movieId) ?? [];
    if (day) nights.push(day);
    nightsByFilm.set(movieId, nights);
    const stars = starsOf(row);
    const verdict = verdictFromStars(stars) ?? verdictOf(row);
    films.set(
      movieId,
      mergeFilm(
        get(movieId, title),
        {
          title,
          year: row.year,
          poster: typeof row.poster === 'string' ? row.poster : undefined,
          backdrop: typeof row.backdrop === 'string' ? row.backdrop : undefined,
          mediaType: row.mediaType === 'tv' ? 'tv' : 'movie',
          watched: true,
          ...(verdict ? { verdict } : {}),
          ...(stars != null ? { stars } : {}),
          firstWatchedAt: day,
          lastWatchedAt: day,
          sources: [sourceOf(row.source, 'calendar')],
        },
        now,
      ),
    );
  }
  for (const [movieId, nights] of nightsByFilm) {
    const film = films.get(movieId);
    if (film) films.set(movieId, { ...film, watchCount: Math.max(film.watchCount, nights.length, 1) });
  }

  for (const row of input.watched) {
    const movieId = typeof row.movieId === 'number' ? row.movieId : null;
    const title = typeof row.title === 'string' ? row.title : '';
    if (movieId == null || !title) continue;
    const stars = starsOf(row);
    const verdict = verdictFromStars(stars) ?? verdictOf(row);
    const existing = get(movieId, title);
    films.set(
      movieId,
      mergeFilm(
        existing,
        {
          title,
          year: row.year,
          poster: typeof row.poster === 'string' ? row.poster : undefined,
          backdrop: typeof row.backdrop === 'string' ? row.backdrop : undefined,
          mediaType: row.mediaType === 'tv' ? 'tv' : 'movie',
          watched: true,
          ...(verdict && !existing.verdict ? { verdict } : {}),
          ...(stars != null && existing.stars == null ? { stars } : {}),
          sources: [sourceOf(row.source, 'discovery')],
        },
        now,
      ),
    );
  }

  for (const row of input.watchlist) {
    const movieId = typeof row.movieId === 'number' ? row.movieId : null;
    const title = typeof row.title === 'string' ? row.title : '';
    if (movieId == null || !title) continue;
    const existing = get(movieId, title);
    if (existing.watched) continue;
    films.set(
      movieId,
      mergeFilm(
        existing,
        {
          title,
          year: row.year,
          poster: typeof row.poster === 'string' ? row.poster : undefined,
          backdrop: typeof row.backdrop === 'string' ? row.backdrop : undefined,
          onWatchlist: true,
          sources: [sourceOf(row.source, 'manual')],
        },
        now,
      ),
    );
  }

  return Array.from(films.values());
}

export function backfillMarker(uid: string, db: Firestore = defaultDb) {
  return doc(db, 'users', uid, 'imports', 'backfill');
}

/**
 * One-time fold of calendar_logs, watched_recommendations, and watchlist into the
 * films ledger. Safe to rerun. Returns the number of films written, or -1 if already done.
 */
export async function backfillLibrary(uid: string, db: Firestore = defaultDb): Promise<number> {
  return withLibraryWriteLock(uid, async () => {
    const marker = await getDoc(backfillMarker(uid, db));
    if (marker.exists() && marker.data()?.version === BACKFILL_VERSION) return -1;

    const [cal, watched, watchlist, existing] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'calendar_logs')),
      getDocs(collection(db, 'users', uid, 'watched_recommendations')),
      getDocs(collection(db, 'users', uid, 'watchlist')),
      getDocs(collection(db, 'users', uid, 'films')),
    ]);

    const films = foldLegacy({
      calendarLogs: cal.docs.map((d) => d.data()),
      watched: watched.docs.map((d) => d.data()),
      watchlist: watchlist.docs.map((d) => d.data()),
      existing: existing.docs
        .map((d) => d.data() as LibraryFilm)
        .filter((f) => typeof f.movieId === 'number' && typeof f.title === 'string'),
    });

    const written = await writeFilms(uid, films, db);
    await setDoc(backfillMarker(uid, db), { version: BACKFILL_VERSION, films: written, at: Date.now() });
    return written;
  });
}
