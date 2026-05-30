import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';
import type { SharedWatchlist } from './useSharedWatchlists';

export type SharedWatchlistItem = {
  id: string;
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
  addedBy: string;
  addedByHandle: string | null;
  addedByDisplayName: string;
  addedByPhotoURL: string;
  addedAt: any;
};

export function useSharedWatchlist(listId: string | undefined) {
  const { user } = useAuth();
  const { profile, profileImage } = useUserProfile();
  const [list, setList] = useState<SharedWatchlist | null>(null);
  const [items, setItems] = useState<SharedWatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to the list document
  useEffect(() => {
    if (!listId || !user) {
      setList(null);
      return;
    }
    const ref = doc(db, 'shared_watchlists', listId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setList(null);
          setError('List no longer available');
          return;
        }
        setList({ id: snap.id, ...(snap.data() as Omit<SharedWatchlist, 'id'>) });
        setError(null);
      },
      (err) => {
        console.error('Failed to load shared list:', err);
        setError('Failed to load list');
      }
    );
    return unsub;
  }, [listId, user]);

  // Subscribe to items
  useEffect(() => {
    if (!listId || !user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'shared_watchlists', listId, 'items'),
      orderBy('addedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedWatchlistItem, 'id'>) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load items:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [listId, user]);

  const addItem = useCallback(
    async (movie: {
      movieId: number;
      title: string;
      year: string | number;
      poster: string;
      backdrop?: string;
      runtime?: string;
    }): Promise<string | null> => {
      if (!user || !listId) return null;
      if (items.some((i) => i.movieId === movie.movieId)) {
        return items.find((i) => i.movieId === movie.movieId)?.id ?? null;
      }
      const ref = await addDoc(collection(db, 'shared_watchlists', listId, 'items'), {
        ...movie,
        addedBy: user.uid,
        addedByHandle: profile?.handle ?? null,
        addedByDisplayName: profile?.displayName ?? user.displayName ?? user.email ?? 'Member',
        addedByPhotoURL: profileImage,
        addedAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user, listId, items, profile, profileImage]
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!listId) return;
      await deleteDoc(doc(db, 'shared_watchlists', listId, 'items', itemId));
    },
    [listId]
  );

  const refresh = useCallback(async () => {
    if (!listId) return;
    const snap = await getDoc(doc(db, 'shared_watchlists', listId));
    if (snap.exists()) {
      setList({ id: snap.id, ...(snap.data() as Omit<SharedWatchlist, 'id'>) });
    }
  }, [listId]);

  return { list, items, loading, error, addItem, removeItem, refresh };
}
