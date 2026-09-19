import { collection, doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { generateSnapshot } from '../taste/generateSnapshot';
import { db as defaultDb } from '../firebase';
import { BATCH_LIMIT, emptyFilm, mergeFilm, parseFilm } from '../library/ledger';
import type { ImportBundle, LibraryFilm } from '../library/types';
import { verdictFromStars } from '../library/verdict';
import type { ImportDigest, FilmRef } from '../taste/types';
import { recordTasteEvent } from '../taste/recordTasteEvent';
import { filmKey } from './letterboxd/parse';
import type { MatchedFilm } from './match';

export type CreatedRefs = { films: number[]; nights: string[]; watchlist: string[] };

export type WriteSummary = {
  films: number;
  nights: number;
  watchlist: number;
  skippedNights: number;
  digest: ImportDigest;
  /** Docs that did not exist before this write. Undo removes exactly these. */
  created: CreatedRefs;
};

/** Pure. Fold a matched bundle into ledger films, merged over what already exists. */
export function filmsFromBundle(
  bundle: ImportBundle,
  matched: Map<string, MatchedFilm>,
  existing: Map<number, LibraryFilm>,
  now = Date.now(),
): LibraryFilm[] {
  const out = new Map<number, LibraryFilm>();
  const take = (movieId: number, title: string) => out.get(movieId) ?? existing.get(movieId) ?? emptyFilm(movieId, title);

  const nightsByFilm = new Map<number, string[]>();
  for (const row of bundle.diary) {
    const hit = matched.get(filmKey(row.title, row.year));
    if (!hit) continue;
    const nights = nightsByFilm.get(hit.movieId) ?? [];
    nights.push(row.watchedDate);
    nightsByFilm.set(hit.movieId, nights);
  }

  for (const film of bundle.films) {
    const hit = matched.get(filmKey(film.title, film.year));
    if (!hit) continue;
    const nights = (nightsByFilm.get(hit.movieId) ?? []).sort();
    const watched = film.watched !== false || nights.length > 0 || film.stars != null || film.hearted === true;
    const verdict = verdictFromStars(film.stars ?? null, film.hearted);
    const base = take(hit.movieId, hit.title);
    const merged = mergeFilm(
      base,
      {
        title: hit.title,
        year: hit.year || film.year,
        poster: hit.poster,
        backdrop: hit.backdrop,
        mediaType: hit.mediaType,
        watched: watched || base.watched,
        ...(verdict ? { verdict } : {}),
        ...(film.stars != null ? { stars: film.stars } : {}),
        hearted: film.hearted === true,
        watchCount: Math.max(nights.length, film.watchCount ?? 0),
        firstWatchedAt: nights[0] ?? null,
        lastWatchedAt: nights[nights.length - 1] ?? null,
        tags: film.tags ?? [],
        reviewExcerpt: film.review ?? null,
        listNames: film.listNames ?? [],
        sources: [bundle.source],
        external: {
          ...(film.letterboxdUri ? { letterboxdUri: film.letterboxdUri } : {}),
          ...(film.imdbId ? { imdbId: film.imdbId } : {}),
        },
      },
      now,
    );
    out.set(hit.movieId, merged);
  }

  for (const row of bundle.watchlist) {
    const hit = matched.get(filmKey(row.title, row.year));
    if (!hit) continue;
    const base = take(hit.movieId, hit.title);
    if (base.watched) continue;
    out.set(
      hit.movieId,
      mergeFilm(
        base,
        {
          title: hit.title,
          year: hit.year || row.year,
          poster: hit.poster,
          backdrop: hit.backdrop,
          mediaType: hit.mediaType,
          onWatchlist: true,
          sources: [bundle.source],
        },
        now,
      ),
    );
  }

  return Array.from(out.values());
}

function ref(f: LibraryFilm): FilmRef {
  return { movieId: f.movieId, title: f.title, year: f.year };
}

/** Pure. Summarise an import for the taste event. */
export function digestFromFilms(films: LibraryFilm[], bundle: ImportBundle, matched: Map<string, MatchedFilm>): ImportDigest {
  const watched = films.filter((f) => f.watched);
  const canon = watched
    .filter((f) => f.verdict !== 'nope' && (f.hearted || (f.stars ?? 0) >= 4.5 || f.watchCount >= 2))
    .sort((a, b) => (b.stars ?? 0) + b.watchCount - ((a.stars ?? 0) + a.watchCount))
    .slice(0, 15)
    .map(ref);
  const rejects = watched
    .filter((f) => f.verdict === 'nope')
    .sort((a, b) => (a.stars ?? 5) - (b.stars ?? 5))
    .slice(0, 8)
    .map(ref);
  const recent = watched
    .filter((f) => f.lastWatchedAt)
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''))
    .slice(0, 20)
    .map(ref);
  const starred = watched.filter((f) => f.stars != null);
  const avgStars = starred.length ? Math.round((starred.reduce((s, f) => s + (f.stars ?? 0), 0) / starred.length) * 10) / 10 : null;
  const curious = bundle.curious
    .map((c) => matched.get(filmKey(c.title, c.year)))
    .filter((m): m is MatchedFilm => m != null)
    .slice(0, 10)
    .map((m) => ({ movieId: m.movieId, title: m.title, year: m.year }));
  return {
    canon,
    rejects,
    recent,
    avgStars,
    counts: {
      watched: watched.length,
      rated: watched.filter((f) => f.stars != null || f.verdict != null).length,
      diary: bundle.diary.length,
      watchlist: films.filter((f) => f.onWatchlist).length,
    },
    ...(curious.length ? { curious } : {}),
  };
}

