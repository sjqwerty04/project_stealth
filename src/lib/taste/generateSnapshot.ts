import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { parseFilm } from '../library/ledger';
import type { LibraryFilm } from '../library/types';
import { starsOf, verdictOf } from '../library/verdict';
import { axisFromUnknown, buildRecommendContext, emptySnapshot, meaningfulTags, withCompact } from './buildRecommendContext';
import { generatedDiaryFields } from './parseSelectPicks';
import { parseSnapshot, tasteDoc } from './getTaste';
import type { DiaryEvidence, FilmRef, LibraryStats, RatedFilm, TasteSnapshot } from './types';

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function filmFrom(data: Record<string, unknown>): FilmRef | null {
  const title = typeof data.title === 'string' ? data.title : '';
  if (!title) return null;
  return {
    movieId: typeof data.movieId === 'number' ? data.movieId : undefined,
    title,
    year: typeof data.year === 'string' || typeof data.year === 'number' ? data.year : undefined,
  };
}

function refsFromProfile(value: unknown): FilmRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => {
      if (typeof f === 'string') return { title: f };
      if (f && typeof f === 'object') {
        const row = f as Record<string, unknown>;
        return {
          movieId: typeof row.id === 'number' ? row.id : typeof row.movieId === 'number' ? row.movieId : undefined,
          title: typeof row.title === 'string' ? row.title : '',
          year: typeof row.year === 'string' || typeof row.year === 'number' ? row.year : undefined,
        };
      }
      return { title: '' };
    })
    .filter((f) => f.title);
}

/** Pure. Summarise the ledger for the compact taste line. Exported for tests. */
export function libraryStats(films: LibraryFilm[]): LibraryStats | null {
  const watched = films.filter((f) => f.watched);
  if (!watched.length) return null;
  const rated = watched.filter((f) => f.stars != null || f.verdict != null);
  const starred = watched.filter((f) => typeof f.stars === 'number');
  const avgStars = starred.length ? starred.reduce((sum, f) => sum + (f.stars ?? 0), 0) / starred.length : null;
  const byLast = [...watched].sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''));
  const canon = byLast
    .filter((f) => f.verdict !== 'nope' && (f.hearted || (f.stars ?? 0) >= 4.5 || f.watchCount >= 2))
    .sort((a, b) => (b.stars ?? 0) + b.watchCount - ((a.stars ?? 0) + a.watchCount))
    .slice(0, 8)
    .map((f) => f.title);
  const rewatches = watched
    .filter((f) => f.watchCount >= 2)
    .sort((a, b) => b.watchCount - a.watchCount)
    .slice(0, 5)
    .map((f) => `${f.title} x${f.watchCount}`);
  const recent = byLast.filter((f) => f.lastWatchedAt).slice(0, 6).map((f) => f.title);
  const rejects = byLast.filter((f) => f.verdict === 'nope').slice(0, 6).map((f) => f.title);
  const tags = meaningfulTags(watched.flatMap((f) => f.tags));
  const quotes = watched
    .filter((f) => f.reviewExcerpt && (f.stars ?? 0) >= 4)
    .slice(0, 2)
    .map((f) => (f.reviewExcerpt ?? '').slice(0, 140).trim());
  return {
    watched: watched.length,
    rated: rated.length,
    avgStars: avgStars != null ? Math.round(avgStars * 10) / 10 : null,
    canon,
    rewatches,
    recent,
    rejects,
    tags,
    quotes,
  };
}

/** Pure. Ledger films to rated evidence. Exported for tests. */
export function ratedFromLibrary(films: LibraryFilm[]): RatedFilm[] {
  return films
    .filter((f) => f.watched)
    .map((f) => ({
      movieId: f.movieId,
      title: f.title,
      year: f.year,
      verdict: f.verdict,
      stars: f.stars,
      hearted: f.hearted,
      watchCount: f.watchCount,
      at: f.lastWatchedAt ? Date.parse(f.lastWatchedAt) || f.updatedAt : f.updatedAt,
    }));
}

