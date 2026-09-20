import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { posterUrl } from '../lib/fallbackCatalog';
import { useAuth } from './useAuth';

export type ProfileFilm = { title: string; poster?: string };

function posterFrom(row: Record<string, unknown>): string | undefined {
  const raw =
    (typeof row.posterPath === 'string' && row.posterPath) ||
    (typeof row.poster === 'string' && row.poster) ||
    '';
  if (!raw) return undefined;
  return raw.startsWith('http') ? raw : posterUrl(raw, 'w500');
}

/** Onboarding picks live only in the taste profile, so their posters are invisible to the ledger. */
export function profileFilms(data: unknown): ProfileFilm[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as Record<string, unknown>;
  const out: ProfileFilm[] = [];
  for (const key of ['favoriteFilms', 'dislikedFilms']) {
    const list = source[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const poster = posterFrom(row);
      if (!title || !poster) continue;
      out.push({ title, poster });
    }
  }
  return out;
}

export function useProfileFilms(): ProfileFilm[] {
  const { user } = useAuth();
  const [films, setFilms] = useState<ProfileFilm[]>([]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setFilms([]);
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, 'users', uid, 'profile_data', 'taste_profile'))
      .then((snap) => {
        if (cancelled) return;
        setFilms(snap.exists() ? profileFilms(snap.data()) : []);
      })
      .catch((err) => console.warn('taste profile posters failed:', err));
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return films;
}
