import { useState } from 'react';
import { Check, Loader2, Users, X } from 'lucide-react';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type Movie = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
};

type Props = { movie: Movie };

export default function AddToSharedListMenu({ movie }: Props) {
  const { user } = useAuth();
  const { profile, profileImage } = useUserProfile();
  const { lists, loading } = useSharedWatchlists();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  if (loading || lists.length === 0) return null;

  const addTo = async (listId: string) => {
    if (!user) return;
    setBusyId(listId);
    try {
      const itemsRef = collection(db, 'shared_watchlists', listId, 'items');
      const dupQ = query(itemsRef, where('movieId', '==', movie.movieId));
      const dupSnap = await getDocs(dupQ);
      if (dupSnap.empty) {
        await addDoc(itemsRef, {
          ...movie,
          addedBy: user.uid,
          addedByHandle: profile?.handle ?? null,
          addedByDisplayName:
            profile?.displayName ?? user.displayName ?? user.email ?? 'Member',
          addedByPhotoURL: profileImage,
          addedAt: serverTimestamp(),
        });
      }
      setDoneIds((s) => new Set(s).add(listId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-sm font-medium transition-colors"
      >
        <Users size={16} />
        Add to a shared list
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-lg">Add to shared list</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lists.map((list) => {
                const memberCount = list.memberUids?.length ?? 0;
                const done = doneIds.has(list.id);
                const busy = busyId === list.id;
                return (
                  <button
                    key={list.id}
                    onClick={() => !done && !busy && addTo(list.id)}
                    disabled={done || busy}
                    className="w-full flex items-center gap-3 bg-black/30 hover:bg-black/50 border border-gray-800 rounded-xl p-3 text-left disabled:opacity-60"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{list.name}</p>
                      <p className="text-xs text-gray-500">
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    {busy && <Loader2 size={16} className="text-gray-400 animate-spin" />}
                    {done && <Check size={16} className="text-green-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
