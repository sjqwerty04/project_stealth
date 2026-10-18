import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { setOnWatchlist } from '../library';
import { recordTasteEvent } from '../taste';
import type { VoicePick } from './importClient';

function posterUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

/** Final picks from a call become watchlist rows. A film already saved is left alone. */
export async function saveVoicePicks(uid: string, email: string | null, picks: VoicePick[]): Promise<number> {
  const watchlistRef = collection(db, 'users', uid, 'watchlist');
  let saved = 0;
  for (const pick of picks) {
    if (!pick.tmdbId) continue;
    const existing = await getDocs(query(watchlistRef, where('movieId', '==', pick.tmdbId)));
    if (!existing.empty) continue;
    const poster = posterUrl(pick.posterPath);
    await addDoc(watchlistRef, {
      movieId: pick.tmdbId,
      title: pick.title,
      year: pick.year,
      poster,
      addedAt: serverTimestamp(),
      source: 'voice',
    });
    await setOnWatchlist(uid, { movieId: pick.tmdbId, title: pick.title, year: pick.year, poster }, true).catch(() => undefined);
    if (email) {
      await recordTasteEvent(
        uid,
        { type: 'watchlist_add', movieId: pick.tmdbId, title: pick.title, year: pick.year },
        { email },
      ).catch(() => undefined);
    }
    saved += 1;
  }
  return saved;
}
