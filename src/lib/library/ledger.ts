import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { db as defaultDb } from '../firebase';
import type { FilmSource, LibraryFilm, LibraryFilmPatch, MediaType, Verdict } from './types';
import { isVerdict } from './verdict';

export const BATCH_LIMIT = 400;

export function filmsRef(uid: string, db: Firestore = defaultDb) {
  return collection(db, 'users', uid, 'films');
}

export function filmDoc(uid: string, movieId: number, db: Firestore = defaultDb) {
  return doc(db, 'users', uid, 'films', String(movieId));
}

export function emptyFilm(movieId: number, title: string): LibraryFilm {
  return {
    movieId,
    title,
    poster: '',
    mediaType: 'movie',
    watched: false,
    verdict: null,
    stars: null,
    hearted: false,
    watchCount: 0,
    firstWatchedAt: null,
    lastWatchedAt: null,
    onWatchlist: false,
    tags: [],
    reviewExcerpt: null,
    listNames: [],
    sources: [],
    external: {},
    updatedAt: 0,
  };
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Parse a stored ledger doc. Missing or malformed fields fall back to the empty film. */
export function parseFilm(raw: DocumentData | undefined, fallbackId?: number): LibraryFilm | null {
  if (!raw || typeof raw !== 'object') return null;
  const movieId = num(raw.movieId) ?? (fallbackId ?? null);
  const title = str(raw.title);
  if (movieId == null || !title) return null;
  const base = emptyFilm(movieId, title);
  const year = typeof raw.year === 'string' || typeof raw.year === 'number' ? raw.year : undefined;
  return {
    ...base,
    ...(year !== undefined ? { year } : {}),
    poster: str(raw.poster) ?? '',
    ...(str(raw.backdrop) ? { backdrop: str(raw.backdrop) } : {}),
    mediaType: raw.mediaType === 'tv' ? 'tv' : 'movie',
    watched: raw.watched === true,
    verdict: isVerdict(raw.verdict) ? raw.verdict : null,
    stars: num(raw.stars),
    hearted: raw.hearted === true,
    watchCount: num(raw.watchCount) ?? 0,
    firstWatchedAt: str(raw.firstWatchedAt) ?? null,
    lastWatchedAt: str(raw.lastWatchedAt) ?? null,
    onWatchlist: raw.onWatchlist === true,
    tags: strList(raw.tags),
    reviewExcerpt: str(raw.reviewExcerpt) ?? null,
    listNames: strList(raw.listNames),
    sources: strList(raw.sources) as FilmSource[],
    external: raw.external && typeof raw.external === 'object' ? (raw.external as LibraryFilm['external']) : {},
    updatedAt: num(raw.updatedAt) ?? 0,
  };
}

function uniq<T>(list: T[]): T[] {
  return Array.from(new Set(list));
}

function minDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Pure merge of a patch onto an existing film. Dates widen, counts take the max,
 * lists union, and scalar fields take the patch when provided.
 */
export function mergeFilm(existing: LibraryFilm, patch: LibraryFilmPatch, now = Date.now()): LibraryFilm {
  const next: LibraryFilm = { ...existing, updatedAt: now };
  if (patch.title) next.title = patch.title;
  if (patch.year !== undefined) next.year = patch.year;
  if (patch.poster) next.poster = patch.poster;
  if (patch.backdrop) next.backdrop = patch.backdrop;
  if (patch.mediaType) next.mediaType = patch.mediaType;
  if (patch.watched !== undefined) next.watched = patch.watched;
  if (patch.verdict !== undefined) next.verdict = patch.verdict;
  if (patch.stars !== undefined) next.stars = patch.stars;
  if (patch.hearted !== undefined) next.hearted = patch.hearted || existing.hearted;
  if (patch.watchCount !== undefined) next.watchCount = Math.max(existing.watchCount, patch.watchCount);
  if (patch.firstWatchedAt !== undefined) next.firstWatchedAt = minDate(existing.firstWatchedAt, patch.firstWatchedAt);
  if (patch.lastWatchedAt !== undefined) next.lastWatchedAt = maxDate(existing.lastWatchedAt, patch.lastWatchedAt);
  if (patch.onWatchlist !== undefined) next.onWatchlist = patch.onWatchlist;
  if (patch.tags) next.tags = uniq([...existing.tags, ...patch.tags]);
  if (patch.reviewExcerpt !== undefined) next.reviewExcerpt = patch.reviewExcerpt ?? existing.reviewExcerpt;
  if (patch.listNames) next.listNames = uniq([...existing.listNames, ...patch.listNames]);
  if (patch.sources) next.sources = uniq([...existing.sources, ...patch.sources]);
  if (patch.external) next.external = { ...existing.external, ...patch.external };
  if (next.watched && next.watchCount === 0) next.watchCount = 1;
  if (next.watched) next.onWatchlist = patch.onWatchlist ?? false;
  return next;
}

export async function getFilm(uid: string, movieId: number, db: Firestore = defaultDb): Promise<LibraryFilm | null> {
  const snap = await getDoc(filmDoc(uid, movieId, db));
  return snap.exists() ? parseFilm(snap.data(), movieId) : null;
}

export async function getAllFilms(uid: string, db: Firestore = defaultDb): Promise<LibraryFilm[]> {
  const snap = await getDocs(filmsRef(uid, db));
  return snap.docs
    .map((d) => parseFilm(d.data(), Number(d.id)))
    .filter((f): f is LibraryFilm => f != null);
}

/** Merge a patch into one film. Creates the doc when missing. */
export async function upsertFilm(
  uid: string,
  movieId: number,
  title: string,
  patch: LibraryFilmPatch,
  db: Firestore = defaultDb,
): Promise<LibraryFilm> {
  const existing = (await getFilm(uid, movieId, db)) ?? emptyFilm(movieId, title);
  const next = mergeFilm(existing, { title, ...patch });
  await setDoc(filmDoc(uid, movieId, db), next);
  return next;
}

/** Write many films in chunks of BATCH_LIMIT. */
export async function writeFilms(uid: string, films: LibraryFilm[], db: Firestore = defaultDb): Promise<number> {
  let written = 0;
  for (let i = 0; i < films.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const film of films.slice(i, i + BATCH_LIMIT)) {
      batch.set(filmDoc(uid, film.movieId, db), film);
      written++;
    }
    await batch.commit();
  }
  return written;
}

