import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import { useLibrary } from '../lib/library';
import { VerdictBadge } from '../components/VerdictPicker';

export default function LikedMoviesScreen() {
 const navigate = useNavigate();
 const { films, loading } = useLibrary();

 const movies = useMemo(
  () =>
   films
    .filter((f) => f.watched && f.verdict === 'liked')
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? '') || b.updatedAt - a.updatedAt),
  [films],
 );

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
      <Heart size={18} className="text-red-400 fill-current" />
      Liked Movies
     </h1>
     <p className="text-xs text-fg-3">{movies.length} films</p>
    </div>
   </div>

   <div className="flex-1 overflow-y-auto p-4">
    {loading ? (
     <div className="flex items-center justify-center py-20">
      <SelectsChaseLoader size="lg" />
     </div>
    ) : movies.length === 0 ? (
     <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-gray-900 flex items-center justify-center mb-4">
       <Heart className="w-10 h-10 text-fg-3" />
      </div>
      <h3 className="text-lg font-medium text-fg-2 mb-2">No liked movies yet</h3>
      <p className="text-sm text-fg-3 max-w-xs">
       Mark a film Liked after watching and it will appear here.
      </p>
     </div>
    ) : (
     <div className="grid grid-cols-3 gap-3">
      {movies.map((item) => (
       <button
        key={item.movieId}
        onClick={() => navigate(`/movie/${item.movieId}?type=${item.mediaType}`)}
        className="relative overflow-hidden bg-gray-900 border border-line group cursor-pointer transform transition-all duration-200 hover:scale-105 active:scale-95 text-left"
       >
        <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
        <div className="absolute top-1.5 right-1.5">
         <VerdictBadge verdict="liked" size={22} />
        </div>
        {item.watchCount > 1 && (
         <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-[10px] font-bold text-fg">x{item.watchCount}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2">
         <h4 className="text-xs font-bold text-fg leading-tight truncate">{item.title}</h4>
         <p className="text-[10px] text-fg-2">{item.year}</p>
        </div>
       </button>
      ))}
     </div>
    )}
   </div>
  </div>
 );
}
