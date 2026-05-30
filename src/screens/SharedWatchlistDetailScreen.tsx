import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Search, Share2, Trash2, UserMinus, Users, X } from 'lucide-react';
import {
  arrayRemove,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSharedWatchlist } from '../hooks/useSharedWatchlistItems';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';
import { useAuth } from '../hooks/useAuth';
import AddedByChip from '../components/AddedByChip';
import InviteShareModal from '../components/InviteShareModal';

export default function SharedWatchlistDetailScreen() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { list, items, loading, error, removeItem } = useSharedWatchlist(listId);
  const { leaveList, deleteList } = useSharedWatchlists();

  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState<typeof items[number] | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const isOwner = list && user && list.ownerUid === user.uid;
  const memberAvatars = list ? Object.values(list.members ?? {}).slice(0, 4) : [];
  const extraCount = list ? Math.max(0, (list.memberUids?.length ?? 0) - memberAvatars.length) : 0;

  const handleRemoveMovie = async () => {
    if (!selected) return;
    await removeItem(selected.id);
    setSelected(null);
  };

  const handleRemoveMember = async (uid: string) => {
    if (!listId) return;
    setRemovingMember(uid);
    try {
      await updateDoc(doc(db, 'shared_watchlists', listId), {
        memberUids: arrayRemove(uid),
        [`members.${uid}`]: deleteField(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleLeave = async () => {
    if (!listId) return;
    await leaveList(listId);
    navigate('/watchlist');
  };

  const handleDelete = async () => {
    if (!listId) return;
    if (!confirm('Delete this list for everyone?')) return;
    await deleteList(listId);
    navigate('/watchlist');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
        <Users className="w-12 h-12 text-gray-700 mb-4" />
        <h2 className="text-lg font-semibold mb-2">{error}</h2>
        <button
          onClick={() => navigate('/watchlist')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-gray-100 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-800">
      {/* Header */}
      <div className="bg-[#09090b]/90 backdrop-blur-md px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/watchlist')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{list?.name ?? 'Loading…'}</h1>
            <button
              onClick={() => setShowMembers(true)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 mt-0.5"
            >
              <Users size={12} />
              {list?.memberUids?.length ?? 0} members
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Stacked member avatars */}
          <div className="flex -space-x-2">
            {memberAvatars.map((m, idx) => (
              <AddedByChip key={idx} displayName={m.displayName} handle={m.handle} photoURL={m.profileImage} size={28} />
            ))}
            {extraCount > 0 && (
              <div className="w-7 h-7 rounded-full ring-2 ring-black/70 bg-gray-800 text-xs flex items-center justify-center font-semibold">
                +{extraCount}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="ml-1 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
            aria-label="Invite"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No movies yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              Search for a movie and save it to this list.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => navigate('/discover')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-xl font-medium transition-colors hover:bg-gray-200"
              >
                <Search size={18} />
                Add a movie
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 text-gray-300 rounded-xl font-medium transition-colors hover:bg-gray-800"
              >
                <Plus size={18} />
                Invite a friend
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Add movie button when list has items */}
            <button
              onClick={() => navigate('/discover')}
              className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors text-sm"
            >
              <Search size={15} />
              Search to add a movie
            </button>

            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 group cursor-pointer transform transition-all duration-200 hover:scale-105 active:scale-95 text-left"
                >
                  <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
                  <div className="absolute bottom-1.5 left-1.5">
                    <AddedByChip
                      displayName={item.addedByDisplayName}
                      handle={item.addedByHandle}
                      photoURL={item.addedByPhotoURL}
                      size={22}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2">
                    <h4 className="text-xs font-bold text-white leading-tight truncate">{item.title}</h4>
                    <p className="text-[10px] text-gray-400">{item.year}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Movie action modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex gap-4 mb-4">
              <img src={selected.poster} alt={selected.title} className="w-20 h-28 object-cover rounded-xl border border-gray-800" />
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">{selected.title}</h3>
                <p className="text-sm text-gray-400">{selected.year}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <AddedByChip
                    displayName={selected.addedByDisplayName}
                    handle={selected.addedByHandle}
                    photoURL={selected.addedByPhotoURL}
                    size={18}
                  />
                  Added by {selected.addedByHandle ? `@${selected.addedByHandle}` : selected.addedByDisplayName}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/movie/${selected.movieId}?type=movie`)}
                className="w-full py-3 rounded-xl font-medium bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2"
              >
                View Details
              </button>
              {(selected.addedBy === user?.uid || isOwner) && (
                <button
                  onClick={handleRemoveMovie}
                  className="w-full py-3 rounded-xl font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Remove from list
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members modal */}
      {showMembers && list && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowMembers(false)} />
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-lg">Members</h3>
              <button onClick={() => setShowMembers(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {Object.entries(list.members ?? {}).map(([uid, m]) => (
                <div key={uid} className="flex items-center gap-3 bg-black/30 rounded-xl p-3 border border-gray-800">
                  <AddedByChip displayName={m.displayName} handle={m.handle} photoURL={m.profileImage} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.displayName}</p>
                    {m.handle && <p className="text-xs text-gray-500">@{m.handle}</p>}
                  </div>
                  {uid === list.ownerUid ? (
                    <span className="text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5">
                      Owner
                    </span>
                  ) : isOwner ? (
                    <button
                      onClick={() => handleRemoveMember(uid)}
                      disabled={removingMember === uid}
                      className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                      title={`Remove ${m.displayName}`}
                    >
                      {removingMember === uid
                        ? <Loader2 size={15} className="animate-spin" />
                        : <UserMinus size={15} />}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {isOwner ? (
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete list for everyone
              </button>
            ) : (
              <button
                onClick={handleLeave}
                className="w-full py-3 rounded-xl font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 flex items-center justify-center gap-2"
              >
                Leave list
              </button>
            )}
          </div>
        </div>
      )}

      {list && (
        <InviteShareModal list={list} open={showInvite} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
