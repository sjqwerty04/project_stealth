import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { backfillLibrary } from './backfill';
import { filmsRef, parseFilm } from './ledger';
import type { LibraryFilm } from './types';

const backfilled = new Set<string>();
const EMPTY: LibraryFilm[] = [];

type Snapshot = { uid: string; films: LibraryFilm[] };

/** Live view of the user's film ledger. Runs the legacy backfill once per session. */
export function useLibrary() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!uid) return;
    if (!backfilled.has(uid)) {
      backfilled.add(uid);
      void backfillLibrary(uid).catch((err) => console.warn('library backfill failed:', err));
    }
    return onSnapshot(
      filmsRef(uid),
      (snap) => {
        const next = snap.docs
          .map((d) => parseFilm(d.data(), Number(d.id)))
          .filter((f): f is LibraryFilm => f != null);
        setSnapshot({ uid, films: next });
      },
      (err) => {
        console.error('library snapshot failed:', err);
        setSnapshot((prev) => ({ uid, films: prev?.uid === uid ? prev.films : [] }));
      },
    );
  }, [uid]);

  const films = !uid || snapshot?.uid !== uid ? EMPTY : snapshot.films;
  const loading = Boolean(uid) && snapshot?.uid !== uid;

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
