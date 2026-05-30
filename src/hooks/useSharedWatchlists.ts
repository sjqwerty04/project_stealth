import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';

export type SharedListMember = {
  handle: string | null;
  displayName: string;
  profileImage: string;
  joinedAt: any;
};

export type SharedWatchlist = {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  members: Record<string, SharedListMember>;
  isPersonal: boolean;
  createdAt: any;
  updatedAt: any;
};

export function useSharedWatchlists() {
  const { user } = useAuth();
  const { profile, profileImage } = useUserProfile();
  const [lists, setLists] = useState<SharedWatchlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'shared_watchlists'),
      where('memberUids', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLists(
          snap.docs.map((d) => {
            const data = d.data() as Omit<SharedWatchlist, 'id'>;
            const item: SharedWatchlist = { id: d.id, ...data };
            if (item.isPersonal === undefined) (item as any).isPersonal = false;
            return item;
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error('Failed to fetch shared watchlists:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const personalLists = lists.filter((l) => l.isPersonal);
  const sharedLists = lists.filter((l) => !l.isPersonal);

  const createList = useCallback(
    async (name: string, options?: { isPersonal?: boolean }): Promise<string | null> => {
      if (!user) return null;
      const trimmed = name.trim() || 'Untitled list';
      const member: SharedListMember = {
        handle: profile?.handle ?? null,
        displayName: profile?.displayName ?? user.displayName ?? user.email ?? 'You',
        profileImage,
        joinedAt: new Date(),
      };
      const ref = await addDoc(collection(db, 'shared_watchlists'), {
        name: trimmed,
        ownerUid: user.uid,
        memberUids: [user.uid],
        members: { [user.uid]: member },
        isPersonal: options?.isPersonal === true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user, profile, profileImage]
  );

  const renameList = useCallback(async (listId: string, name: string): Promise<void> => {
    await updateDoc(doc(db, 'shared_watchlists', listId), {
      name: name.trim() || 'Untitled list',
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteList = useCallback(async (listId: string): Promise<void> => {
    await deleteDoc(doc(db, 'shared_watchlists', listId));
  }, []);

  const leaveList = useCallback(
    async (listId: string): Promise<void> => {
      if (!user) return;
      await updateDoc(doc(db, 'shared_watchlists', listId), {
        memberUids: arrayRemove(user.uid),
        [`members.${user.uid}`]: deleteField(),
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { lists, personalLists, sharedLists, loading, createList, renameList, deleteList, leaveList };
}
