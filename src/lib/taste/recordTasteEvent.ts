import { addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity, type ActivityAction } from '../activityLogger';
import { applyTasteEvent, shouldRebuildDiary } from './applyEvent';
import { emptySnapshot } from './buildRecommendContext';
import { generateSnapshot } from './generateSnapshot';
import { getTaste, tasteDoc } from './getTaste';
import { GENERATE_DEBOUNCE_MS, type TasteEvent } from './types';

const pending = new Map<string, ReturnType<typeof setTimeout>>();

function activityFor(event: TasteEvent): { action: ActivityAction; metadata: Record<string, unknown> } | null {
  switch (event.type) {
    case 'movie_viewed':
      return { action: 'movie_viewed', metadata: { movieId: event.movieId, movieTitle: event.title } };
    case 'calendar_log':
      return { action: 'movie_logged', metadata: { movieId: event.movieId, movieTitle: event.title, logDate: event.date } };
    case 'verdict':
      return { action: 'movie_rated', metadata: { movieId: event.movieId, movieTitle: event.title, verdict: event.verdict } };
    case 'watchlist_add':
      return { action: 'movie_added_watchlist', metadata: { movieId: event.movieId, movieTitle: event.title } };
    case 'search':
      return { action: 'search_performed', metadata: { searchQuery: event.query, openedMovieId: event.openedMovieId } };
    case 'orbit_swipe':
      return {
        action: 'orbit_swipe',
        metadata: {
          swipeDirection: event.direction,
          fromMovieId: event.fromMovieId,
          toMovieId: event.toMovieId,
          toMovieTitle: event.toTitle,
        },
      };
    case 'pattern':
      return null;
    default:
      return null;
  }
}

function scheduleRebuild(uid: string, eventId: string) {
  const existing = pending.get(uid);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pending.delete(uid);
    void generateSnapshot(uid, eventId).catch((err) => {
      console.warn('taste snapshot rebuild failed:', err);
    });
  }, GENERATE_DEBOUNCE_MS);
  pending.set(uid, timer);
}

export async function recordTasteEvent(
  uid: string,
  event: TasteEvent,
  opts?: { email?: string | null }
): Promise<string> {
  const eventsRef = collection(db, 'users', uid, 'taste_events');
  const docRef = await addDoc(eventsRef, {
    event,
    createdAt: serverTimestamp(),
  });

  const current = await getTaste(uid).catch(() => emptySnapshot());
  const next = applyTasteEvent(current, event, docRef.id);
  await setDoc(tasteDoc(uid), next, { merge: true });

  if (shouldRebuildDiary(event)) {
    scheduleRebuild(uid, docRef.id);
  }

  if (opts?.email) {
    const mapped = activityFor(event);
    if (mapped) {
      void logActivity(uid, opts.email, mapped.action, mapped.metadata);
    }
  }

  return docRef.id;
}
