import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { backfillLibrary } from './backfill';
import { filmsRef, parseFilm } from './ledger';
import type { LibraryFilm } from './types';

const backfilled = new Set<string>();

/** Live view of the user's film ledger. Runs the legacy backfill once per session. */
export function useLibrary() {
  const { user } = useAuth();
  const [films, setFilms] = useState<LibraryFilm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFilms([]);
      setLoading(false);
      return;
    }
    if (!backfilled.has(user.uid)) {
      backfilled.add(user.uid);
      void backfillLibrary(user.uid).catch((err) => console.warn('library backfill failed:', err));
    }
    const unsubscribe = onSnapshot(
      filmsRef(user.uid),
      (snap) => {
        const next = snap.docs
          .map((d) => parseFilm(d.data(), Number(d.id)))
          .filter((f): f is LibraryFilm => f != null);
        setFilms(next);
        setLoading(false);
      },
      (err) => {
        console.error('library snapshot failed:', err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const byId = useMemo(() => {
    const map = new Map<number, LibraryFilm>();
    for (const f of films) map.set(f.movieId, f);
    return map;
  }, [films]);

  return { films, byId, loading };
}

export function useLibraryFilm(movieId: number | null | undefined): { film: LibraryFilm | null; loading: boolean } {
  const { byId, loading } = useLibrary();
  return { film: movieId != null ? byId.get(movieId) ?? null : null, loading };
}
