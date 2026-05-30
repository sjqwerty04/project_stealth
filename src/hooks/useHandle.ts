import { useCallback } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  orderBy,
  startAt,
  endAt,
  limit as fbLimit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;
// High Unicode codepoint used as upper bound for prefix range queries.
const PREFIX_TAIL = '';

export type HandleSearchResult = {
  uid: string;
  handle: string;
  displayName: string;
  profileImage: string;
};

export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '');
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_REGEX.test(handle);
}

export function useHandle() {
  const { user } = useAuth();

  const isAvailable = useCallback(
    async (handle: string): Promise<boolean> => {
      const lower = normalizeHandle(handle);
      if (!isValidHandle(lower)) return false;
      const handleDoc = await getDoc(doc(db, 'handles', lower));
      if (!handleDoc.exists()) return true;
      return handleDoc.data()?.uid === user?.uid;
    },
    [user]
  );

  const claimHandle = useCallback(
    async (handle: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const lower = normalizeHandle(handle);
      if (!isValidHandle(lower)) {
        throw new Error('Handle must be 3-20 chars: a-z, 0-9, underscore');
      }

      const handleRef = doc(db, 'handles', lower);
      const userRef = doc(db, 'users', user.uid);

      await runTransaction(db, async (tx) => {
        const handleSnap = await tx.get(handleRef);
        if (handleSnap.exists() && handleSnap.data()?.uid !== user.uid) {
          throw new Error('Handle already taken');
        }
        const userSnap = await tx.get(userRef);
        const existingProfile = userSnap.data()?.profile ?? {};
        const previousLower = existingProfile.handleLower as string | undefined;

        if (previousLower && previousLower !== lower) {
          tx.delete(doc(db, 'handles', previousLower));
        }

        tx.set(handleRef, {
          uid: user.uid,
          handle: lower,
          // Denormalized so search results don't need cross-user profile reads.
          displayName: existingProfile.displayName ?? user.displayName ?? lower,
          profileImage:
            existingProfile.profileImage ??
            user.photoURL ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          claimedAt: serverTimestamp(),
        });

        tx.set(
          userRef,
          {
            profile: {
              ...existingProfile,
              handle: lower,
              handleLower: lower,
              updatedAt: serverTimestamp(),
            },
          },
          { merge: true }
        );
      });
    },
    [user]
  );

  const searchHandles = useCallback(
    async (queryStr: string): Promise<HandleSearchResult[]> => {
      const lower = normalizeHandle(queryStr);
      if (lower.length < 2) return [];

      const handlesRef = collection(db, 'handles');
      const q = query(
        handlesRef,
        orderBy('handle'),
        startAt(lower),
        endAt(lower + PREFIX_TAIL),
        fbLimit(10)
      );
      const snap = await getDocs(q);

      return snap.docs
        .map((d) => {
          const data = d.data();
          if (!data?.uid) return null;
          return {
            uid: data.uid as string,
            handle: d.id,
            displayName: (data.displayName as string) ?? d.id,
            profileImage: (data.profileImage as string) ?? '',
          };
        })
        .filter((r): r is HandleSearchResult => r !== null);
    },
    []
  );

  return { claimHandle, isAvailable, searchHandles };
}
