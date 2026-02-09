import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePinchGesture } from '../hooks/usePinchGesture';
import { useOrbitStore, type SwipeDirection, type OrbitMovie, getOppositeDirection } from '../stores/orbitStore';
import { getNextMovie, prefetchNextMoves, extractDominantColor } from '../lib/orbitEngine';
import { orbitHaptics } from '../lib/haptics';
import OrbitCardStack from '../components/orbit/OrbitCardStack';
import OrbitControls from '../components/orbit/OrbitControls';
import ParryTransition from '../components/orbit/ParryTransition';
import ConstellationView from '../components/orbit/ConstellationView';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';
import { logActivity } from '../lib/activityLogger';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

export default function OrbitScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToWatchlist, isInWatchlist } = useWatchlist();
  
  const {
    currentMovie,
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
    setPrefetchedMoves,
    getBackDirection,
    isBackDirection,
  } = useOrbitStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [transitionColor, setTransitionColor] = useState('#1a1a2e');
  const [showWatchlistToast, setShowWatchlistToast] = useState(false);
  const watchlistToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
    enabled: !isTransitioning && !isLoading,
  });

  // Initialize orbit with movie data
  useEffect(() => {
    const initOrbit = async () => {
      if (!id) {
        navigate('/app');
        return;
      }

      const movieId = parseInt(id);
      
      try {
        // Fetch movie details from TMDB
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
        );
        
        if (!response.ok) throw new Error('Failed to fetch movie');
        
        const data = await response.json();
        
        // Extract director
        const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
        const cinematographer = data.credits?.crew?.find((c: any) => c.job === 'Director of Photography')?.name;
        
        // Get dominant color from poster
        const posterUrl = data.poster_path 
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : null;
        
        let dominantHex = '#1a1a2e';
        if (posterUrl) {
          dominantHex = await extractDominantColor(posterUrl);
        }
        
        const entryMovie: OrbitMovie = {
          id: data.id,
          title: data.title,
          year: data.release_date?.slice(0, 4) || '----',
          posterPath: data.poster_path,
          backdropPath: data.backdrop_path,
          dominantHex,
          mediaType: 'movie',
          director,
          cinematographer,
          genres: data.genres?.map((g: any) => g.name) || [],
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
        
        // Pre-fetch next moves in background (no back direction for entry movie)
        prefetchNextMoves(entryMovie, null).then((moves) => {
          setPrefetchedMoves({
            visual: moves.visual || null,
            balanced: moves.balanced || null,
            storytelling: moves.storytelling || null,
            emotional: moves.emotional || null,
          });
        });
        
      } catch (error) {
        console.error('Failed to initialize orbit:', error);
        navigate('/app');
      }
    };

    initOrbit();
    
    return () => {
      // Don't exit orbit on unmount - let user continue session
    };
  }, [id]);

  // Handle swipe action
  // UP = visual, RIGHT = balanced, DOWN = storytelling, LEFT = emotional
  // BUT: if swipe direction is opposite of how we arrived, go BACK instead
  const handleSwipe = useCallback(async (direction: SwipeDirection) => {
    if (!currentMovie || isTransitioning) return;
    
    // Check if this direction is the "back" direction
    if (isBackDirection(direction)) {
      const success = goBack();
      if (success) {
        orbitHaptics.historyNav();
        
        // After going back, prefetch for the previous movie
        // The back direction for the previous movie will be the opposite
      } else {
        orbitHaptics.edgeReached();
      }
      return;
    }
    
    // Haptic feedback for swipe
    orbitHaptics.swipeComplete();
    
    // Map direction to prefetch key
    // UP = visual, RIGHT = balanced, DOWN = storytelling, LEFT = emotional
    const directionToPrefetchKey: Record<SwipeDirection, 'visual' | 'balanced' | 'storytelling' | 'emotional'> = {
      up: 'visual',
      right: 'balanced',
      down: 'storytelling',
      left: 'emotional',
    };
    const prefetchKey = directionToPrefetchKey[direction];
    const prefetched = prefetchedMoves[prefetchKey];
    
    if (prefetched) {
      // INSTANT transition with prefetched data - no delay!
      setTransitionColor(prefetched.movie.dominantHex);
      setTransitioning(true);
      setPendingDirection(direction);
      
      // Minimal delay just for visual polish
      requestAnimationFrame(() => {
        navigateTo(prefetched.movie, direction, prefetched.connectionReason, prefetched.similarityScore);
        setTransitioning(false);
        setPendingDirection(null);
        
        // Log orbit swipe activity
        if (user?.uid && user?.email && currentMovie) {
          logActivity(user.uid, user.email, 'orbit_swipe', {
            swipeDirection: direction,
            fromMovieId: currentMovie.id,
            fromMovieTitle: currentMovie.title,
            toMovieId: prefetched.movie.id,
            toMovieTitle: prefetched.movie.title,
          });
        }
        
        // Pre-fetch next moves for new movie
        // The back direction is the OPPOSITE of how we arrived
        const backDir = getOppositeDirection(direction);
        prefetchNextMoves(prefetched.movie, backDir).then((moves) => {
          setPrefetchedMoves({
            visual: moves.visual || null,
            balanced: moves.balanced || null,
            storytelling: moves.storytelling || null,
            emotional: moves.emotional || null,
          });
        });
      });
    } else {
      // No prefetch available - show loading state and fetch
      setTransitioning(true);
      setPendingDirection(direction);
      
      const result = await getNextMovie(currentMovie, direction);
      
      if (result) {
        setTransitionColor(result.movie.dominantHex);
        
        requestAnimationFrame(() => {
          navigateTo(result.movie, direction, result.connectionReason, result.similarityScore);
          setTransitioning(false);
          setPendingDirection(null);
          
          // Log orbit swipe activity
          if (user?.uid && user?.email && currentMovie) {
            logActivity(user.uid, user.email, 'orbit_swipe', {
              swipeDirection: direction,
              fromMovieId: currentMovie.id,
              fromMovieTitle: currentMovie.title,
              toMovieId: result.movie.id,
              toMovieTitle: result.movie.title,
            });
          }
          
          // Pre-fetch next moves for new movie
          const backDir = getOppositeDirection(direction);
          prefetchNextMoves(result.movie, backDir).then((moves) => {
            setPrefetchedMoves({
              visual: moves.visual || null,
              balanced: moves.balanced || null,
              storytelling: moves.storytelling || null,
              emotional: moves.emotional || null,
            });
          });
        });
      } else {
        setTransitioning(false);
        setPendingDirection(null);
      }
    }
  }, [currentMovie, isTransitioning, prefetchedMoves, isBackDirection, goBack, setTransitioning, setPendingDirection, navigateTo, setPrefetchedMoves, user]);

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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 text-white/70 animate-spin" />
          <p className="text-white/50 text-sm">Entering orbit...</p>
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
        onComplete={() => {
          // Transition complete callback if needed
        }}
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
              isTransitioning={isTransitioning}
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

      {/* Loading indicator during swipe - only show if actually waiting */}
      <AnimatePresence>
        {isTransitioning && pendingDirection && !isBackDirection(pendingDirection) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-md">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
              <span className="text-white/70 text-sm">Finding next film...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe direction indicators - show what each direction does */}
      {!isTransitioning && !showConstellation && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* UP = Visual (if not back direction) */}
          {prefetchedMoves.visual && getBackDirection() !== 'up' && (
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
          {prefetchedMoves.storytelling && getBackDirection() !== 'down' && (
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
          {prefetchedMoves.emotional && getBackDirection() !== 'left' && (
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
          {prefetchedMoves.balanced && getBackDirection() !== 'right' && (
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

// Deploy trigger Mon Dec  8 21:17:43 CST 2025
