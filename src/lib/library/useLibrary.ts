import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { backfillLibrary } from './backfill';
import { filmsRef, parseFilm } from './ledger';
import type { LibraryFilm } from './types';

const backfilled = new Set<string>();

export type LibrarySnapshot = { uid: string; films: LibraryFilm[] };

export function libraryView(
  uid: string | null,
  snapshot: LibrarySnapshot | null,
): { films: LibraryFilm[]; loading: boolean } {
  if (!uid) return { films: [], loading: false };
  if (snapshot?.uid !== uid) return { films: [], loading: true };
  return { films: snapshot.films, loading: false };
}

/** Live view of the user's film ledger. Runs the legacy backfill once per session. */
export function useLibrary() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);

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
        setSnapshot({ uid, films: [] });
      },
    );
  }, [uid]);

  const { films, loading } = libraryView(uid, snapshot);
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
