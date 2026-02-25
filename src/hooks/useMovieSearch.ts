import { useState, useCallback, useRef } from 'react';
import { callClaude } from '../lib/claude';
import { useAuth } from './useAuth';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export type SearchResult = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  overview: string;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  mediaType: 'movie' | 'tv';
};

export type VibeList = {
  title: string;
  description: string;
  movies: SearchResult[];
};

export type SearchMode = 'standard' | 'ai-curated';
export type SearchMetadata = {
  mode: SearchMode;
  label?: string;
};

// Query intent classifier — simple: short queries go to TMDB, everything else to AI
const classifyQuery = (query: string): { mode: SearchMode } => {
  const lower = query.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;
  
  // AI patterns - complex queries that need interpretation
  const aiIndicators = [
    /directed by/i,
    /movies? (?:with|starring|by|featuring)/i,
    /films? (?:with|starring|by|featuring)/i,
    /like\s+/i,
    /(?:above|over|higher than)\s+\d/i,
    /(?:similar|comparable) to/i,
    /best\s+/i,
  ];
  
  for (const pattern of aiIndicators) {
    if (pattern.test(query)) return { mode: 'ai-curated' };
  }
  
  // Multi-word queries with genre/film keywords -> AI
  if (wordCount >= 3) return { mode: 'ai-curated' };
  
  // 2-word queries: check if it could be a person name + "films/movies"
  if (wordCount === 2) {
    if (/\b(films?|movies?)\b/i.test(query)) return { mode: 'ai-curated' };
  }
  
  return { mode: 'standard' };
};

// Fetch user preference context for personalized vibes
const fetchUserContext = async (userId: string): Promise<string[]> => {
  try {
    const contextMovies: string[] = [];
    
    // Get recent watchlist items (last 10)
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const watchlistQuery = query(watchlistRef, orderBy('addedAt', 'desc'), limit(10));
    const watchlistSnap = await getDocs(watchlistQuery);
    watchlistSnap.forEach(doc => {
      const data = doc.data();
      if (data.title) contextMovies.push(data.title);
    });
    
    // Get recent calendar logs (last 10)
    const calendarRef = collection(db, 'users', userId, 'calendar');
    const calendarQuery = query(calendarRef, orderBy('date', 'desc'), limit(10));
    const calendarSnap = await getDocs(calendarQuery);
    calendarSnap.forEach(doc => {
      const data = doc.data();
      if (data.title) contextMovies.push(data.title);
    });
    
    return contextMovies.slice(0, 15); // Max 15 for context
  } catch (err) {
    console.error('Failed to fetch user context:', err);
    return [];
  }
};

