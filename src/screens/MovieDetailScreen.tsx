import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Orbit, X, ThumbsUp, ThumbsDown, Check, Plus, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useMovieDetails } from '../hooks/useMovieDetails';
import { useSimilarVibes } from '../hooks/useSimilarVibes';
import { useWatchlist } from '../hooks/useWatchlist';
import { useCalendarLogs } from '../hooks/useCalendarLogs';
import { useExploration } from '../contexts/ExplorationContext';
import MovieActions from '../components/MovieActions';
import PatternAssistant from '../components/PatternAssistant';
import RatingBadges from '../components/RatingBadges';
import TechBadges from '../components/TechBadges';
import StarterPrompts from '../components/StarterPrompts';
import MovieChatSheet from '../components/MovieChatSheet';
import { useMovieInsights } from '../hooks/useMovieInsights';
import { useMovieKnownFor } from '../hooks/useMovieKnownFor';
import { useLetterboxdRating } from '../hooks/useLetterboxdRating';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../lib/activityLogger';
import Skeleton from '../components/ui/Skeleton';

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
  const { details, isLoading, error, fetchDetails } = useMovieDetails();
  const { similarMovies, isLoading: isLoadingSimilar, loadMore, hasMore } = useSimilarVibes();
  const { isInWatchlist, removeFromWatchlist, getWatchlistItem } = useWatchlist();
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
  const [isMarkingSeen, setIsMarkingSeen] = useState(false);
  const [isMarkedSeen, setIsMarkedSeen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(preSelectedDate || new Date().toISOString().split('T')[0]);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'up' | 'down' | null>(null);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reddit-grounded starter questions + known-for + letterboxd.
  const { insights } = useMovieInsights(details?.title, details?.year, details?.genres);
  const { knownFor } = useMovieKnownFor(details?.title, details?.year);
  const { rating: lbRating, filmUrl: lbUrl } = useLetterboxdRating(details?.id, details?.title, details?.year);
  const [chatOpen, setChatOpen] = useState(false);
  const [seedQuestion, setSeedQuestion] = useState<string | null>(null);
  const [showChips, setShowChips] = useState(true);
  const lastScrollY = useRef(0);

  // Floating chips hide on scroll-down, reveal on scroll-up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setShowChips(true);
      else if (y > lastScrollY.current + 6) setShowChips(false);
      else if (y < lastScrollY.current - 6) setShowChips(true);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAsk = useCallback((question: string) => {
    setSeedQuestion(question);
    setChatOpen(true);
  }, []);

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
      <div className="min-h-screen bg-base flex items-center justify-center">
        <Skeleton className="w-32 h-48" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center text-fg p-4">
        <p className="text-fg-2 mb-4">{error || 'Movie not found'}</p>
        <button type="button" onClick={handleBack} className="min-h-11 text-fg underline">
          Go back
        </button>
      </div>
    );
  }

  const backdropUrl = buildImageUrl(details.backdropPath, 'original');

  return (
    <div className="min-h-screen bg-base text-fg">

      {/* ── HERO ── full-bleed video/backdrop, ~60vh with centered logo */}
      <div className="relative h-[60vh] min-h-[340px] overflow-hidden">
        {details.heroVideo ? (
          <div className="hero-video-wrap absolute inset-0" style={{ background: '#000' }}>
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${details.heroVideo.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${details.heroVideo.key}&playsinline=1&rel=0&modestbranding=1&showinfo=0&enablejsapi=1`}
              allow="autoplay; encrypted-media; fullscreen"
              title="Clip"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                /* Cover the 60vh portrait container: width = 60vh × 16/9.
                   Using explicit vh units avoids the aspect-ratio + height:100% browser quirk.
                   minWidth:100% handles landscape / wide viewports. */
                height: '60vh',
                width: 'calc(60vh * 16 / 9)',
                minWidth: '100%',
                transform: 'translate(-50%, -50%)',
                border: 'none',
                pointerEvents: 'none',
              }}
            />
            {/* Tap overlay — intercepts all taps so YouTube UI never fires.
                On tap: go fullscreen + unmute so audio plays. */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => {
                const wrap = document.querySelector('.hero-video-wrap') as HTMLElement;
                wrap?.requestFullscreen?.().catch(() => {});
                setTimeout(() => {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                    '*'
                  );
                  setIsMuted(false);
                }, 200);
              }}
            />
          </div>
        ) : backdropUrl ? (
          <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/20 to-transparent pointer-events-none" />

        {/* Back */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 p-2.5 min-h-11 min-w-11 bg-black/50 text-fg flex items-center gap-1.5"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
          {fromOrbit && <span className="text-sm font-medium pr-1">Orbit</span>}
        </button>

        {/* DNA */}
        {mediaType === 'movie' && (
          <button
            onClick={() => navigate(`/dna/${details.id}`)}
            className="absolute top-4 right-4 z-10 px-3.5 py-2 min-h-11 bg-black/50 text-fg"
            aria-label="Explore DNA"
          >
            <span className="text-base font-extrabold tracking-[-0.12em]">DNA</span>
          </button>
        )}

        {/* Mute toggle — sits above the tap overlay */}
        {details.heroVideo && (
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 z-20 p-2.5 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}

        {/* Movie logo — centered horizontally, pinned to lower third */}
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 px-8 z-10">
          {details.logoPath ? (
            <img
              src={`https://image.tmdb.org/t/p/w500${details.logoPath}`}
              alt={details.title}
              className="max-h-20 w-auto max-w-[70%] object-contain drop-shadow-2xl"
            />
          ) : (
            <h1 className="text-3xl font-bold text-center drop-shadow-2xl leading-tight">
              {details.title}
            </h1>
          )}
        </div>
      </div>

      {/* ── TITLE META (below hero) ── */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-gray-400 text-sm text-center">
          {details.year}
          {details.runtime && <> &bull; {details.runtime}</>}
          {details.director && <> &bull; {details.director}</>}
          {details.techSpecs?.certification && (
            <> &bull; <span className="text-white/70">{details.techSpecs.certification}</span></>
          )}
        </p>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 space-y-4 pb-8">

        {/* Ratings (centered) */}
        {details.ratings && (
          <RatingBadges
            ratings={details.ratings}
            letterboxdRating={lbRating}
            letterboxdUrl={lbUrl}
          />
        )}
        {details.techSpecs && <TechBadges techSpecs={details.techSpecs} />}

        {/* Action Buttons */}
        <MovieActions
          movie={{
            movieId: details.id,
            title: details.title,
            year: details.year,
            poster: buildImageUrl(details.posterPath) || '',
            backdrop: buildImageUrl(details.backdropPath, 'w780') || undefined,
            runtime: details.runtime,
          }}
          onAddToCalendar={handleAddToCalendar}
          onMarkAsSeen={handleMarkAsSeen}
          isInWatchlist={isInWatchlist(details.id)}
          isMarkedSeen={isMarkedSeen}
          isAddingToCalendar={isAddingToCalendar}
          isMarkingSeen={isMarkingSeen}
        />

        {/* Orbit + Ask — side by side */}
        {mediaType === 'movie' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="orbit-cta"
              onClick={() => navigate(`/orbit/${details.id}`)}
              className="flex items-center justify-center gap-2 min-h-11 py-3 bg-fg text-base font-semibold text-sm"
            >
              <Orbit className="w-4 h-4" />
              <span>Enter Orbit</span>
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex items-center justify-center gap-2 min-h-11 py-3 bg-base-3 border border-line text-fg font-semibold text-sm"
            >
              <Sparkles className="w-4 h-4 text-fg-2" />
              <span>Ask AI</span>
            </button>
          </div>
        )}
        {mediaType !== 'movie' && (
          <button
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#18181b] hover:bg-[#27272a] border border-white/10 text-gray-100 font-semibold text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Ask AI about {details.title}</span>
          </button>
        )}

        {/* Known-for hook — below action buttons, above synopsis */}
        {knownFor && (
          <div className="bg-[#18181b] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <p className="text-gray-200 text-sm italic leading-relaxed">{knownFor}</p>
          </div>
        )}

        {/* Synopsis */}
        {details.overview && (
          <div className="bg-[#18181b] rounded-2xl p-4 border border-white/5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Synopsis</h3>
            <p className={`text-gray-200 text-sm leading-relaxed ${!showFullSynopsis ? 'line-clamp-4' : ''}`}>
              {details.overview}
            </p>
            {details.overview.length > 220 && (
              <button
                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                className="flex items-center gap-1 text-purple-400 text-xs mt-2.5 font-medium"
              >
                {showFullSynopsis ? <>Less <ChevronUp size={14} /></> : <>More <ChevronDown size={14} /></>}
              </button>
            )}
          </div>
        )}

        {/* Cast — horizontal scroll with profile photos */}
        {details.cast.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cast</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {details.cast.map((c) => (
                <div key={c.id} className="flex-shrink-0 w-16 text-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#27272a] border border-white/10 mb-1.5">
                    {c.profilePath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${c.profilePath}`}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl font-bold">
                        {c.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-300 leading-tight line-clamp-2">{c.name}</p>
                  {c.character && (
                    <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{c.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pattern Detection */}
        {showPatternAssistant && (
          <div className="relative">
            <button
              onClick={dismissPattern}
              className="absolute top-2 right-2 z-10 p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Dismiss"
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

        {/* Similar Films — 2-column poster grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Similar Films</h3>
          {isLoadingSimilar && similarMovies.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            </div>
          ) : similarMovies.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5">
              {similarMovies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => handleSimilarMovieClick(movie)}
                  className="text-left group"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#18181b] group-hover:ring-2 ring-purple-500/60 transition-all">
                    {movie.posterPath ? (
                      <img
                        src={buildImageUrl(movie.posterPath, 'w200')!}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <span className="text-[10px] text-gray-500 text-center leading-tight">{movie.title}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1 line-clamp-1 leading-tight">{movie.title}</p>
                  {movie.year && <p className="text-[10px] text-gray-600">{movie.year}</p>}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8 text-sm">Finding similar vibes…</p>
          )}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingSimilar}
              className="w-full mt-3 py-3 rounded-2xl bg-[#18181b] text-gray-400 hover:text-white hover:bg-[#27272a] border border-white/5 text-sm transition-colors disabled:opacity-50"
            >
              {isLoadingSimilar ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>

        {/* Spacer so floating chips don't cover last content */}
        <div className="h-24" />
      </div>

      {/* ── MODALS (unchanged logic) ── */}

      {/* Date Picker */}
      {showDatePicker && !showRatingPicker && !showSuccessState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-[#18181b] border border-white/10 space-y-4 mb-4">
            <h3 className="font-bold text-white">Pick a date</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#09090b] border border-white/10 text-white"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCalendar}
                disabled={isAddingToCalendar}
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-50"
              >
                {isAddingToCalendar ? 'Adding…' : isPastDate(selectedDate) ? 'Next: Rate' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Picker */}
      {showRatingPicker && !showSuccessState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#18181b] border border-white/10 space-y-5 shadow-2xl">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-1">Log Movie</h3>
              <p className="text-sm text-gray-400">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-3 items-center bg-[#09090b] p-3 rounded-xl">
              <img src={buildImageUrl(details.posterPath) || ''} className="w-12 rounded-lg" style={{ aspectRatio: '2/3', objectFit: 'cover' }} alt={details.title} />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white truncate">{details.title}</h4>
                <p className="text-sm text-gray-400">{details.year}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 mb-3 text-center">How was it?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedRating('up')}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${selectedRating === 'up' ? 'border-green-500 bg-green-900/30 text-green-400 scale-105' : 'border-white/10 bg-[#09090b] text-gray-500 hover:border-white/20'}`}
                >
                  <ThumbsUp size={34} className={selectedRating === 'up' ? 'fill-current' : ''} />
                  <span className="mt-2 font-bold text-sm">Loved it</span>
                </button>
                <button
                  onClick={() => setSelectedRating('down')}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${selectedRating === 'down' ? 'border-red-500 bg-red-900/30 text-red-400 scale-105' : 'border-white/10 bg-[#09090b] text-gray-500 hover:border-white/20'}`}
                >
                  <ThumbsDown size={34} className={selectedRating === 'down' ? 'fill-current' : ''} />
                  <span className="mt-2 font-bold text-sm">Not for me</span>
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRatingPicker(false); setSelectedRating(null); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCalendar}
                disabled={!selectedRating || isAddingToCalendar}
                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${!selectedRating || isAddingToCalendar ? 'bg-[#27272a] text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
              >
                {isAddingToCalendar ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Log Movie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {showSuccessState && details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#18181b] border border-white/10 space-y-5 shadow-2xl text-center">
            <div className="flex flex-col items-center py-2">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check size={40} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Movie Logged!</h2>
              <p className="text-gray-400 text-sm">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-3 items-center bg-[#09090b] p-3 rounded-xl">
              <img src={buildImageUrl(details.posterPath) || ''} className="w-14 rounded-lg shadow-lg" style={{ aspectRatio: '2/3', objectFit: 'cover' }} alt={details.title} />
              <div className="flex-1 text-left min-w-0">
                <h3 className="font-bold text-white truncate">{details.title}</h3>
                <p className="text-sm text-gray-400">{details.year} &bull; {details.runtime}</p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedRating === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {selectedRating === 'up' ? <ThumbsUp size={20} className="fill-current" /> : <ThumbsDown size={20} className="fill-current" />}
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => { setShowSuccessState(false); setSelectedRating(null); setShowRatingPicker(false); navigate(`/discover?date=${selectedDate}`); }}
                className="w-full py-3 rounded-xl font-bold bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={18} />
                Add Another Movie
              </button>
              <button
                onClick={() => navigate(`/app?date=${selectedDate}`)}
                className="w-full py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-[#27272a] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating starter-question chips */}
      <StarterPrompts questions={insights.suggestedQuestions} onAsk={handleAsk} visible={showChips} />

      {/* Movie-scoped chat sheet */}
      <MovieChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        movie={{
          title: details.title,
          year: details.year,
          genres: details.genres,
          director: details.director,
          overview: details.overview,
        }}
        snippets={insights.snippets}
        taste={undefined}
        seedQuestion={seedQuestion}
        onSeedConsumed={() => setSeedQuestion(null)}
      />
    </div>
  );
}

