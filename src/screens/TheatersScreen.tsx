import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Trash2, ChevronRight, X } from 'lucide-react';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import { getDocs, deleteDoc, orderBy, query, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { legacyTheaterDoc, legacyTheatersCollection } from '../lib/legacyTheaters';
import { useAuth } from '../hooks/useAuth';

type KeptTheater = {
 id: string;
 pattern: string;
 movies: {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  mediaType: 'movie' | 'tv';
 }[];
 createdAt: any;
};

const buildImageUrl = (path: string | null, size: 'w200' | 'w500' = 'w200') => {
 if (!path) return null;
 return `https://image.tmdb.org/t/p/${size}${path}`;
};

const PAGE_SIZE = 10;

export default function TheatersScreen() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const [theaters, setTheaters] = useState<KeptTheater[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isLoadingMore, setIsLoadingMore] = useState(false);
 const [hasMore, setHasMore] = useState(true);
 const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [selectedTheater, setSelectedTheater] = useState<KeptTheater | null>(null);
 const observerRef = useRef<IntersectionObserver | null>(null);
 const loadMoreRef = useRef<HTMLDivElement | null>(null);

 const fetchTheaters = useCallback(async (isInitial = true) => {
  if (!user) return;

  if (isInitial) {
   setIsLoading(true);
  } else {
   setIsLoadingMore(true);
  }
  
  try {
   const theatersRef = legacyTheatersCollection(user.uid);
   let q;
   
   if (isInitial || !lastDoc) {
    q = query(theatersRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
   } else {
    q = query(theatersRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
   }
   
   const snapshot = await getDocs(q);
   
   const fetchedTheaters = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
   })) as KeptTheater[];
   
   if (isInitial) {
    setTheaters(fetchedTheaters);
   } else {
    setTheaters(prev => [...prev, ...fetchedTheaters]);
   }
   
   if (snapshot.docs.length > 0) {
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
   }
   
   setHasMore(snapshot.docs.length === PAGE_SIZE);
  } catch (error) {
   console.error('Failed to fetch Theaters:', error);
  } finally {
   setIsLoading(false);
   setIsLoadingMore(false);
  }
 }, [user, lastDoc]);

 useEffect(() => {
  fetchTheaters(true);
 }, [user]);

 useEffect(() => {
  if (!loadMoreRef.current || !hasMore || isLoadingMore) return;

  observerRef.current = new IntersectionObserver(
   (entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
     fetchTheaters(false);
    }
   },
   { threshold: 0.1 }
  );

  observerRef.current.observe(loadMoreRef.current);

  return () => {
   if (observerRef.current) {
    observerRef.current.disconnect();
   }
  };
 }, [hasMore, isLoadingMore, fetchTheaters]);

 const handleDelete = async (theaterId: string) => {
  if (!user) return;
  
  setDeletingId(theaterId);
  try {
   await deleteDoc(legacyTheaterDoc(user.uid, theaterId));
   setTheaters((prev) => prev.filter((v) => v.id !== theaterId));
  } catch (error) {
   console.error('Failed to delete Theater:', error);
  } finally {
   setDeletingId(null);
  }
 };

 const handleTheaterClick = (theater: KeptTheater) => {
  setSelectedTheater(theater);
 };

 const handleMovieClick = (movie: KeptTheater['movies'][0]) => {
  setSelectedTheater(null);
  navigate(`/movie/${movie.id}?type=${movie.mediaType}`);
 };

 const formatDate = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
   month: 'short',
   day: 'numeric',
   year: 'numeric',
  });
 };

 return (
  <div className="min-h-screen bg-black text-fg">
   <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-line">
    <div className="flex items-center gap-3 p-4">
     <button
      onClick={() => navigate(-1)}
      className="p-2 -ml-2 text-fg-2 hover:text-fg transition-colors min-h-11 min-w-11"
            aria-label="Go back"
     >
      <ArrowLeft size={24} />
     </button>
     <div>
      <h1 className="text-xl font-bold">Theaters</h1>
      <p className="text-sm text-fg-3">Your curated taste patterns</p>
     </div>
    </div>
   </div>

   <div className="p-4">
    {isLoading ? (
     <div className="flex items-center justify-center py-16">
      <SelectsChaseLoader size="lg" />
     </div>
    ) : theaters.length === 0 ? (
     <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-4 bg-purple-900/30 flex items-center justify-center">
       <Sparkles className="w-8 h-8 text-fg-2" />
      </div>
      <h3 className="text-lg font-semibold text-fg-2 mb-2">
       No Theaters yet
      </h3>
      <p className="text-fg-3 max-w-xs mx-auto mb-6">
       Explore movies in Discover and keep interesting patterns you find.
      </p>
      <button
       onClick={() => navigate('/discover')}
       className="px-6 py-3 bg-fg hover:bg-fg-2 font-semibold transition-colors"
      >
       Start Discovering
      </button>
     </div>
    ) : (
     <div className="space-y-4">
      {theaters.map((theater) => (
       <div
        key={theater.id}
        className=" bg-gradient-to-br from-gray-900 to-gray-950 border border-line overflow-hidden"
       >
        <button
         onClick={() => handleTheaterClick(theater)}
         className="w-full p-4 text-left hover:bg-gray-800/50 transition-colors"
        >
         <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-fg-2 flex-shrink-0" />
            <span className="text-xs text-fg-3">
             {formatDate(theater.createdAt)}
            </span>
           </div>
           <p className="text-gray-200 leading-relaxed line-clamp-2">
            {theater.pattern}
           </p>
          </div>
          <ChevronRight className="w-5 h-5 text-fg-3 flex-shrink-0 mt-1" />
         </div>
        </button>

        <div className="px-4 pb-4">
         <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {theater.movies.slice(0, 6).map((movie) => (
           <div
            key={`${movie.mediaType}-${movie.id}`}
            className="flex-shrink-0 w-16"
           >
            {movie.posterPath ? (
             <img
              src={buildImageUrl(movie.posterPath)!}
              alt={movie.title}
              className="w-16 h-24 rounded-lg object-cover border border-line"
             />
            ) : (
             <div className="w-16 h-24 rounded-lg bg-gray-800 flex items-center justify-center border border-line">
              <span className="text-xs text-fg-3">?</span>
             </div>
            )}
            <p className="text-xs text-fg-3 mt-1 truncate">
             {movie.title}
            </p>
           </div>
          ))}
          {theater.movies.length > 6 && (
           <div className="flex-shrink-0 w-16 h-24 rounded-lg bg-gray-800 flex items-center justify-center border border-line">
            <span className="text-sm text-fg-2">
             +{theater.movies.length - 6}
            </span>
           </div>
          )}
         </div>
        </div>

        <div className="px-4 pb-4 flex justify-end">
         <button
          onClick={(e) => {
           e.stopPropagation();
           handleDelete(theater.id);
          }}
          disabled={deletingId === theater.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
         >
          {deletingId === theater.id ? (
           <SelectsChaseLoader size="xs" />
          ) : (
           <Trash2 className="w-4 h-4" />
          )}
          Delete
         </button>
        </div>
       </div>
      ))}
      
      <div ref={loadMoreRef} className="py-4 flex justify-center">
       {isLoadingMore && (
        <SelectsChaseLoader size="sm" />
       )}
       {!hasMore && theaters.length > 0 && (
        <p className="text-sm text-fg-3">No more Theaters</p>
       )}
      </div>
     </div>
    )}
   </div>

   {selectedTheater && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
     <div 
      className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      onClick={() => setSelectedTheater(null)} 
     />
     
     <div className="relative bg-gradient-to-br from-gray-900 to-black w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-line overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-line p-4">
       <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-fg-2 flex-shrink-0" />
          <span className="text-sm text-fg-2">
           {selectedTheater.movies.length} movies
          </span>
         </div>
         <p className="text-fg leading-relaxed font-medium">
          {selectedTheater.pattern}
         </p>
        </div>
        <button
         onClick={() => setSelectedTheater(null)}
         className="p-2 text-fg-3 hover:text-fg hover:bg-gray-800 transition-colors flex-shrink-0"
        >
         <X size={20} />
        </button>
       </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
       <div className="grid grid-cols-3 gap-3">
        {selectedTheater.movies.map((movie, index) => (
         <div
          key={`${movie.mediaType}-${movie.id}`}
          onClick={() => handleMovieClick(movie)}
          className="cursor-pointer transform transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ animationDelay: `${index * 50}ms` }}
         >
          {movie.posterPath ? (
           <img
            src={buildImageUrl(movie.posterPath)!}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover border border-line hover:border-purple-500 transition-colors"
           />
          ) : (
           <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center border border-line hover:border-purple-500 transition-colors">
            <span className="text-xs text-fg-3">?</span>
           </div>
          )}
          <p className="text-xs text-fg-2 mt-2 truncate text-center">
           {movie.title}
          </p>
          <p className="text-[10px] text-fg-3 truncate text-center">
           {movie.year}
          </p>
         </div>
        ))}
       </div>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}

