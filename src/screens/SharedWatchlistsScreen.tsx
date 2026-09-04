import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Users, X } from 'lucide-react';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';

export default function SharedWatchlistsScreen() {
 const navigate = useNavigate();
 const { lists, loading, createList } = useSharedWatchlists();
 const [showCreate, setShowCreate] = useState(false);
 const [name, setName] = useState('');
 const [creating, setCreating] = useState(false);

 const submitCreate = async () => {
  const trimmed = name.trim();
  if (!trimmed) return;
  setCreating(true);
  const id = await createList(trimmed);
  setCreating(false);
  setShowCreate(false);
  setName('');
  if (id) navigate(`/shared/${id}`);
 };

 return (
  <div className="min-h-screen bg-base font-display text-fg flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-line">
   <div className="bg-base/90 backdrop-blur-md px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-line">
    <div className="flex items-center gap-4">
     <button
      onClick={() => navigate('/watchlist')}
      className="p-2 text-fg-2 hover:text-fg hover:bg-gray-800 transition-colors min-h-11 min-w-11"
            aria-label="Go back"
     >
      <ArrowLeft size={20} />
     </button>
     <div>
      <h1 className="text-xl font-bold text-fg">Shared lists</h1>
      <p className="text-xs text-fg-3">Watch together with friends</p>
     </div>
    </div>
    <button
     onClick={() => setShowCreate(true)}
     className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-fg text-sm font-medium transition-colors"
    >
     <Plus size={16} />
     New
    </button>
   </div>

   <div className="flex-1 overflow-y-auto p-4">
    {loading ? (
     <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-fg-3 animate-spin" />
     </div>
    ) : lists.length === 0 ? (
     <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-gray-900 flex items-center justify-center mb-4">
       <Users className="w-10 h-10 text-fg-3" />
      </div>
      <h3 className="text-lg font-medium text-fg-2 mb-2">No shared lists yet</h3>
      <p className="text-sm text-fg-3 max-w-xs mb-6">
       Create a list and invite a friend to add movies together.
      </p>
      <button
       onClick={() => setShowCreate(true)}
       className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-fg font-medium transition-colors"
      >
       Create shared list
      </button>
     </div>
    ) : (
     <div className="space-y-2">
      {lists.map((list) => {
       const memberCount = list.memberUids?.length ?? 0;
       const memberAvatars = Object.values(list.members ?? {}).slice(0, 4);
       return (
        <button
         key={list.id}
         onClick={() => navigate(`/shared/${list.id}`)}
         className="w-full text-left bg-gray-900/60 hover:bg-gray-900 border border-line p-4 flex items-center gap-3 transition-colors"
        >
         <div className="flex -space-x-2">
          {memberAvatars.map((m, idx) => (
           <div
            key={idx}
            className="w-9 h-9 ring-2 ring-[#09090b] overflow-hidden bg-gray-700 flex items-center justify-center text-xs font-semibold"
           >
            {m.profileImage ? (
             <img src={m.profileImage} alt={m.displayName} className="w-full h-full object-cover" />
            ) : (
             (m.displayName || '?').charAt(0).toUpperCase()
            )}
           </div>
          ))}
         </div>
         <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-fg truncate">{list.name}</h3>
          <p className="text-xs text-fg-3">
           {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </p>
         </div>
        </button>
       );
      })}
     </div>
    )}
   </div>

   {showCreate && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
     <div className="bg-base-2 w-full max-w-sm p-6 shadow-2xl z-50 relative border border-line">
      <div className="flex items-center justify-between mb-4">
       <h3 className="font-bold text-fg text-lg">New shared list</h3>
       <button
        onClick={() => setShowCreate(false)}
        className="p-2 text-fg-2 hover:text-fg hover:bg-gray-800 "
       >
        <X size={16} />
       </button>
      </div>
      <input
       autoFocus
       value={name}
       onChange={(e) => setName(e.target.value)}
       onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
       placeholder="Date Night, Horror Club, etc."
       className="w-full bg-black/40 border border-line px-3 py-3 text-fg outline-none focus:border-blue-500 placeholder-gray-600"
      />
      <button
       onClick={submitCreate}
       disabled={!name.trim() || creating}
       className="w-full mt-4 py-3 font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
       {creating && <Loader2 size={16} className="animate-spin" />}
       Create list
      </button>
     </div>
    </div>
   )}
  </div>
 );
}
