import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

// Builds a compact summary of the user's taste from their liked/disliked/watchlist
// signals, for personalizing blurbs and chat recommendations. Self-contained read
// of the same Firestore collections the recommendation engine uses.
export function useTasteProfile() {
  const { user } = useAuth();
  const [tasteSummary, setTasteSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setTasteSummary('');
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const [recsSnap, calSnap, watchlistSnap] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'watched_recommendations')),
          getDocs(collection(db, 'users', user.uid, 'calendar')),
          getDocs(collection(db, 'users', user.uid, 'watchlist')),
        ]);

        const liked = new Set<string>();
        const disliked = new Set<string>();

        for (const d of recsSnap.docs) {
          const r = d.data();
          if (!r.title) continue;
          if (r.rating === 'up') liked.add(r.title);
          else if (r.rating === 'down') disliked.add(r.title);
        }
        for (const d of calSnap.docs) {
          const e = d.data();
          if (!e.title) continue;
          if (e.rating === 'up') liked.add(e.title);
          else if (e.rating === 'down') disliked.add(e.title);
        }

        const watchlist = watchlistSnap.docs.map((d) => d.data().title).filter(Boolean) as string[];

        const parts: string[] = [];
        if (liked.size) parts.push(`Loved: ${Array.from(liked).slice(0, 25).join(', ')}`);
        if (disliked.size) parts.push(`Disliked: ${Array.from(disliked).slice(0, 12).join(', ')}`);
        if (watchlist.length) parts.push(`Wants to watch: ${watchlist.slice(0, 15).join(', ')}`);

        if (!cancelled) setTasteSummary(parts.join('\n'));
      } catch (err) {
        console.warn('useTasteProfile failed:', err);
        if (!cancelled) setTasteSummary('');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return { tasteSummary, isLoading };
}