export function useMovieSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata>({ mode: 'standard' });
  const [vibeList, setVibeList] = useState<VibeList | null>(null);
  const [isLoadingVibe, setIsLoadingVibe] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>('');
  const { user } = useAuth();

  const searchMovies = useCallback(async (query: string): Promise<SearchResult[]> => {
    const trimmedQuery = query.trim();
    
    // Skip if same query
    if (trimmedQuery === lastQueryRef.current) {
      return [];
    }
    
    lastQueryRef.current = trimmedQuery;
    
    if (!trimmedQuery) {
      setResults([]);
      setVibeList(null);
      setSearchMetadata({ mode: 'standard' });
      return [];
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setError(null);
    setVibeList(null);

    try {
      // Classify query intent
      const classification = classifyQuery(trimmedQuery);
      
      let searchResults: SearchResult[] = [];
      let metadata: SearchMetadata = { mode: classification.mode };
      
      // Handle different search modes
      if (classification.mode === 'ai-curated') {
        // AI-powered search for complex queries
        metadata.label = 'AI-curated results';
        
        const aiPrompt = `<task>
The user is searching for movies with this query: "${trimmedQuery}"

Interpret their intent and recommend 8-10 highly relevant movies.
Return a JSON array of movie objects.
</task>

<rules>
- Understand complex criteria (e.g., ratings, comparisons, mood, actors, directors, genres)
- Return films that match the criteria, including recent releases from 2023, 2024, and 2025
- Do NOT limit results to only well-known classics — include newer films where relevant
- Output ONLY valid JSON array, no markdown
</rules>

<output_format>
[
  {"title": "Movie Title", "year": "2024"},
  {"title": "Another Movie", "year": "2015"}
]
</output_format>`;

        const aiResponse = await callClaude(aiPrompt, 'You are a film expert helping users discover movies.');
        
        if (aiResponse) {
          try {
            // Extract JSON from response
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const movieTitles: {title: string, year: string}[] = JSON.parse(jsonMatch[0]);
              
              // Hydrate each movie via TMDB search (with year fallback)
              const hydratePromises = movieTitles.map(async (m) => {
                try {
                  const signal = abortControllerRef.current?.signal;
                  // First try with year for precision
                  let res = await fetch(
                    `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(m.title)}&year=${m.year}&language=en-US`,
                    { signal }
                  );
                  let data = res.ok ? await res.json() : { results: [] };
                  // Fallback: search without year if no results (handles year mismatches & new films)
                  if (!data.results?.length) {
                    res = await fetch(
                      `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(m.title)}&language=en-US`,
                      { signal }
                    );
                    data = res.ok ? await res.json() : { results: [] };
                  }
                  if (data.results && data.results.length > 0) {
                    const movie = data.results[0];
                    return {
                      id: movie.id,
                      title: movie.title,
                      year: movie.release_date?.slice(0, 4) || '',
                      posterPath: movie.poster_path,
                      backdropPath: movie.backdrop_path,
                      genres: (movie.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
                      overview: movie.overview || '',
                      popularity: movie.popularity || 0,
                      voteAverage: movie.vote_average || 0,
                      voteCount: movie.vote_count || 0,
                      mediaType: 'movie' as const,
                    };
                  }
                } catch (err) {
                  console.error('Failed to hydrate movie:', m.title, err);
                }
                return null;
              });
              
              const hydrated = await Promise.all(hydratePromises);
              searchResults = hydrated.filter((m): m is NonNullable<typeof m> => m !== null) as SearchResult[];
            }
          } catch (err) {
            console.error('Failed to parse AI response:', err);
          }
        }
        
        // Trigger personalized vibe list in parallel for AI queries
        if (user?.uid) {
          generateVibeList(trimmedQuery, '');
        }
        
        if (searchResults.length === 0) {
          // Fall back to standard search if AI fails
          classification.mode = 'standard';
        }
      }
      
      // Standard search (or fallback)
      if (classification.mode === 'standard' || searchResults.length === 0) {
        metadata.mode = 'standard';
        
        // Search both movies and TV shows
        const [movieRes, tvRes] = await Promise.all([
          fetch(
            `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(trimmedQuery)}&language=en-US&page=1`,
            { signal: abortControllerRef.current.signal }
          ),
          fetch(
            `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(trimmedQuery)}&language=en-US&page=1`,
            { signal: abortControllerRef.current.signal }
          ),
        ]);

        if (!movieRes.ok || !tvRes.ok) {
          throw new Error('Search failed');
        }

        const [movieData, tvData] = await Promise.all([
          movieRes.json(),
          tvRes.json(),
        ]);

        const movies: SearchResult[] = (movieData.results || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          year: m.release_date?.slice(0, 4) || '',
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          genres: (m.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
          overview: m.overview || '',
          popularity: m.popularity || 0,
          voteAverage: m.vote_average || 0,
          voteCount: m.vote_count || 0,
          mediaType: 'movie' as const,
        }));

        const tvShows: SearchResult[] = (tvData.results || []).map((t: any) => ({
          id: t.id,
          title: t.name,
          year: t.first_air_date?.slice(0, 4) || '',
          posterPath: t.poster_path,
          backdropPath: t.backdrop_path,
          genres: (t.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
          overview: t.overview || '',
          popularity: t.popularity || 0,
          voteAverage: t.vote_average || 0,
          voteCount: t.vote_count || 0,
          mediaType: 'tv' as const,
        }));

        // Combine and sort by enhanced relevance algorithm
        const queryLower = trimmedQuery.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(Boolean);
        
        // For very short queries (< 3 chars), rely more on TMDB's native ordering
        const isShortQuery = trimmedQuery.length < 3;
        
        searchResults = [...movies, ...tvShows].sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          
          // Remove "The ", "A ", "An " prefix for better matching
          const cleanA = aTitle.replace(/^(the|a|an)\s+/i, '');
          const cleanB = bTitle.replace(/^(the|a|an)\s+/i, '');
          
          // Calculate match ranks (lower is better)
          const getMatchRank = (title: string, cleanTitle: string) => {
            // Exact match
            if (title === queryLower || cleanTitle === queryLower) return 0;
            
            // Starts with query
            if (title.startsWith(queryLower) || cleanTitle.startsWith(queryLower)) return 1;
            
            // Subtitle matching - check for query after colon or dash
            // e.g., "Tokyo Drift" matches "The Fast and the Furious: Tokyo Drift"
            const colonParts = title.split(/[:\-–—]/);
            for (const part of colonParts) {
              const trimmedPart = part.trim();
              if (trimmedPart === queryLower || trimmedPart.startsWith(queryLower)) {
                return 2; // High priority for subtitle matches
              }
            }
            
            // All query words present (word boundary matching)
            if (queryWords.length > 1) {
              const allWordsPresent = queryWords.every(word => 
                title.includes(word) || cleanTitle.includes(word)
              );
              if (allWordsPresent) return 3;
            }
            
            // Contains query anywhere
            if (title.includes(queryLower) || cleanTitle.includes(queryLower)) return 4;
            
            return 5; // No match
          };
          
          const aRank = getMatchRank(aTitle, cleanA);
          const bRank = getMatchRank(bTitle, cleanB);
          
          // Sort by match rank first
          if (aRank !== bRank) return aRank - bRank;
          
          // For short queries, prioritize TMDB popularity more heavily
          if (isShortQuery) {
            return b.popularity - a.popularity;
          }
          
          // Within same rank, use vote_count as primary tiebreaker (favors well-known titles)
          if (a.voteCount !== b.voteCount) {
            return b.voteCount - a.voteCount;
          }
          
          // Final tiebreaker: popularity
          return b.popularity - a.popularity;
        });
      }
      
      setResults(searchResults);
      setSearchMetadata(metadata);
      return searchResults;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return []; // Return empty on abort, don't update state
      }
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [user?.uid]); // Depend on user ID for personalized vibes

  // Generate personalized vibe list (runs in background)
  const generateVibeList = useCallback(async (query: string, genreHint: string) => {
    if (!user?.uid) return;
    
    setIsLoadingVibe(true);
    
    try {
      // Fetch user context
      const userMovies = await fetchUserContext(user.uid);
      const contextString = userMovies.length > 0 
        ? `\nUser's recent movies: ${userMovies.join(', ')}` 
        : '';
      
      const vibePrompt = `<task>
Create a personalized movie recommendation list based on the user's search query and their viewing history.
Query: "${query}"
Genre hint: "${genreHint}"${contextString}

Generate a catchy list title and 6-8 movie recommendations tailored to this user's tastes.
</task>

<rules>
- Make the list title punchy and personalized (e.g., "Gritty Crime for the Heat Lover")
- Include a brief description of the vibe/theme
- Recommend diverse but thematically connected films
- Consider the user's viewing history when available
- Output ONLY valid JSON, no markdown
</rules>

<output_format>
{
  "title": "List Title",
  "description": "Brief description of the vibe",
  "movies": [
    {"title": "Movie Title", "year": "2020"},
    {"title": "Another Movie", "year": "2015"}
  ]
}
</output_format>`;

      const aiResponse = await callClaude(vibePrompt, 'You are a film curator creating personalized movie lists.');
      
      if (aiResponse) {
        try {
          // Extract JSON from response
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const vibeData: { title: string; description: string; movies: {title: string, year: string}[] } = JSON.parse(jsonMatch[0]);
            
            // Hydrate movies via TMDB (with year fallback)
            const hydratePromises = vibeData.movies.map(async (m) => {
              try {
                // First try with year for precision
                let res = await fetch(
                  `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(m.title)}&year=${m.year}&language=en-US`
                );
                let data = res.ok ? await res.json() : { results: [] };
                // Fallback: search without year if no results
                if (!data.results?.length) {
                  res = await fetch(
                    `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(m.title)}&language=en-US`
                  );
                  data = res.ok ? await res.json() : { results: [] };
                }
                if (data.results && data.results.length > 0) {
                  const movie = data.results[0];
                  return {
                    id: movie.id,
                    title: movie.title,
                    year: movie.release_date?.slice(0, 4) || '',
                    posterPath: movie.poster_path,
                    backdropPath: movie.backdrop_path,
                    genres: (movie.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
                    overview: movie.overview || '',
                    popularity: movie.popularity || 0,
                    voteAverage: movie.vote_average || 0,
                    voteCount: movie.vote_count || 0,
                    mediaType: 'movie' as const,
                  };
                }
              } catch (err) {
                console.error('Failed to hydrate vibe movie:', m.title, err);
              }
              return null;
            });
            
            const hydratedMovies = await Promise.all(hydratePromises);
            const validMovies = hydratedMovies.filter((m): m is NonNullable<typeof m> => m !== null) as SearchResult[];
            
            if (validMovies.length > 0) {
              setVibeList({
                title: vibeData.title,
                description: vibeData.description,
                movies: validMovies,
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse vibe response:', err);
        }
      }
    } catch (err) {
      console.error('Failed to generate vibe list:', err);
    } finally {
      setIsLoadingVibe(false);
    }
  }, [user?.uid]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setVibeList(null);
    setSearchMetadata({ mode: 'standard' });
    lastQueryRef.current = '';
  }, []);

  return {
    results,
    isSearching,
    error,
    searchMetadata,
    vibeList,
    isLoadingVibe,
    searchMovies,
    clearResults,
  };
}
