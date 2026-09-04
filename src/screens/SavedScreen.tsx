import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, CalendarPlus, Loader2, Trash2 } from 'lucide-react';
import { useWatchlist, type WatchlistItem } from '../hooks/useWatchlist';

export default function SavedScreen() {
 const navigate = useNavigate();
 const { items, loading, removeFromWatchlist } = useWatchlist();
 const [selected, setSelected] = useState<WatchlistItem | null>(null);

 const handleRemove = async () => {
  if (!selected) return;
  await removeFromWatchlist(selected.id);
  setSelected(null);
 };

 return (
  <div className="min-h-screen bg-base font-display text-fg flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-line">
   <div className="bg-base/90 backdrop-blur-md px-4 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-line">
    <button
     onClick={() => navigate('/watchlist')}
     className="p-2 text-fg-2 hover:text-fg hover:bg-gray-800 transition-colors min-h-11 min-w-11"
            aria-label="Go back"
    >
     <ArrowLeft size={20} />
    </button>
    <div>
     <h1 className="text-xl font-bold text-fg flex items-center gap-2">
      <Bookmark size={18} className="text-blue-400 fill-current" />
      Saved
     </h1>
     <p className="text-xs text-fg-3">{items.length} film{items.length !== 1 ? 's' : ''}</p>
    </div>
   </div>

   <div className="flex-1 overflow-y-auto p-4">
    {loading ? (
     <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-fg-3 animate-spin" />
     </div>
    ) : items.length === 0 ? (
     <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-gray-900 flex items-center justify-center mb-4">
       <Bookmark className="w-10 h-10 text-fg-3" />
      </div>
      <h3 className="text-lg font-medium text-fg-2 mb-2">Nothing saved yet</h3>
      <p className="text-sm text-fg-3 max-w-xs">
       Open a movie and tap the list button to save it here.
      </p>
     </div>
    ) : (
     <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
       <button
        key={item.id}
        onClick={() => setSelected(item)}
        className="relative overflow-hidden bg-gray-900 border border-line group cursor-pointer transform transition-all duration-200 hover:scale-105 active:scale-95 text-left"
       >
        <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
        <div className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-blue-500 text-fg">
         <Bookmark size={14} className="fill-current" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2">
         <h4 className="text-xs font-bold text-fg leading-tight truncate">{item.title}</h4>
         <p className="text-[10px] text-fg-2">{item.year}</p>
        </div>
       </button>
      ))}
     </div>
    )}
   </div>

   {selected && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
     <div className="bg-base-2 w-full max-w-sm p-6 shadow-2xl z-50 relative border border-line">
      <div className="flex gap-4 mb-6">
       <img src={selected.poster} alt={selected.title} className="w-20 h-28 object-cover border border-line" />
       <div className="flex-1">
        <h3 className="font-bold text-fg text-lg">{selected.title}</h3>
        <p className="text-sm text-fg-2">{selected.year}</p>
       </div>
      </div>
      <div className="space-y-3">
       <button
        onClick={() => navigate(`/movie/${selected.movieId}?type=movie`)}
        className="w-full py-3 font-medium bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2"
       >
        View Details
       </button>
       <button
        onClick={() => { navigate(`/movie/${selected.movieId}?type=movie`); setSelected(null); }}
        className="w-full py-3 font-medium bg-green-600 hover:bg-green-500 text-fg flex items-center justify-center gap-2"
       >
        <CalendarPlus size={18} />
        Mark as Watched
       </button>
       <button
        onClick={handleRemove}
        className="w-full py-3 font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 flex items-center justify-center gap-2"
       >
        <Trash2 size={18} />
        Remove
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
