import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

type LikedMovie = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
};

export default function LikedMoviesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movies, setMovies] = useState<LikedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const seen = new Set<number>();
      const results: LikedMovie[] = [];

      // Source 1: watched_recommendations with rating 'up'
      const recSnap = await getDocs(
        collection(db, 'users', user.uid, 'watched_recommendations')
      );
      for (const d of recSnap.docs) {
        const data = d.data();
        if (data.rating === 'up' && data.movieId && !seen.has(data.movieId)) {
          seen.add(data.movieId);
          results.push({
            movieId: data.movieId,
            title: data.title ?? '',
            year: data.year ?? '',
            poster: data.poster ?? '',
          });
        }
      }

      // Source 2: calendar_logs with rating 'up'
      const calSnap = await getDocs(
        collection(db, 'users', user.uid, 'calendar_logs')
      );
      for (const d of calSnap.docs) {
        const data = d.data();
        if (data.rating === 'up' && data.movieId && !seen.has(data.movieId)) {
          seen.add(data.movieId);
          results.push({
            movieId: data.movieId,
            title: data.title ?? '',
            year: data.year ?? '',
            poster: data.poster ?? '',
          });
        }
      }

      setMovies(results);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-gray-100 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-800">
      <div className="bg-[#09090b]/90 backdrop-blur-md px-4 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-800">
        <button
          onClick={() => navigate('/watchlist')}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart size={18} className="text-red-400 fill-current" />
            Liked Movies
          </h1>
          <p className="text-xs text-gray-500">{movies.length} films</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-4">
              <Heart className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No liked movies yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Give a thumbs up after watching a film and it'll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {movies.map((item) => (
              <button
                key={item.movieId}
                onClick={() => navigate(`/movie/${item.movieId}?type=movie`)}
                className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 group cursor-pointer transform transition-all duration-200 hover:scale-105 active:scale-95 text-left"
              >
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full aspect-[2/3] object-cover"
                />
                <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center">
                  <Heart size={12} className="fill-white text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2">
                  <h4 className="text-xs font-bold text-white leading-tight truncate">{item.title}</h4>
                  <p className="text-[10px] text-gray-400">{item.year}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
