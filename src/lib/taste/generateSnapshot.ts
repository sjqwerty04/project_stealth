import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { axisFromUnknown, buildRecommendContext, emptySnapshot, withCompact } from './buildRecommendContext';
import { parseSnapshot, tasteDoc } from './getTaste';
import type { DiaryEvidence, FilmRef, TasteSnapshot } from './types';

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

export async function loadDiary(uid: string, current: TasteSnapshot): Promise<{ evidence: DiaryEvidence; pointers: TasteSnapshot['pointers'] }> {
  const [calendarSnap, watchedSnap, watchlistSnap, skippedSnap, tasteProfileSnap, eventsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'calendar_logs'), orderBy('date', 'desc'), limit(80))),
    getDocs(collection(db, 'users', uid, 'watched_recommendations')),
    getDocs(collection(db, 'users', uid, 'watchlist')),
    getDocs(collection(db, 'users', uid, 'skipped_recommendations')),
    getDoc(doc(db, 'users', uid, 'profile_data', 'taste_profile')),
    getDocs(query(collection(db, 'users', uid, 'taste_events'), orderBy('createdAt', 'desc'), limit(40))).catch(
      () => ({ docs: [] as Array<{ data: () => Record<string, unknown> }> })
    ),
  ]);

  const profile = tasteProfileSnap.exists() ? (tasteProfileSnap.data() as Record<string, unknown>) : {};
  const favorites = Array.isArray(profile.favoriteFilms)
    ? profile.favoriteFilms
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
        .filter((f) => f.title)
    : [];
  const disliked = Array.isArray(profile.dislikedFilms)
    ? profile.dislikedFilms
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
        .filter((f) => f.title)
    : [];

  const identity = {
    personaLine:
      current.identity.personaLine ||
      (typeof profile.aiPersonaLine === 'string' ? profile.aiPersonaLine : null),
    axis: current.identity.axis || axisFromUnknown(profile.filmPreference),
  };

  const rated: DiaryEvidence['rated'] = [];
  for (const docSnap of calendarSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const film = filmFrom(data);
    if (!film) continue;
    const at = millis(data.updatedAt) || millis(data.date);
    if (data.rating === 'up' || data.rating === 'down') {
      rated.push({ ...film, rating: data.rating, at });
    } else {
      rated.push({ ...film, rating: 3, at });
    }
  }
  for (const docSnap of watchedSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const film = filmFrom(data);
    if (!film) continue;
    if (data.rating === 'up' || data.rating === 'down' || typeof data.letterboxdRating === 'number' || typeof data.imdbRating === 'number') {
      const rating =
        data.rating === 'up' || data.rating === 'down'
          ? data.rating
          : typeof data.letterboxdRating === 'number'
            ? data.letterboxdRating
            : typeof data.imdbRating === 'number'
              ? data.imdbRating
              : null;
      if (rating == null) continue;
      rated.push({ ...film, rating, at: millis(data.ratedAt) || millis(data.importedAt) });
    }
  }

  const watchlist = watchlistSnap.docs
    .map((d) => filmFrom(d.data() as Record<string, unknown>))
    .filter((f): f is FilmRef => f != null);

  const skipped = skippedSnap.docs
    .map((d) => filmFrom(d.data() as Record<string, unknown>))
    .filter((f): f is FilmRef => f != null);

  const searches: string[] = [];
  for (const docSnap of eventsSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const event = data.event as Record<string, unknown> | undefined;
    if (event?.type === 'search' && typeof event.query === 'string') searches.push(event.query);
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
  const next = withCompact({
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
    },
  });
  await setDoc(tasteDoc(uid), next, { merge: true });
  return next;
}
