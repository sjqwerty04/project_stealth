import { useEffect, useState } from 'react';
import { BookmarkCheck, Check, ListPlus, Loader2, Users, X } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';

export type PickerMovie = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
};

type Props = {
  movie: PickerMovie;
  open: boolean;
  onClose: () => void;
};

export default function AddToListPicker({ movie, open, onClose }: Props) {
  const { user } = useAuth();
  const { profile, profileImage } = useUserProfile();
  const { addToWatchlist, isInWatchlist } = useWatchlist();
  const { lists, createList } = useSharedWatchlists();

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  // Pre-populate "Saved" state
  useEffect(() => {
    if (open) {
      setDone((d) => ({ ...d, __saved__: isInWatchlist(movie.movieId) }));
    }
  }, [open, movie.movieId, isInWatchlist]);

  const addToSaved = async () => {
    if (done.__saved__) return;
    setBusy((b) => ({ ...b, __saved__: true }));
    await addToWatchlist(movie);
    setDone((d) => ({ ...d, __saved__: true }));
    setBusy((b) => ({ ...b, __saved__: false }));
  };

  const addToList = async (listId: string) => {
    if (!user || done[listId]) return;
    setBusy((b) => ({ ...b, [listId]: true }));
    try {
      const itemsRef = collection(db, 'shared_watchlists', listId, 'items');
      const dup = await getDocs(query(itemsRef, where('movieId', '==', movie.movieId)));
      if (dup.empty) {
        await addDoc(itemsRef, {
          ...movie,
          addedBy: user.uid,
          addedByHandle: profile?.handle ?? null,
          addedByDisplayName: profile?.displayName ?? user.displayName ?? user.email ?? 'Member',
          addedByPhotoURL: profileImage,
          addedAt: serverTimestamp(),
        });
      }
      setDone((d) => ({ ...d, [listId]: true }));
    } finally {
      setBusy((b) => ({ ...b, [listId]: false }));
    }
  };

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    const id = await createList(name, { isPersonal: true });
    if (id) {
      await addToList(id);
    }
    setCreating(false);
    setShowNewList(false);
    setNewListName('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[#18181b] rounded-t-3xl border-t border-x border-gray-800 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">Add to list</h3>
            <p className="text-xs text-gray-500 truncate max-w-[240px]">{movie.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[55vh] px-3 space-y-1 pb-2">
          {/* Saved (legacy watchlist) */}
          <ListRow
            icon={<BookmarkCheck size={18} className="text-blue-400" />}
            label="Saved"
            subtitle="Your default watchlist"
            done={!!done.__saved__}
            busy={!!busy.__saved__}
            onTap={addToSaved}
          />

          {/* Personal playlists */}
          {lists.filter((l) => l.isPersonal).map((list) => (
            <ListRow
              key={list.id}
              icon={<ListPlus size={18} className="text-purple-400" />}
              label={list.name}
              subtitle="Personal playlist"
              done={!!done[list.id]}
              busy={!!busy[list.id]}
              onTap={() => addToList(list.id)}
            />
          ))}

          {/* Shared lists */}
          {lists.filter((l) => !l.isPersonal).map((list) => {
            const memberCount = list.memberUids?.length ?? 0;
            return (
              <ListRow
                key={list.id}
                icon={<Users size={18} className="text-green-400" />}
                label={list.name}
                subtitle={`Shared · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
                done={!!done[list.id]}
                busy={!!busy[list.id]}
                onTap={() => addToList(list.id)}
              />
            );
          })}

          {/* New personal playlist */}
          {showNewList ? (
            <div className="bg-black/30 rounded-2xl border border-gray-800 p-3 space-y-2">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Playlist name…"
                className="w-full bg-transparent outline-none text-white placeholder-gray-600 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewList(false); setNewListName(''); }}
                  className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newListName.trim() || creating}
                  className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  Create & Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewList(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors text-sm"
            >
              <ListPlus size={18} />
              New playlist…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  icon,
  label,
  subtitle,
  done,
  busy,
  onTap,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  done: boolean;
  busy: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      disabled={done || busy}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-800/50 transition-colors disabled:opacity-70 text-left"
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        {busy ? (
          <Loader2 size={16} className="text-gray-400 animate-spin" />
        ) : done ? (
          <Check size={16} className="text-green-400" />
        ) : null}
      </div>
    </button>
  );
}
