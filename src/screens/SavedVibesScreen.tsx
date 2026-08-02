import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Trash2, Loader2, ChevronRight, X } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { imageUrlOrNull, type PosterSize } from '../lib/tmdb';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

type SavedVibe = {
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

const buildImageUrl = (path: string | null, size: PosterSize = 'w200') => imageUrlOrNull(path, size);

const PAGE_SIZE = 10;

export default function SavedVibesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vibes, setVibes] = useState<SavedVibe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<SavedVibe | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchVibes = useCallback(async (isInitial = true) => {
    if (!user) return;

    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const vibesRef = collection(db, 'users', user.uid, 'saved_vibes');
      let q;
      
      if (isInitial || !lastDoc) {
        q = query(vibesRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      } else {
        q = query(vibesRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      }
      
      const snapshot = await getDocs(q);
      
      const fetchedVibes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SavedVibe[];
      
      if (isInitial) {
        setVibes(fetchedVibes);
      } else {
        setVibes(prev => [...prev, ...fetchedVibes]);
      }
      
      // Set the last document for pagination
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      // Check if there are more results
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch vibes:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, lastDoc]);

  // Initial load
  useEffect(() => {
    fetchVibes(true);
  }, [user]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchVibes(false);
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
  }, [hasMore, isLoadingMore, fetchVibes]);

  const handleDelete = async (vibeId: string) => {
    if (!user) return;
    
    setDeletingId(vibeId);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'saved_vibes', vibeId));
      setVibes((prev) => prev.filter((v) => v.id !== vibeId));
    } catch (error) {
      console.error('Failed to delete vibe:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleVibeClick = (vibe: SavedVibe) => {
    // Show modal with all movies in the vibe
    setSelectedVibe(vibe);
  };

  const handleMovieClick = (movie: SavedVibe['movies'][0]) => {
    setSelectedVibe(null);
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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Saved Vibes</h1>
            <p className="text-sm text-gray-500">Your curated taste patterns</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : vibes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-900/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              No saved vibes yet
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto mb-6">
              Explore movies in Discover and save interesting patterns you find.
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-colors"
            >
              Start Discovering
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {vibes.map((vibe) => (
              <div
                key={vibe.id}
                className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 overflow-hidden"
              >
                {/* Vibe Header */}
                <button
                  onClick={() => handleVibeClick(vibe)}
                  className="w-full p-4 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500">
                          {formatDate(vibe.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-200 leading-relaxed line-clamp-2">
                        {vibe.pattern}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
                  </div>
                </button>

                {/* Movie Posters */}
                <div className="px-4 pb-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {vibe.movies.slice(0, 6).map((movie) => (
                      <div
                        key={`${movie.mediaType}-${movie.id}`}
                        className="flex-shrink-0 w-16"
                      >
                        {movie.posterPath ? (
                          <img
                            src={buildImageUrl(movie.posterPath)!}
                            alt={movie.title}
                            className="w-16 h-24 rounded-lg object-cover border border-gray-700"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                            <span className="text-xs text-gray-500">?</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {movie.title}
                        </p>
                      </div>
                    ))}
                    {vibe.movies.length > 6 && (
                      <div className="flex-shrink-0 w-16 h-24 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                        <span className="text-sm text-gray-400">
                          +{vibe.movies.length - 6}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <div className="px-4 pb-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(vibe.id);
                    }}
                    disabled={deletingId === vibe.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === vibe.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {/* Load More / Infinite Scroll Trigger */}
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isLoadingMore && (
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              )}
              {!hasMore && vibes.length > 0 && (
                <p className="text-sm text-gray-500">No more vibes</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vibe Detail Modal */}
      {selectedVibe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setSelectedVibe(null)} 
          />
          
          <div className="relative bg-gradient-to-br from-gray-900 to-black w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-gray-800 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-400">
                      {selectedVibe.movies.length} movies
                    </span>
                  </div>
                  <p className="text-gray-100 leading-relaxed font-medium">
                    {selectedVibe.pattern}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVibe(null)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Movie Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {selectedVibe.movies.map((movie, index) => (
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
                        className="w-full aspect-[2/3] rounded-xl object-cover border border-gray-700 hover:border-purple-500 transition-colors"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] rounded-xl bg-gray-800 flex items-center justify-center border border-gray-700 hover:border-purple-500 transition-colors">
                        <span className="text-xs text-gray-500">?</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2 truncate text-center">
                      {movie.title}
                    </p>
                    <p className="text-[10px] text-gray-600 truncate text-center">
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

