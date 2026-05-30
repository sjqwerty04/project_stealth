import { useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';

const INVITE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function generateCode(length = 10): string {
  let s = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    s += INVITE_ALPHABET[arr[i] % INVITE_ALPHABET.length];
  }
  return s;
}

export type InviteResolution = {
  code: string;
  listId: string;
  listName: string;
  ownerDisplayName: string;
  revoked: boolean;
};

export function useInviteLink() {
  const { user } = useAuth();
  const { profile, profileImage } = useUserProfile();

  const createInvite = useCallback(
    async (listId: string, listName: string): Promise<{ code: string; url: string }> => {
      if (!user) throw new Error('Not authenticated');
      const code = generateCode(10);
      await setDoc(doc(db, 'shared_watchlist_invites', code), {
        listId,
        listName,
        createdBy: user.uid,
        createdByDisplayName: profile?.displayName ?? user.displayName ?? user.email ?? 'A friend',
        createdAt: serverTimestamp(),
        revoked: false,
      });
      const base = import.meta.env.VITE_APP_URL || 'https://selects-film.vercel.app';
      const url = `${base}/invite/${code}`;
      return { code, url };
    },
    [user, profile]
  );

  const resolveInvite = useCallback(
    async (code: string): Promise<InviteResolution | null> => {
      const snap = await getDoc(doc(db, 'shared_watchlist_invites', code));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        code,
        listId: data.listId,
        listName: data.listName,
        ownerDisplayName: data.createdByDisplayName ?? 'A friend',
        revoked: data.revoked === true,
      };
    },
    []
  );

  const acceptInvite = useCallback(
    async (code: string): Promise<string> => {
      if (!user) throw new Error('Not authenticated');
      const inviteRef = doc(db, 'shared_watchlist_invites', code);

      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) throw new Error('Invite not found');
      const invite = inviteSnap.data();
      if (invite.revoked) throw new Error('Invite revoked');
      const listId = invite.listId as string;

      // Use updateDoc directly — new members can't read the list yet so a
      // transaction would fail. The Firestore rule validates the self-join.
      await updateDoc(doc(db, 'shared_watchlists', listId), {
        memberUids: arrayUnion(user.uid),
        [`members.${user.uid}`]: {
          handle: profile?.handle ?? null,
          displayName:
            profile?.displayName ?? user.displayName ?? user.email ?? 'Member',
          profileImage,
          joinedAt: new Date(),
        },
        updatedAt: serverTimestamp(),
      });

      return listId;
    },
    [user, profile, profileImage]
  );

  return { createInvite, resolveInvite, acceptInvite };
}