export async function loadDiary(uid: string, current: TasteSnapshot): Promise<{ evidence: DiaryEvidence; pointers: TasteSnapshot['pointers'] }> {
  const [calendarSnap, filmsSnap, watchlistSnap, skippedSnap, tasteProfileSnap, eventsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'calendar_logs'), orderBy('date', 'desc'), limit(80))),
    getDocs(collection(db, 'users', uid, 'films')),
    getDocs(collection(db, 'users', uid, 'watchlist')),
    getDocs(collection(db, 'users', uid, 'skipped_recommendations')),
    getDoc(doc(db, 'users', uid, 'profile_data', 'taste_profile')),
    getDocs(query(collection(db, 'users', uid, 'taste_events'), orderBy('createdAt', 'desc'), limit(40))).catch(
      () => ({ docs: [] as Array<{ data: () => Record<string, unknown> }> })
    ),
  ]);

  const profile = tasteProfileSnap.exists() ? (tasteProfileSnap.data() as Record<string, unknown>) : {};
  const favorites = refsFromProfile(profile.favoriteFilms);
  const disliked = refsFromProfile(profile.dislikedFilms);

  const identity = {
    personaLine:
      current.identity.personaLine ||
      (typeof profile.aiPersonaLine === 'string' ? profile.aiPersonaLine : null),
    axis: current.identity.axis || axisFromUnknown(profile.filmPreference),
  };

  const films = filmsSnap.docs
    .map((d) => parseFilm(d.data(), Number(d.id)))
    .filter((f): f is LibraryFilm => f != null);
  const inLedger = new Set(films.map((f) => f.movieId));

  const rated: RatedFilm[] = ratedFromLibrary(films);
  for (const docSnap of calendarSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const film = filmFrom(data);
    if (!film) continue;
    if (film.movieId != null && inLedger.has(film.movieId)) continue;
    if (data.status === 'planned') continue;
    const at = millis(data.updatedAt) || millis(data.date);
    rated.push({ ...film, verdict: verdictOf(data), stars: starsOf(data), at });
  }

  const watchlist = watchlistSnap.docs
    .map((d) => filmFrom(d.data() as Record<string, unknown>))
    .filter((f): f is FilmRef => f != null);
  for (const f of films) {
    if (f.onWatchlist && !f.watched && !watchlist.some((w) => w.movieId === f.movieId)) {
      watchlist.push({ movieId: f.movieId, title: f.title, year: f.year });
    }
  }

  const skipped = skippedSnap.docs
    .map((d) => filmFrom(d.data() as Record<string, unknown>))
    .filter((f): f is FilmRef => f != null);

  const searches: string[] = [];
  const curious: FilmRef[] = [];
  for (const docSnap of eventsSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const event = data.event as Record<string, unknown> | undefined;
    if (event?.type === 'search' && typeof event.query === 'string') searches.push(event.query);
    if (event?.type === 'import' && event.digest && typeof event.digest === 'object') {
      const digest = event.digest as { curious?: unknown };
      for (const ref of refsFromProfile(digest.curious)) {
        if (!inLedger.has(ref.movieId ?? -1)) curious.push(ref);
      }
    }
  }

  return {
    evidence: {
      identity,
      favorites,
      disliked,
      rated,
      watchlist,
      skipped,
      searches,
      patterns: current.generated.patterns,
      curious,
      library: libraryStats(films),
    },
    pointers: {
      lastEventId: current.pointers.lastEventId,
      calendarLogIds: calendarSnap.docs.slice(0, 20).map((d) => d.id),
      watchlistIds: watchlistSnap.docs.slice(0, 20).map((d) => d.id),
    },
  };
}

export async function generateSnapshot(uid: string, fromEventId?: string | null): Promise<TasteSnapshot> {
  const currentSnap = await getDoc(tasteDoc(uid));
  const current = currentSnap.exists() ? parseSnapshot(currentSnap.data()) : emptySnapshot();
  const { evidence, pointers } = await loadDiary(uid, current);
  const context = buildRecommendContext(evidence);
  const next = withCompact(
    {
      ...current,
      identity: evidence.identity,
      pointers: { ...pointers, lastEventId: fromEventId ?? pointers.lastEventId },
      context,
      generated: {
        ...current.generated,
        updatedAt: Date.now(),
        fromEventId: fromEventId ?? current.generated.fromEventId,
        patterns: current.generated.patterns,
        insightCards: current.generated.insightCards,
        lastPicks: current.generated.lastPicks,
        lastPicksAt: current.generated.lastPicksAt,
        library: evidence.library ?? null,
      },
    },
    evidence.library,
  );
  if (!currentSnap.exists()) {
    await setDoc(tasteDoc(uid), next);
    return next;
  }
  await setDoc(
    tasteDoc(uid),
    {
      identity: next.identity,
      pointers: next.pointers,
      context: next.context,
    },
    { merge: true },
  );
  await updateDoc(tasteDoc(uid), generatedDiaryFields(next.generated));
  return next;
}