async function existingNightKeys(uid: string, db: Firestore): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'users', uid, 'calendar_logs'));
  const keys = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data();
    const day = typeof data.date === 'string' ? data.date.slice(0, 10) : '';
    if (typeof data.movieId === 'number' && day) keys.add(`${data.movieId}|${day}`);
  }
  return keys;
}

/**
 * Write a matched bundle: ledger films, one calendar night per diary row, watchlist rows,
 * and an imports record. Then fire the import taste event with a digest.
 */
export async function writeLibrary(
  uid: string,
  bundle: ImportBundle,
  matched: Map<string, MatchedFilm>,
  opts: { email?: string | null; db?: Firestore; onProgress?: (phase: string, done: number, total: number) => void } = {},
): Promise<WriteSummary> {
  const db = opts.db ?? defaultDb;
  const existingSnap = await getDocs(collection(db, 'users', uid, 'films'));
  const existing = new Map<number, LibraryFilm>();
  for (const d of existingSnap.docs) {
    const f = parseFilm(d.data(), Number(d.id));
    if (f) existing.set(f.movieId, f);
  }

  const films = filmsFromBundle(bundle, matched, existing);
  const nightKeys = await existingNightKeys(uid, db);

  let batch = writeBatch(db);
  let inBatch = 0;
  const flush = async () => {
    if (inBatch === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    inBatch = 0;
  };
  const queue = async (op: (b: typeof batch) => void) => {
    op(batch);
    inBatch++;
    if (inBatch >= BATCH_LIMIT) await flush();
  };

  const created: CreatedRefs = { films: [], nights: [], watchlist: [] };
  let done = 0;
  const total = films.length + bundle.diary.length + bundle.watchlist.length;
  for (const film of films) {
    if (!existing.has(film.movieId)) created.films.push(film.movieId);
    await queue((b) => b.set(doc(db, 'users', uid, 'films', String(film.movieId)), film));
    opts.onProgress?.('films', ++done, total);
  }

  let nights = 0;
  let skippedNights = 0;
  for (const row of bundle.diary) {
    const hit = matched.get(filmKey(row.title, row.year));
    if (!hit) {
      skippedNights++;
      opts.onProgress?.('nights', ++done, total);
      continue;
    }
    const key = `${hit.movieId}|${row.watchedDate}`;
    if (nightKeys.has(key)) {
      skippedNights++;
      opts.onProgress?.('nights', ++done, total);
      continue;
    }
    nightKeys.add(key);
    const verdict = verdictFromStars(row.stars ?? null);
    const logRef = doc(collection(db, 'users', uid, 'calendar_logs'));
    created.nights.push(logRef.id);
    await queue((b) =>
      b.set(logRef, {
        movieId: hit.movieId,
        title: hit.title,
        year: hit.year,
        poster: hit.poster,
        backdrop: hit.backdrop ?? null,
        runtimeLabel: hit.runtime ?? 'Feature',
        mediaType: hit.mediaType,
        date: `${row.watchedDate}T12:00:00`,
        verdict,
        stars: row.stars ?? null,
        rewatch: row.rewatch,
        tags: row.tags,
        status: 'watched',
        inviteFriend: false,
        source: bundle.source,
        createdAt: new Date(`${row.watchedDate}T12:00:00`),
        updatedAt: new Date(),
      }),
    );
    nights++;
    opts.onProgress?.('nights', ++done, total);
  }

  const watchlistSnap = await getDocs(collection(db, 'users', uid, 'watchlist'));
  const onList = new Set(watchlistSnap.docs.map((d) => d.data().movieId as number));
  let watchlist = 0;
  for (const row of bundle.watchlist) {
    const hit = matched.get(filmKey(row.title, row.year));
    opts.onProgress?.('watchlist', ++done, total);
    if (!hit || onList.has(hit.movieId) || existing.get(hit.movieId)?.watched) continue;
    onList.add(hit.movieId);
    const wlRef = doc(collection(db, 'users', uid, 'watchlist'));
    created.watchlist.push(wlRef.id);
    await queue((b) =>
      b.set(wlRef, {
        movieId: hit.movieId,
        title: hit.title,
        year: hit.year,
        poster: hit.poster,
        backdrop: hit.backdrop ?? null,
        runtime: hit.runtime ?? '',
        addedAt: new Date(),
        source: bundle.source,
      }),
    );
    watchlist++;
  }
  await flush();

  const digest = digestFromFilms(films, bundle, matched);
  await setDoc(doc(db, 'users', uid, 'imports', `${bundle.source}-${Date.now()}`), {
    source: bundle.source,
    importedAt: Date.now(),
    exportedAt: bundle.meta.exportedAt ?? null,
    username: bundle.meta.username ?? null,
    filesSeen: bundle.meta.filesSeen,
    counts: { ...bundle.meta.counts, written: films.length, nights, watchlist },
  });

  await seedTasteProfile(uid, digest, db);

  if (films.length || nights || watchlist) {
    await recordTasteEvent(uid, { type: 'import', source: bundle.source, count: films.length, digest }, { email: opts.email });
  }

  return { films: films.length, nights, watchlist, skippedNights, digest, created };
}

/** Seed onboarding favourites and dislikes from the import only when the user never picked any. */
async function seedTasteProfile(uid: string, digest: ImportDigest, db: Firestore) {
  const profileRef = doc(db, 'users', uid, 'profile_data', 'taste_profile');
  const snap = await getDoc(profileRef);
  const data = snap.exists() ? snap.data() : {};
  const patch: Record<string, unknown> = {};
  if (!Array.isArray(data.favoriteFilms) || data.favoriteFilms.length === 0) {
    patch.favoriteFilms = digest.canon.slice(0, 12).map((f) => ({ id: f.movieId, title: f.title, year: f.year ?? '' }));
  }
  if (!Array.isArray(data.dislikedFilms) || data.dislikedFilms.length === 0) {
    patch.dislikedFilms = digest.rejects.slice(0, 12).map((f) => ({ id: f.movieId, title: f.title, year: f.year ?? '' }));
  }
  if (Object.keys(patch).length) await setDoc(profileRef, patch, { merge: true });
}

/** Remove exactly the docs a write created, then rebuild the taste snapshot. */
export async function undoImport(uid: string, created: CreatedRefs, db: Firestore = defaultDb): Promise<void> {
  const refs = [
    ...created.films.map((id) => doc(db, 'users', uid, 'films', String(id))),
    ...created.nights.map((id) => doc(db, 'users', uid, 'calendar_logs', id)),
    ...created.watchlist.map((id) => doc(db, 'users', uid, 'watchlist', id)),
  ];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
  await generateSnapshot(uid).catch((err) => console.warn('snapshot rebuild after undo failed:', err));
}
