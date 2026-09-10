export type Axis = 'story' | 'visual' | 'mood';

export type FilmRef = {
  movieId?: number;
  title: string;
  year?: string | number;
};

export type HistoryItem = {
  item: string;
  rating: number;
  id?: string;
};

export type RecommendConstraints = {
  exclude_genres?: string[];
  max_length_minutes?: number;
};

export type RecommendContext = {
  preferences: string[];
  profile: string;
  constraints: RecommendConstraints;
  history: HistoryItem[];
};

export type TasteIdentity = {
  personaLine: string | null;
  axis: Axis | null;
};

export type TastePick = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
  mediaType?: 'movie' | 'tv';
  whyMatch: string;
  confidence: number;
};

export type TasteSnapshot = {
  identity: TasteIdentity;
  pointers: {
    lastEventId: string | null;
    calendarLogIds: string[];
    watchlistIds: string[];
  };
  context: RecommendContext;
  generated: {
    updatedAt: number | null;
    fromEventId: string | null;
    compactForChat: string;
    patterns: string[];
    insightCards: string[];
    lastPicks: TastePick[];
    lastPicksAt: number | null;
  };
};

export type DiaryEvidence = {
  identity: TasteIdentity;
  favorites: FilmRef[];
  disliked: FilmRef[];
  rated: Array<FilmRef & { rating: 'up' | 'down' | number; at?: number }>;
  watchlist: FilmRef[];
  skipped: FilmRef[];
  searches: string[];
  patterns: string[];
};

export type TasteEvent =
  | {
      type: 'onboarding';
      favoriteFilms: FilmRef[];
      dislikedFilms: FilmRef[];
      axis: Axis | null;
      personaLine?: string | null;
    }
  | {
      type: 'rate';
      movieId: number;
      title: string;
      year?: string | number;
      rating: 'up' | 'down';
      source: 'calendar' | 'rec' | 'detail';
    }
  | { type: 'skip'; movieId: number; title: string; year?: string | number }
  | { type: 'watchlist_add'; movieId: number; title: string; year?: string | number }
  | { type: 'watchlist_remove'; movieId: number; title: string }
  | {
      type: 'calendar_log';
      movieId: number;
      title: string;
      year?: string | number;
      date: string;
      rating?: 'up' | 'down' | null;
    }
  | { type: 'search'; query: string; openedMovieId?: number; openedTitle?: string }
  | { type: 'movie_viewed'; movieId: number; title: string }
  | { type: 'chat_turn'; movieId: number; title: string }
  | {
      type: 'orbit_swipe';
      direction: 'left' | 'right' | 'up' | 'down';
      fromMovieId: number;
      toMovieId: number;
      toTitle: string;
    }
  | { type: 'import'; source: 'letterboxd' | 'imdb'; count: number }
  | { type: 'pattern'; insight: string; movieIds: number[] }
  | { type: 'identity'; personaLine: string; insightCards?: string[] }
  | { type: 'last_picks'; picks: TastePick[] };

export const LAST_PICKS_FRESH_MS = 6 * 60 * 60 * 1000;
export const SNAPSHOT_FRESH_MS = 24 * 60 * 60 * 1000;
export const GENERATE_DEBOUNCE_MS = 2500;
export const HISTORY_LIMIT = 50;
export const PREFERENCE_LIMIT = 40;

export const AXIS_PREFERENCE: Record<Axis, string> = {
  story: 'story-driven films',
  visual: 'visually driven films',
  mood: 'mood-first viewing',
};
