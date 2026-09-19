import { Sparkles, Bookmark, ArrowRight, Check } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';

type TheaterCardProps = {
  insight: string;
  isAnalyzing: boolean;
  onShowMore: () => void;
  onKeepTheater: () => void;
  isLoadingMore: boolean;
  isKeepingTheater: boolean;
  theaterKept?: boolean;
  movieCount: number;
  showMoreResults?: any[];
  onMovieClick?: (movie: any) => void;
  compact?: boolean;
  triggerMovies?: { id: number; title: string; posterPath: string | null }[];
};

export default function TheaterCard({
  insight,
  isAnalyzing,
  onShowMore,
  onKeepTheater,
  isLoadingMore,
  isKeepingTheater,
  theaterKept = false,
  movieCount,
  showMoreResults = [],
  onMovieClick,
  compact = false,
  triggerMovies = [],
}: TheaterCardProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">
              Pattern found
            </span>
          </div>

          {triggerMovies.length > 0 && (
            <div className="flex gap-1.5 mb-2">
              {triggerMovies.map((movie) => (
                <div key={movie.id} className="flex-shrink-0">
                  {movie.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${movie.posterPath}`}
                      alt={movie.title}
                      className="w-10 h-[60px] rounded object-cover border border-gray-700"
                      title={movie.title}
                    />
                  ) : (
                    <div
                      className="w-10 h-[60px] rounded bg-gray-800 border border-gray-700 flex items-center justify-center"
                      title={movie.title}
                    >
                      <span className="text-[8px] text-gray-500 text-center leading-tight px-0.5">{movie.title}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-gray-500">
              <SelectsChaseLoader size="xs" />
              <span className="text-xs italic">Detecting pattern...</span>
            </div>
          ) : (
            <p className="text-xs text-gray-300 leading-relaxed mb-2">
              {insight}
            </p>
          )}

          {!isAnalyzing && (
            <div className="flex gap-2">
              <button
                onClick={onShowMore}
                disabled={isLoadingMore}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <SelectsChaseLoader size="xs" activeColor="#FFFFFF" idleColor="rgba(255,255,255,0.4)" />
                    Finding...
                  </>
                ) : (
                  <>
                    Show me more
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
              <button
                onClick={onKeepTheater}
                disabled={isKeepingTheater || theaterKept}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed border ${
                  theaterKept
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 disabled:opacity-50'
                }`}
              >
                {isKeepingTheater ? (
                  <SelectsChaseLoader size="xs" />
                ) : theaterKept ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Bookmark className="w-3 h-3" />
                )}
                {theaterKept ? 'Kept' : 'Keep'}
              </button>
            </div>
          )}

          {showMoreResults.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                More films in this Theater
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {showMoreResults.map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => onMovieClick?.(movie)}
                    className="flex-shrink-0 w-14 group"
                  >
                    {movie.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${movie.posterPath}`}
                        alt={movie.title}
                        className="w-14 h-20 rounded object-cover border border-gray-700 group-hover:border-purple-400 transition-colors"
                      />
                    ) : (
                      <div className="w-14 h-20 rounded bg-gray-800 border border-gray-700 flex items-center justify-center">
                        <span className="text-[8px] text-gray-500 text-center px-0.5">{movie.title}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate group-hover:text-white transition-colors">
                      {movie.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#1a0a2e] via-[#0f1a3d] to-[#1a0a2e] border-b border-purple-500/50 rounded-xl">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-full bg-purple-500/20">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">
            Pattern Detected • {movieCount} films explored
          </span>
        </div>

        {triggerMovies.length > 0 && (
          <div className="flex gap-2 mb-3">
            {triggerMovies.map((movie) => (
              <div key={movie.id} className="flex-shrink-0">
                {movie.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w200${movie.posterPath}`}
                    alt={movie.title}
                    className="w-10 h-[60px] rounded object-cover border border-purple-500/30"
                    title={movie.title}
                  />
                ) : (
                  <div
                    className="w-10 h-[60px] rounded bg-gray-800 border border-purple-500/30 flex items-center justify-center"
                    title={movie.title}
                  >
                    <span className="text-[8px] text-gray-500 text-center leading-tight px-0.5">{movie.title}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-gray-400">
              <SelectsChaseLoader size="sm" />
              <span className="text-sm italic">Reading your cinematic soul...</span>
            </div>
          ) : (
            <p className="text-sm text-gray-200 leading-relaxed">
              {insight}
            </p>
          )}
        </div>

        {!isAnalyzing && (
          <div className="flex gap-2">
            <button
              onClick={onShowMore}
              disabled={isLoadingMore}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <SelectsChaseLoader size="xs" activeColor="#FFFFFF" idleColor="rgba(255,255,255,0.4)" />
                  Finding films...
                </>
              ) : (
                <>
                  Show me more
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            
            <button
              onClick={onKeepTheater}
              disabled={isKeepingTheater || theaterKept}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors disabled:cursor-not-allowed border ${
                theaterKept 
                  ? 'bg-green-600 border-green-600 text-white' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 disabled:opacity-50'
              }`}
            >
              {isKeepingTheater ? (
                <SelectsChaseLoader size="xs" />
              ) : theaterKept ? (
                <Check className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{theaterKept ? 'Kept!' : 'Keep Theater'}</span>
            </button>
          </div>
        )}

        {showMoreResults.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-500/20">
            <p className="text-xs text-purple-300 uppercase tracking-wide mb-3">
              More films in this Theater
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {showMoreResults.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => onMovieClick?.(movie)}
                  className="flex-shrink-0 w-20 group"
                >
                  {movie.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${movie.posterPath}`}
                      alt={movie.title}
                      className="w-20 h-28 rounded-lg object-cover border border-purple-500/30 group-hover:border-purple-400 transition-colors"
                    />
                  ) : (
                    <div className="w-20 h-28 rounded-lg bg-gray-800 flex items-center justify-center border border-purple-500/30">
                      <span className="text-xs text-gray-500 text-center px-1">{movie.title}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1 truncate group-hover:text-white transition-colors">
                    {movie.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
