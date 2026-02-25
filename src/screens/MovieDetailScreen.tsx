import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Orbit, X, ThumbsUp, ThumbsDown, Check, Plus, Volume2, VolumeX } from 'lucide-react';
import { useMovieDetails } from '../hooks/useMovieDetails';
import { useSimilarVibes } from '../hooks/useSimilarVibes';
import { useWatchlist } from '../hooks/useWatchlist';
import { useCalendarLogs } from '../hooks/useCalendarLogs';
import { useExploration } from '../contexts/ExplorationContext';
import MovieActions from '../components/MovieActions';
import SearchResultCard from '../components/SearchResultCard';
import PatternAssistant from '../components/PatternAssistant';
import RatingBadges from '../components/RatingBadges';
import TechBadges from '../components/TechBadges';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../lib/activityLogger';

const buildImageUrl = (path: string | null, size: 'w200' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export default function MovieDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedDate = searchParams.get('date');
  const mediaType = (searchParams.get('type') as 'movie' | 'tv') || 'movie';
  const fromOrbit = searchParams.get('from') === 'orbit';
  
  const { user } = useAuth();
  const { details, isLoading, isLoadingVibe, error, fetchDetails } = useMovieDetails();
  const { similarMovies, isLoading: isLoadingSimilar, loadMore, hasMore } = useSimilarVibes();
  const { addToWatchlist, isInWatchlist, removeFromWatchlist, getWatchlistItem } = useWatchlist();
  const { addEvent } = useCalendarLogs();
  const {
    clickedMovies,
    addMovie,
    patternInsight,
    isAnalyzing,
    showMoreMovies,
    showMoreResults,
    isLoadingMore,
    saveVibe,
    isSavingVibe,
    vibeSaved,
    dismissPattern,
  } = useExploration();
  
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false);
  const [isMarkingSeen, setIsMarkingSeen] = useState(false);
  const [isMarkedSeen, setIsMarkedSeen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(preSelectedDate || new Date().toISOString().split('T')[0]);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'up' | 'down' | null>(null);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if selected date is past or today
  const isPastDate = useCallback((dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(dateStr + 'T00:00:00');
    return selected <= today;
  }, []);

  useEffect(() => {
    if (id) {
      fetchDetails(parseInt(id), mediaType);
    }
  }, [id, mediaType, fetchDetails]);

  // Auto-show rating picker when landing on page with past pre-selected date
  useEffect(() => {
    if (preSelectedDate && isPastDate(preSelectedDate) && !showRatingPicker && !showSuccessState) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        setShowRatingPicker(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [preSelectedDate, isPastDate, showRatingPicker, showSuccessState]);

  // Log movie view for activity tracking
  useEffect(() => {
    if (details && user?.uid && user?.email) {
      logActivity(user.uid, user.email, 'movie_viewed', {
        movieId: details.id,
        movieTitle: details.title,
        mediaType: details.mediaType,
      });
    }
  }, [details?.id, user?.uid, user?.email]);

  // Track this movie view for pattern detection
  useEffect(() => {
    if (details) {
      addMovie({
        id: details.id,
        title: details.title,
        year: details.year,
        posterPath: details.posterPath,
        backdropPath: details.backdropPath,
        genres: details.genres,
        mediaType: details.mediaType,
      });
    }
  }, [details, addMovie]);

  const handleBack = () => {
    navigate(-1);
  };

  const toggleMute = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      const command = isMuted ? 'unMute' : 'mute';
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command }),
        '*'
      );
    }
    setIsMuted(!isMuted);
  };

  const showPatternAssistant = clickedMovies.length >= 3 && patternInsight;

  const handleAddToCalendar = useCallback(async () => {
    if (!details || !user) return;
    
    // Step 1: If no date selected yet (no preSelectedDate), show date picker
    if (!preSelectedDate && !showDatePicker && !showRatingPicker) {
      setShowDatePicker(true);
      return;
    }

    // Step 2: If date is in the past and no rating selected yet, show rating picker
    if (isPastDate(selectedDate) && !selectedRating) {
      if (!showRatingPicker) {
        setShowDatePicker(false);
        setShowRatingPicker(true);
      }
      return; // Don't proceed without rating for past dates
    }

    setIsAddingToCalendar(true);
    try {
      // Force the saved timestamp to land in the middle of the selected day
      // so timezone conversions don't shift it to the previous date.
      const normalizedDate = new Date(`${selectedDate}T12:00:00`);
      const safeDate = Number.isNaN(normalizedDate.getTime())
        ? new Date()
        : normalizedDate;

      const isPast = isPastDate(selectedDate);

      // Save to calendar logs
      await addEvent({
        movieId: details.id,
        title: details.title,
        poster: buildImageUrl(details.posterPath) || '',
        date: safeDate.toISOString(),
        inviteFriend: false,
        rating: isPast ? selectedRating : null,
        status: isPast ? 'watched' : 'planned',
        backdrop: buildImageUrl(details.backdropPath, 'w780') || undefined,
        mediaType: details.mediaType,
        year: details.year,
        runtimeLabel: details.runtime || 'Feature',
      });

      // ALSO save to watched_recommendations if it's a past date with rating
      if (isPast && selectedRating) {
        const watchedRef = collection(db, 'users', user.uid, 'watched_recommendations');
        await addDoc(watchedRef, {
          movieId: details.id,
          title: details.title,
          year: details.year,
          poster: buildImageUrl(details.posterPath) || '',
          backdrop: buildImageUrl(details.backdropPath, 'w780') || undefined,
          runtime: details.runtime,
          mediaType: details.mediaType,
          rating: selectedRating,
          ratedAt: serverTimestamp(),
          source: 'calendar',
        });
      }
      
      // Auto-remove from watchlist when logging as watched
      if (isPast) {
        const watchlistItem = getWatchlistItem(details.id);
        if (watchlistItem) {
          await removeFromWatchlist(watchlistItem.id);
        }
      }

      setShowDatePicker(false);
      setShowRatingPicker(false);
      
      // Show success state for past dates, navigate directly for future dates
      if (isPast) {
        setShowSuccessState(true);
      } else {
        navigate(`/app?date=${selectedDate}`);
      }
    } catch (err) {
      console.error('Failed to add to calendar:', err);
    } finally {
      setIsAddingToCalendar(false);
    }
  }, [details, user, preSelectedDate, showDatePicker, showRatingPicker, selectedDate, selectedRating, isPastDate, addEvent, navigate, getWatchlistItem, removeFromWatchlist]);

  const handleAddToWatchlist = useCallback(async () => {
    if (!details) return;
    
    setIsAddingToWatchlist(true);
    try {
      await addToWatchlist({
        movieId: details.id,
        title: details.title,
        year: details.year,
        poster: buildImageUrl(details.posterPath) || '',
        backdrop: buildImageUrl(details.backdropPath, 'w780') || undefined,
        runtime: details.runtime,
      });
    } catch (err) {
      console.error('Failed to add to watchlist:', err);
    } finally {
      setIsAddingToWatchlist(false);
    }
  }, [details, addToWatchlist]);

  const handleMarkAsSeen = useCallback(async (rating: 'up' | 'down') => {
    if (!details || !user) return;
    
    setIsMarkingSeen(true);
    try {
      const watchedRef = collection(db, 'users', user.uid, 'watched_recommendations');
      await addDoc(watchedRef, {
        movieId: details.id,
        title: details.title,
        year: details.year,
        poster: buildImageUrl(details.posterPath) || '',
        backdrop: buildImageUrl(details.backdropPath, 'w780') || undefined,
        runtime: details.runtime,
        mediaType: details.mediaType,
        rating,
        ratedAt: serverTimestamp(),
        source: 'discovery',
      });

      // Auto-remove from watchlist when marked as seen
      const watchlistItem = getWatchlistItem(details.id);
      if (watchlistItem) {
        await removeFromWatchlist(watchlistItem.id);
      }

      setIsMarkedSeen(true);
    } catch (err) {
      console.error('Failed to mark as seen:', err);
    } finally {
      setIsMarkingSeen(false);
    }
  }, [details, user, getWatchlistItem, removeFromWatchlist]);

  const handleSimilarMovieClick = (movie: any) => {
    navigate(`/movie/${movie.id}?type=movie`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 mb-4">{error || 'Movie not found'}</p>
        <button onClick={handleBack} className="text-blue-400 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const backdropUrl = buildImageUrl(details.backdropPath, 'original');
  const posterUrl = buildImageUrl(details.posterPath, 'w500');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative">
        {/* Backdrop or Trailer */}
        <div className="h-72 sm:h-96 relative overflow-hidden">
          {details.trailer ? (
            <>
              {/* Scale iframe larger to crop YouTube UI */}
              <div className="absolute inset-0 scale-110">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${details.trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${details.trailer.key}&playsinline=1&rel=0&modestbranding=1&showinfo=0&enablejsapi=1`}
                  className="absolute inset-0 w-full h-full"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay; encrypted-media"
                  title="Trailer"
                />
              </div>
              {/* Gradient overlay that blocks pointer events to YouTube */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-auto" />
              
              {/* Mute/Unmute Button */}
              <button
                onClick={toggleMute}
                className="absolute bottom-4 right-4 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10 pointer-events-auto"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </>
          ) : backdropUrl ? (
            <>
              <img
                src={backdropUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            </>
          ) : (
            <>
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            </>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10 flex items-center gap-2"
        >
          <ArrowLeft size={24} />
          {fromOrbit && (
            <span className="text-sm font-medium pr-2">Back to Orbit</span>
          )}
        </button>

        {/* Poster & Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-4">
          {posterUrl && (
            <img
              src={posterUrl}
              alt={details.title}
              className="w-28 sm:w-36 rounded-xl border-2 border-gray-800 shadow-2xl -mt-20 relative z-10"
            />
          )}
          <div className="flex-1 min-w-0 self-end pb-2">
            {/* Movie Logo or Title */}
            {details.logoPath ? (
              <img
                src={`https://image.tmdb.org/t/p/w500${details.logoPath}`}
                alt={details.title}
                className="max-h-12 sm:max-h-16 w-auto max-w-full object-contain drop-shadow-lg"
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {details.title}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Year, Runtime, Genres & Ratings — grouped below hero */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
            <span>{details.year}</span>
            {details.runtime && (
              <>
                <span className="text-gray-600">•</span>
                <span>{details.runtime}</span>
              </>
            )}
          </div>

          {/* Genre Tags */}
          {details.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {details.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Rating Badges */}
          {details.ratings && (
            <RatingBadges ratings={details.ratings} />
          )}

          {/* Tech Badges (IMAX, Dolby, Certification) */}
          {details.techSpecs && (
            <TechBadges techSpecs={details.techSpecs} />
          )}
        </div>

        {/* AI Vibe Description */}
        {(details.vibeDescription || isLoadingVibe) && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20">
            {isLoadingVibe ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm italic">Reading the vibe...</span>
              </div>
            ) : (
              <p className="text-gray-200 italic leading-relaxed">
                "{details.vibeDescription}"
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <MovieActions
          onAddToCalendar={handleAddToCalendar}
          onAddToWatchlist={handleAddToWatchlist}
          onMarkAsSeen={handleMarkAsSeen}
          isInWatchlist={isInWatchlist(details.id)}
          isMarkedSeen={isMarkedSeen}
          isAddingToCalendar={isAddingToCalendar}
          isAddingToWatchlist={isAddingToWatchlist}
          isMarkingSeen={isMarkingSeen}
        />

        {/* Enter Orbit - Viewfinder Selects */}
        {mediaType === 'movie' && (
          <button
            onClick={() => navigate(`/orbit/${details.id}`)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white font-semibold text-lg shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Orbit className="w-5 h-5" />
            <span>Enter Orbit</span>
            <span className="text-white/60 text-sm font-normal">• Discover Similar Films</span>
          </button>
        )}

        {/* Date Picker Modal */}
        {showDatePicker && !showRatingPicker && !showSuccessState && (
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
            <label className="block text-sm text-gray-400 mb-2">Select date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCalendar}
                disabled={isAddingToCalendar}
                className="flex-1 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50"
              >
                {isAddingToCalendar ? 'Adding...' : isPastDate(selectedDate) ? 'Next: Rate Movie' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        )}

        {/* Rating Picker Modal Overlay for Past Dates */}
        {showRatingPicker && !showSuccessState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm p-6 rounded-2xl bg-gray-900 border border-gray-700 space-y-5 shadow-2xl">
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-1">Log Movie</h3>
                <p className="text-sm text-gray-400">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
              
              {/* Movie preview */}
              {details && (
                <div className="flex gap-3 items-center bg-gray-800/50 p-3 rounded-xl">
                  <img 
                    src={buildImageUrl(details.posterPath) || ''} 
                    className="w-12 h-18 object-cover rounded-lg" 
                    alt={details.title} 
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{details.title}</h4>
                    <p className="text-sm text-gray-400">{details.year}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm font-bold text-gray-400 mb-3 block text-center">How was it?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedRating('up')}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${
                      selectedRating === 'up'
                        ? 'border-green-500 bg-green-900/30 text-green-400 scale-105'
                        : 'border-gray-700 bg-gray-800 text-gray-500 hover:bg-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <ThumbsUp size={36} className={selectedRating === 'up' ? 'fill-current' : ''} />
                    <span className="mt-2 font-bold text-sm">Loved it</span>
                  </button>
                  <button
                    onClick={() => setSelectedRating('down')}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${
                      selectedRating === 'down'
                        ? 'border-red-500 bg-red-900/30 text-red-400 scale-105'
                        : 'border-gray-700 bg-gray-800 text-gray-500 hover:bg-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <ThumbsDown size={36} className={selectedRating === 'down' ? 'fill-current' : ''} />
                    <span className="mt-2 font-bold text-sm">Not for me</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowRatingPicker(false);
                    setSelectedRating(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToCalendar}
                  disabled={!selectedRating || isAddingToCalendar}
                  className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    !selectedRating || isAddingToCalendar
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {isAddingToCalendar ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Log Movie
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success State Modal Overlay */}
        {showSuccessState && details && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm p-6 rounded-2xl bg-gray-900 border border-gray-700 space-y-5 shadow-2xl text-center">
              <div className="flex flex-col items-center py-2">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <Check size={40} className="text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Movie Logged!</h2>
                <p className="text-gray-400 text-sm">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>

              <div className="flex gap-3 items-center bg-gray-800/50 p-3 rounded-xl">
                <img 
                  src={buildImageUrl(details.posterPath) || ''} 
                  className="w-14 h-20 object-cover rounded-lg shadow-lg" 
                  alt={details.title} 
                />
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-bold text-white truncate">{details.title}</h3>
                  <p className="text-sm text-gray-400">{details.year} • {details.runtime}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedRating === 'up' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {selectedRating === 'up' ? (
                    <ThumbsUp size={20} className="fill-current" />
                  ) : (
                    <ThumbsDown size={20} className="fill-current" />
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    // Reset and allow adding another movie
                    setShowSuccessState(false);
                    setSelectedRating(null);
                    setShowRatingPicker(false);
                    // Go back to discover to search another movie
                    navigate(`/discover?date=${selectedDate}`);
                  }}
                  className="w-full py-3 rounded-xl font-bold bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all"
                >
                  <Plus size={18} />
                  Add Another Movie
                </button>
                
                <button
                  onClick={() => {
                    navigate(`/app?date=${selectedDate}`);
                  }}
                  className="w-full py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Director & Cast */}
        {(details.director || details.cast.length > 0) && (
          <div className="space-y-3">
            {details.director && (
              <div>
                <span className="text-gray-500 text-sm">Directed by</span>
                <p className="text-white font-medium">{details.director}</p>
              </div>
            )}
            {details.cast.length > 0 && (
              <div>
                <span className="text-gray-500 text-sm">Starring</span>
                <p className="text-white">
                  {details.cast.map((c) => c.name).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Synopsis */}
        {details.overview && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
            <p className={`text-gray-300 leading-relaxed ${!showFullSynopsis && 'line-clamp-3'}`}>
              {details.overview}
            </p>
            {details.overview.length > 200 && (
              <button
                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                className="flex items-center gap-1 text-blue-400 text-sm mt-2 hover:underline"
              >
                {showFullSynopsis ? (
                  <>Show less <ChevronUp size={16} /></>
                ) : (
                  <>Show more <ChevronDown size={16} /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Pattern Detection — compact inline card */}
        {showPatternAssistant && (
          <div className="relative">
            <button
              onClick={dismissPattern}
              className="absolute top-2 right-2 z-10 p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Dismiss pattern"
            >
              <X size={14} />
            </button>
            <PatternAssistant
              compact
              insight={patternInsight}
              isAnalyzing={isAnalyzing}
              onShowMore={showMoreMovies}
              onSaveVibe={saveVibe}
              isLoadingMore={isLoadingMore}
              isSavingVibe={isSavingVibe}
              vibeSaved={vibeSaved}
              movieCount={clickedMovies.length}
              showMoreResults={showMoreResults}
              onMovieClick={(movie) => navigate(`/movie/${movie.id}?type=movie`)}
              triggerMovies={clickedMovies.map(m => ({ id: m.id, title: m.title, posterPath: m.posterPath }))}
            />
          </div>
        )}

        {/* Similar Vibes Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Similar Films</h3>
          {isLoadingSimilar && similarMovies.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : similarMovies.length > 0 ? (
            <div className="space-y-3">
              {similarMovies.map((movie) => (
                <SearchResultCard
                  key={movie.id}
                  movieId={movie.id}
                  title={movie.title}
                  year={movie.year}
                  posterPath={movie.posterPath}
                  backdropPath={movie.backdropPath}
                  genres={movie.genres || []}
                  onClick={() => handleSimilarMovieClick(movie)}
                />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={isLoadingSimilar}
                  className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isLoadingSimilar ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Finding similar vibes...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

