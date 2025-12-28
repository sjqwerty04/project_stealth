import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type ActivityAction =
  | 'movie_viewed'
  | 'movie_logged'
  | 'movie_rated'
  | 'movie_added_watchlist'
  | 'search_performed'
  | 'orbit_started'
  | 'orbit_swipe'
  | 'vibe_saved'
  | 'session_started'
  | 'error_occurred';

interface ActivityMetadata {
  // Movie related
  movieId?: number;
  movieTitle?: string;
  mediaType?: 'movie' | 'tv';
  
  // Rating
  rating?: 'up' | 'down';
  
  // Search
  searchQuery?: string;
  resultsCount?: number;
  
  // Orbit
  swipeDirection?: 'left' | 'right' | 'up' | 'down';
  fromMovieId?: number;
  toMovieId?: number;
  
  // Error
  errorMessage?: string;
  errorStack?: string;
  errorContext?: string;
  
  // Generic
  [key: string]: any;
}

// In-memory queue for batching (optional optimization)
let activityQueue: Array<{
  userId: string;
  userEmail: string;
  action: ActivityAction;
  metadata?: ActivityMetadata;
}> = [];

let flushTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Log a user activity to Firestore
 */
export const logActivity = async (
  userId: string,
  userEmail: string,
  action: ActivityAction,
  metadata?: ActivityMetadata
): Promise<void> => {
  // Skip logging in development if needed
  // if (import.meta.env.DEV) return;

  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      userEmail: userEmail.toLowerCase(),
      action,
      metadata: metadata || {},
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    console.error('Failed to log activity:', error);
  }
};

/**
 * Log activity with automatic user context (call from components with useAuth)
 */
export const createActivityLogger = (userId: string, userEmail: string) => {
  return {
    movieViewed: (movieId: number, movieTitle: string, mediaType: 'movie' | 'tv' = 'movie') =>
      logActivity(userId, userEmail, 'movie_viewed', { movieId, movieTitle, mediaType }),
    
    movieLogged: (movieId: number, movieTitle: string, date: string) =>
      logActivity(userId, userEmail, 'movie_logged', { movieId, movieTitle, logDate: date }),
    
    movieRated: (movieId: number, movieTitle: string, rating: 'up' | 'down') =>
      logActivity(userId, userEmail, 'movie_rated', { movieId, movieTitle, rating }),
    
    movieAddedToWatchlist: (movieId: number, movieTitle: string) =>
      logActivity(userId, userEmail, 'movie_added_watchlist', { movieId, movieTitle }),
    
    searchPerformed: (query: string, resultsCount: number) =>
      logActivity(userId, userEmail, 'search_performed', { searchQuery: query, resultsCount }),
    
    orbitStarted: (movieId: number, movieTitle: string) =>
      logActivity(userId, userEmail, 'orbit_started', { movieId, movieTitle }),
    
    orbitSwipe: (direction: string, fromMovieId: number, toMovieId: number, toMovieTitle: string) =>
      logActivity(userId, userEmail, 'orbit_swipe', { 
        swipeDirection: direction, 
        fromMovieId, 
        toMovieId,
        toMovieTitle 
      }),
    
    vibeSaved: (pattern: string, movieCount: number) =>
      logActivity(userId, userEmail, 'vibe_saved', { pattern, movieCount }),
    
    sessionStarted: () =>
      logActivity(userId, userEmail, 'session_started', {}),
    
    errorOccurred: (errorMessage: string, errorStack?: string, errorContext?: string) =>
      logActivity(userId, userEmail, 'error_occurred', { errorMessage, errorStack, errorContext }),
  };
};

/**
 * Global error handler for uncaught errors
 */
export const setupGlobalErrorLogging = (userId: string, userEmail: string) => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    logActivity(userId, userEmail, 'error_occurred', {
      errorMessage: event.message,
      errorStack: event.error?.stack,
      errorContext: `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logActivity(userId, userEmail, 'error_occurred', {
      errorMessage: event.reason?.message || String(event.reason),
      errorStack: event.reason?.stack,
      errorContext: 'unhandledrejection',
    });
  });
};
