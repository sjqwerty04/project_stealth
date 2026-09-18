import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import { usePinchGesture } from '../hooks/usePinchGesture';
import { useOrbitStore, type SwipeDirection, type OrbitMovie } from '../stores/orbitStore';
import { getNextMovie, getNextMovieBatch, extractDominantColor } from '../lib/orbitEngine';
import {
  createOrbitRequestCoordinator,
  warmOrbitImages,
  type OrbitRecommendation,
} from '../lib/orbitRequests';
import { recordOrbitTiming, type OrbitTiming } from '../lib/orbitTelemetry';
import { orbitHaptics } from '../lib/haptics';
import OrbitCardStack from '../components/orbit/OrbitCardStack';
import OrbitControls from '../components/orbit/OrbitControls';
import ParryTransition from '../components/orbit/ParryTransition';
import ConstellationView from '../components/orbit/ConstellationView';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';
import { logActivity } from '../lib/activityLogger';
import { recordTasteEvent, useTaste } from '../lib/taste';
import { fallbackById } from '../lib/fallbackCatalog';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const orbitRequests = createOrbitRequestCoordinator(getNextMovie, undefined, getNextMovieBatch);

export default function OrbitScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { snapshot, loading: tasteLoading } = useTaste();
  const { addToWatchlist } = useWatchlist();
  
  const {
    currentMovie,
    historyIndex,
    showConstellation,
    isTransitioning,
    pendingDirection,
    prefetchedMoves,
    enterOrbit,
    exitOrbit,
    navigateTo,
    goBack,
    toggleSaved,
    setTransitioning,
    setShowConstellation,
    setPendingDirection,
    setPrefetchSource,
    publishPrefetchedMove,
    getBackDirection,
    isBackDirection,
  } = useOrbitStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isWaitingForRecommendation, setIsWaitingForRecommendation] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [transitionColor, setTransitionColor] = useState('#1a1a2e');
  const [showWatchlistToast, setShowWatchlistToast] = useState(false);
  const watchlistToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSwipeAttempt = useRef(0);
  const swipeTiming = useRef<{
    releasedAt: number;
    sourceMovieId: number;
    sourceHistoryIndex: number;
    direction: SwipeDirection;
    cacheState: NonNullable<OrbitTiming['cacheState']>;
  } | null>(null);
  
  // Pinch gesture for constellation toggle
  const containerRef = useRef<HTMLDivElement>(null);
  usePinchGesture(containerRef, {
    onPinchIn: () => {
      if (!showConstellation) {
        setShowConstellation(true);
        orbitHaptics.swipeComplete();
      }
    },
    onPinchOut: () => {
      if (showConstellation) {
        setShowConstellation(false);
        orbitHaptics.swipeComplete();
      }
    },
    threshold: 0.25,
    enabled: !isTransitioning && !isLoading && !isWaitingForRecommendation,
  });

  // Initialize orbit with movie data
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const initOrbit = async () => {
      if (!id) {
        navigate('/app');
        return;
      }

      const movieId = parseInt(id);
      
      try {
        // Fetch movie details from TMDB
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error('Failed to fetch movie');

        const data = await response.json();
        if (cancelled) return;
        
        // Extract director
        const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
        const cinematographer = data.credits?.crew?.find((c: any) => c.job === 'Director of Photography')?.name;
        
        const posterUrl = data.poster_path 
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : null;

        const movieWithoutColor: OrbitMovie = {
          id: data.id,
          title: data.title,
          year: data.release_date?.slice(0, 4) || '----',
          posterPath: data.poster_path,
          backdropPath: data.backdrop_path,
          dominantHex: '#1a1a2e',
          mediaType: 'movie',
          director,
          cinematographer,
          genres: data.genres?.map((g: any) => g.name) || [],
        };
        warmOrbitImages(movieWithoutColor);
        if (!tasteLoading) {
          orbitRequests.prefetch(
            movieWithoutColor,
            null,
            snapshot.generated.compactForChat,
            () => {}
          );
        }

        let dominantHex = '#1a1a2e';
        if (posterUrl) {
          dominantHex = await extractDominantColor(posterUrl);
        }
        if (cancelled) return;

        const entryMovie: OrbitMovie = {
          ...movieWithoutColor,
          dominantHex,
        };
        
        enterOrbit(entryMovie);
        setTransitionColor(dominantHex);
        
        // Log orbit started activity
        if (user?.uid && user?.email) {
          logActivity(user.uid, user.email, 'orbit_started', {
            movieId: entryMovie.id,
            movieTitle: entryMovie.title,
          });
        }
        
        // Check if first time user
        const hasSeenOnboarding = localStorage.getItem('orbit_onboarding_seen');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
          localStorage.setItem('orbit_onboarding_seen', 'true');
        }
        
        setIsLoading(false);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error('Failed to initialize orbit:', error);
        const film = fallbackById(movieId);
        const entryMovie: OrbitMovie = {
          id: film.id,
          title: film.title,
          year: film.year,
          posterPath: film.posterPath,
          backdropPath: film.backdropPath ?? null,
          dominantHex: '#1D5B8A',
          mediaType: 'movie',
          director: undefined,
          cinematographer: undefined,
          genres: [],
        };
        enterOrbit(entryMovie);
        setTransitionColor('#1D5B8A');
        setIsLoading(false);
      }
    };

    initOrbit();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!currentMovie || tasteLoading) return;
    const taste = snapshot.generated.compactForChat;
    const sourceKey = orbitRequests.sourceKey(currentMovie, taste);
    setPrefetchSource(sourceKey);
    orbitRequests.prefetch(
      currentMovie,
      getBackDirection(),
      taste,
      publishPrefetchedMove
    );
  }, [
    currentMovie,
    getBackDirection,
    publishPrefetchedMove,
    setPrefetchSource,
    snapshot.generated.compactForChat,
    tasteLoading,
  ]);

  useEffect(() => {
    const timing = swipeTiming.current;
    if (!currentMovie || !timing || historyIndex === timing.sourceHistoryIndex) return;
    let paintedFrame = 0;
    const committedFrame = requestAnimationFrame(() => {
      paintedFrame = requestAnimationFrame(() => {
        recordOrbitTiming({
          phase: 'gesture-to-card',
          durationMs: performance.now() - timing.releasedAt,
          sourceMovieId: timing.sourceMovieId,
          direction: timing.direction,
          cacheState: timing.cacheState,
        });
        swipeTiming.current = null;
      });
    });
    return () => {
      cancelAnimationFrame(committedFrame);
      cancelAnimationFrame(paintedFrame);
    };
  }, [currentMovie, historyIndex]);

  useEffect(() => {
    activeSwipeAttempt.current += 1;
  }, [currentMovie?.id, historyIndex, snapshot.generated.compactForChat]);

  // Handle swipe action
  // UP = visual, RIGHT = balanced, DOWN = storytelling, LEFT = emotional
  // BUT: if swipe direction is opposite of how we arrived, go BACK instead
  const handleSwipe = useCallback(async (direction: SwipeDirection, releasedAt: number) => {
    if (!currentMovie || isTransitioning || isWaitingForRecommendation) return;
    
    // Check if this direction is the "back" direction
    if (isBackDirection(direction)) {
      const success = goBack();
      if (success) {
        orbitHaptics.historyNav();
      } else {
        orbitHaptics.edgeReached();
      }
      return;
    }
    
    orbitHaptics.swipeComplete();

    const taste = snapshot.generated.compactForChat;
    const sourceKey = orbitRequests.sourceKey(currentMovie, taste);
    const attempt = ++activeSwipeAttempt.current;
    let result: OrbitRecommendation | null =
      prefetchedMoves.sourceKey === sourceKey
        ? prefetchedMoves.moves[direction]
        : null;
    result ??= orbitRequests.peek(currentMovie, direction, taste);
    const requestState = orbitRequests.status(currentMovie, direction, taste).state;
    swipeTiming.current = {
      releasedAt,
      sourceMovieId: currentMovie.id,
      sourceHistoryIndex: historyIndex,
      direction,
      cacheState: result ? 'ready' : requestState === 'loading' ? 'loading' : 'miss',
    };

    if (!result) {
      setPendingDirection(direction);
      setIsWaitingForRecommendation(true);
      result = await orbitRequests.request(currentMovie, direction, taste);
      setIsWaitingForRecommendation(false);
      if (
        activeSwipeAttempt.current !== attempt ||
        useOrbitStore.getState().prefetchedMoves.sourceKey !== sourceKey
      ) {
        swipeTiming.current = null;
        setPendingDirection(null);
        return;
      }
    }

    if (!result) {
      swipeTiming.current = null;
      setPendingDirection(null);
      return;
    }

    const recommendation = result;
    setTransitionColor(recommendation.movie.dominantHex);
    setTransitioning(true);
    setPendingDirection(direction);

    requestAnimationFrame(() => {
      if (
        activeSwipeAttempt.current !== attempt ||
        useOrbitStore.getState().prefetchedMoves.sourceKey !== sourceKey
      ) {
        swipeTiming.current = null;
        setTransitioning(false);
        setPendingDirection(null);
        return;
      }
      navigateTo(
        recommendation.movie,
        direction,
        recommendation.connectionReason,
        recommendation.similarityScore
      );
      setTransitioning(false);
      setPendingDirection(null);

      if (user?.uid) {
        void recordTasteEvent(
          user.uid,
          {
            type: 'orbit_swipe',
            direction,
            fromMovieId: currentMovie.id,
            toMovieId: recommendation.movie.id,
            toTitle: recommendation.movie.title,
          },
          { email: user.email }
        );
      }
    });
  }, [
    currentMovie,
    goBack,
    historyIndex,
    isBackDirection,
    isTransitioning,
    isWaitingForRecommendation,
    navigateTo,
    prefetchedMoves,
    setPendingDirection,
    setTransitioning,
    snapshot.generated.compactForChat,
    user,
  ]);

  // Handle long press (save movie to watchlist)
  const handleLongPress = useCallback(async () => {
    if (currentMovie) {
      // Toggle saved state in orbit store
      toggleSaved(currentMovie.id);
      orbitHaptics.save();
      orbitHaptics.saved();
      
      // Add to Firebase watchlist
      const success = await addToWatchlist({
        movieId: currentMovie.id,
        title: currentMovie.title,
        year: currentMovie.year,
        poster: currentMovie.posterPath || '',
        backdrop: currentMovie.backdropPath || '',
      });
      
      if (success) {
        // Show toast confirmation
        setShowWatchlistToast(true);
        if (watchlistToastTimer.current) {
          clearTimeout(watchlistToastTimer.current);
        }
        watchlistToastTimer.current = setTimeout(() => {
          setShowWatchlistToast(false);
        }, 2000);
      }
    }
  }, [currentMovie, toggleSaved, addToWatchlist]);

  // Handle info press (navigate to movie details)
  const handleInfoPress = useCallback(() => {
    if (currentMovie) {
      navigate(`/movie/${currentMovie.id}?from=orbit&type=movie`);
    }
  }, [currentMovie, navigate]);

  // Handle exit
  const handleExit = useCallback(() => {
    exitOrbit();
    navigate(-1);
  }, [exitOrbit, navigate]);

  // Handle constellation toggle
  const handleToggleConstellation = useCallback(() => {
    setShowConstellation(!showConstellation);
  }, [showConstellation, setShowConstellation]);

  // Dismiss onboarding
  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: transitionColor }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <SelectsChaseLoader size="xl" label="Entering orbit" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: currentMovie?.dominantHex || transitionColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={showOnboarding ? handleDismissOnboarding : undefined}
    >
      {/* Parry transition effect */}
      <ParryTransition
        isActive={isTransitioning}
        targetColor={transitionColor}
        direction={pendingDirection}
      />

      {/* Main content */}
      <AnimatePresence mode="wait">
        {showConstellation ? (
          <motion.div
            key="constellation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <ConstellationView />
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <OrbitCardStack
              onSwipe={handleSwipe}
              onLongPress={handleLongPress}
              onInfoPress={handleInfoPress}
              isTransitioning={isTransitioning || isWaitingForRecommendation}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <OrbitControls
        onExit={handleExit}
        onToggleConstellation={handleToggleConstellation}
        showOnboarding={showOnboarding}
      />

      {/* Center atmospheric loader during swipe wait */}
      <AnimatePresence>
        {isWaitingForRecommendation && pendingDirection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none px-6"
          >
            <div className="px-7 py-5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 flex flex-col items-center gap-3 shadow-2xl">
              <SelectsChaseLoader size="lg" />
              <p className="font-spec text-xs uppercase tracking-widest text-white/80">
                Finding {pendingDirection === 'up' ? 'visual' : pendingDirection === 'right' ? 'balanced' : pendingDirection === 'down' ? 'story' : 'emotional'} match...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator during swipe - only show if actually waiting */}
      <AnimatePresence>
        {isWaitingForRecommendation && pendingDirection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              <SelectsChaseLoader size="xs" />
              <span className="text-white/80 text-xs font-spec tracking-wider uppercase">Finding next film...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe direction indicators - show what each direction does */}
      {!isTransitioning && !showConstellation && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* UP = Visual (if not back direction) */}
          {prefetchedMoves.moves.up && getBackDirection() !== 'up' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute top-20 left-1/2 -translate-x-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider">↑ Visual</div>
            </motion.div>
          )}
          {/* Show BACK indicator if up is back */}
          {getBackDirection() === 'up' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute top-20 left-1/2 -translate-x-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider">↑ Back</div>
            </motion.div>
          )}
          
          {/* DOWN = Storytelling (if not back direction) */}
          {prefetchedMoves.moves.down && getBackDirection() !== 'down' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider">↓ Story</div>
            </motion.div>
          )}
          {getBackDirection() === 'down' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider">↓ Back</div>
            </motion.div>
          )}
          
          {/* LEFT = Emotional (if not back direction) */}
          {prefetchedMoves.moves.left && getBackDirection() !== 'left' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute left-4 top-1/2 -translate-y-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider rotate-[-90deg]">← Feel</div>
            </motion.div>
          )}
          {getBackDirection() === 'left' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute left-4 top-1/2 -translate-y-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider rotate-[-90deg]">← Back</div>
            </motion.div>
          )}
          
          {/* RIGHT = Balanced (if not back direction) */}
          {prefetchedMoves.moves.right && getBackDirection() !== 'right' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider rotate-90">→ Match</div>
            </motion.div>
          )}
          {getBackDirection() === 'right' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <div className="text-white/40 text-xs uppercase tracking-wider rotate-90">→ Back</div>
            </motion.div>
          )}
        </div>
      )}

      {/* Watchlist Toast */}
      <AnimatePresence>
        {showWatchlistToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-green-500 shadow-lg">
              <span className="text-white font-medium">Added to Watchlist</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
