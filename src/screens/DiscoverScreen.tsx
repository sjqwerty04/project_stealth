import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, ArrowLeft, Sparkles } from 'lucide-react';
import { classifyQuery, useMovieSearch, type SearchResult } from '../hooks/useMovieSearch';
import SearchResultCard from '../components/SearchResultCard';
import TheaterCard from '../components/TheaterCard';
import { useTheater } from '../contexts/useTheater';
import { theaterCardModel } from '../lib/theater';
import { useAuth } from '../hooks/useAuth';
import { recordTasteEvent } from '../lib/taste';

export default function DiscoverScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preSelectedDate = searchParams.get('date');
  const { user } = useAuth();
  
  // Initialize query from URL param so it survives back navigation
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const { results, isSearching, error, searchMetadata, searchMovies, clearResults } = useMovieSearch();
  const { session, commitSettledQuery, keepTheater, dismissTheater, isKeeping } = useTheater();
  const theater = theaterCardModel(session);

  useEffect(() => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      if (query.trim()) {
        updated.set('q', query.trim());
      } else {
        updated.delete('q');
      }
      return updated;
    }, { replace: true });
  }, [query, setSearchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      if (!trimmed) {
        clearResults();
        return;
      }
      commitSettledQuery(trimmed, classifyQuery(trimmed).mode);
      void searchMovies(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, commitSettledQuery, searchMovies, clearResults]);

  const handleMovieClick = useCallback((movie: SearchResult) => {
    if (user?.uid) {
      void recordTasteEvent(
        user.uid,
        { type: 'search', query: query.trim(), openedMovieId: movie.id, openedTitle: movie.title },
        { email: user.email }
      );
    }
    const params = new URLSearchParams();
    if (preSelectedDate) params.set('date', preSelectedDate);
    params.set('type', movie.mediaType);
    navigate(`/movie/${movie.id}?${params.toString()}`);
  }, [navigate, preSelectedDate, user, query]);

  const handleClearSearch = () => {
    setQuery('');
    clearResults();
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-base text-fg">
      {theater && (
        <div className="fixed bottom-24 left-0 right-0 px-4 sm:px-6 z-30 pointer-events-none">
          <div className="relative max-w-md mx-auto pointer-events-auto drop-shadow-2xl max-h-[60vh] overflow-y-auto">
            <TheaterCard
              {...theater}
              onKeep={() => void keepTheater()}
              onDismiss={dismissTheater}
              onFilmClick={(film) => navigate(`/movie/${film.id}?type=${film.mediaType}`)}
              isKeeping={isKeeping}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-base border-b border-line">
        {/* Search Bar */}
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 min-h-11 min-w-11 text-fg-2 hover:text-fg"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hunt a film"
              aria-label="Search movies and shows"
              autoFocus
              data-testid="orbit-search"
              className="w-full pl-10 pr-10 py-3 min-h-11 bg-base-2 border border-line text-fg placeholder-fg-3 focus:outline-none focus:border-fg-2"
            />
            {query && (
              <button
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        
        {/* Pre-selected date indicator */}
        {preSelectedDate && (
          <div className="px-4 pb-3">
            <div className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full inline-block">
              Adding to {new Date(preSelectedDate + 'T12:00:00').toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`p-4 ${theater ? 'pb-40' : 'pb-12'}`}>
        {/* Loading State */}
        {isSearching && (
          <div className="flex items-center justify-center py-12">
            <div className="w-20 h-8 bg-base-3" data-testid="skeleton" />
          </div>
        )}

        {/* Error State */}
        {error && !isSearching && (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!query && !isSearching && results.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-display text-fg mb-2">
              Hunt a film
            </h3>
            <p className="text-fg-3 max-w-xs mx-auto">
              Search to start an orbit. After a few picks, a Theater shows up here.
            </p>
          </div>
        )}

        {/* No Results */}
        {query && !isSearching && results.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-400">No results for "{query}"</p>
            <p className="text-gray-600 text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {/* Results List */}
        {results.length > 0 && !isSearching && (
          <div className="space-y-4">
            {/* Search mode label */}
            {searchMetadata.label && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Sparkles className="w-4 h-4" />
                <span>{searchMetadata.label}</span>
              </div>
            )}
            
            <div className="space-y-3">
              {results.map((movie) => (
                <SearchResultCard
                  key={`${movie.mediaType}-${movie.id}`}
                  movieId={movie.id}
                  title={movie.title}
                  year={movie.year}
                  posterPath={movie.posterPath}
                  backdropPath={movie.backdropPath}
                  genres={movie.genres}
                  onClick={() => handleMovieClick(movie)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