export type WatchInput = {
  movieId: number;
  title: string;
  year?: string | number;
  poster?: string;
  backdrop?: string;
  mediaType?: MediaType;
  date?: string | null;
  verdict?: Verdict | null;
  stars?: number | null;
  source: FilmSource;
};

/** Record one watch. Increments the count and widens the date range. */
export async function recordWatch(uid: string, input: WatchInput, db: Firestore = defaultDb): Promise<LibraryFilm> {
  const existing = (await getFilm(uid, input.movieId, db)) ?? emptyFilm(input.movieId, input.title);
  const day = input.date ? input.date.slice(0, 10) : null;
  const next = mergeFilm(existing, {
    title: input.title,
    year: input.year,
    poster: input.poster,
    backdrop: input.backdrop,
    mediaType: input.mediaType,
    watched: true,
    watchCount: existing.watchCount + 1,
    firstWatchedAt: day,
    lastWatchedAt: day,
    ...(input.verdict !== undefined ? { verdict: input.verdict } : {}),
    ...(input.stars !== undefined ? { stars: input.stars } : {}),
    onWatchlist: false,
    sources: [input.source],
  });
  await setDoc(filmDoc(uid, input.movieId, db), next);
  return next;
}

export async function setVerdict(
  uid: string,
  film: { movieId: number; title: string; year?: string | number; poster?: string; backdrop?: string; mediaType?: MediaType },
  verdict: Verdict | null,
  source: FilmSource,
  stars: number | null = null,
  db: Firestore = defaultDb,
): Promise<LibraryFilm> {
  const existing = (await getFilm(uid, film.movieId, db)) ?? emptyFilm(film.movieId, film.title);
  const next = mergeFilm(existing, {
    ...film,
    watched: true,
    verdict,
    stars,
    sources: [source],
  });
  await setDoc(filmDoc(uid, film.movieId, db), next);
  return next;
}

export async function setOnWatchlist(
  uid: string,
  film: { movieId: number; title: string; year?: string | number; poster?: string; backdrop?: string; mediaType?: MediaType },
  on: boolean,
  db: Firestore = defaultDb,
): Promise<LibraryFilm> {
  const existing = (await getFilm(uid, film.movieId, db)) ?? emptyFilm(film.movieId, film.title);
  const next = { ...mergeFilm(existing, { ...film }), onWatchlist: on };
  await setDoc(filmDoc(uid, film.movieId, db), next);
  return next;
}

/** Forget every watch. The doc stays so watchlist state and metadata survive. */
export async function clearWatched(uid: string, movieId: number, db: Firestore = defaultDb): Promise<LibraryFilm | null> {
  const existing = await getFilm(uid, movieId, db);
  if (!existing) return null;
  const next: LibraryFilm = {
    ...existing,
    watched: false,
    verdict: null,
    stars: null,
    watchCount: 0,
    firstWatchedAt: null,
    lastWatchedAt: null,
    updatedAt: Date.now(),
  };
  await setDoc(filmDoc(uid, movieId, db), next);
  return next;
}

/** Drop one watch night. Recomputes count and dates from the remaining nights. */
export async function removeWatchNight(
  uid: string,
  movieId: number,
  remainingDates: string[],
  db: Firestore = defaultDb,
): Promise<LibraryFilm | null> {
  const existing = await getFilm(uid, movieId, db);
  if (!existing) return null;
  const sorted = [...remainingDates].map((d) => d.slice(0, 10)).sort();
  const next: LibraryFilm = {
    ...existing,
    watchCount: sorted.length,
    watched: sorted.length > 0 || existing.verdict != null,
    firstWatchedAt: sorted[0] ?? null,
    lastWatchedAt: sorted[sorted.length - 1] ?? null,
    updatedAt: Date.now(),
  };
  await setDoc(filmDoc(uid, movieId, db), next);
  return next;
}
