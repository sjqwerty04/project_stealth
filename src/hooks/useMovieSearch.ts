import { useState, useCallback, useRef } from 'react';
import { callLlm } from '../lib/llm';
import { useAuth } from './useAuth';
import { getTaste } from '../lib/taste';
import { loadSkill } from '../lib/skills';
import { fallbackByQuery } from '../lib/fallbackCatalog';

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

export type SearchMode = 'standard' | 'ai-curated';
export type SearchMetadata = {
  mode: SearchMode;
  label?: string;
};

type TmdbHit = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  overview?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
};

type TmdbSearchResponse = { results?: TmdbHit[] };

const EMPTY_SEARCH: TmdbSearchResponse = { results: [] };

const genresOf = (hit: TmdbHit): string[] => (hit.genre_ids || []).map((id) => GENRE_MAP[id]).filter(Boolean);

const movieFrom = (hit: TmdbHit): SearchResult => ({
  id: hit.id,
  title: hit.title || '',
  year: hit.release_date?.slice(0, 4) || '',
  posterPath: hit.poster_path ?? null,
  backdropPath: hit.backdrop_path ?? null,
  genres: genresOf(hit),
  overview: hit.overview || '',
  popularity: hit.popularity || 0,
  voteAverage: hit.vote_average || 0,
  voteCount: hit.vote_count || 0,
  mediaType: 'movie',
});

const showFrom = (hit: TmdbHit): SearchResult => ({
  id: hit.id,
  title: hit.name || '',
  year: hit.first_air_date?.slice(0, 4) || '',
  posterPath: hit.poster_path ?? null,
  backdropPath: hit.backdrop_path ?? null,
  genres: genresOf(hit),
  overview: hit.overview || '',
  popularity: hit.popularity || 0,
  voteAverage: hit.vote_average || 0,
  voteCount: hit.vote_count || 0,
  mediaType: 'tv',
});

// Query intent classifier — simple: short queries go to TMDB, everything else to AI
export const classifyQuery = (query: string): { mode: SearchMode } => {
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

export function useMovieSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata>({ mode: 'standard' });
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

    try {
      // Classify query intent
      const classification = classifyQuery(trimmedQuery);
      
      let searchResults: SearchResult[] = [];
      const metadata: SearchMetadata = { mode: classification.mode };
      
      // Handle different search modes
      if (classification.mode === 'ai-curated') {
        // AI-powered search for complex queries
        metadata.label = 'AI-curated results';
        
        const snapshot = user?.uid ? await getTaste(user.uid).catch(() => null) : null;
        const tasteBlock = snapshot?.generated.compactForChat
          ? `\n<user_taste>\n${snapshot.generated.compactForChat}\n</user_taste>`
          : '';
        const aiPrompt = `${loadSkill('search-intent')}

<task>
The user is searching for movies with this query: "${trimmedQuery}"
Interpret their intent and recommend 8-10 highly relevant movies.
</task>
${tasteBlock}

<output_format>
[
  {"title": "Movie Title", "year": "2024"}
]
</output_format>`;

        const aiResponse = await callLlm(aiPrompt, loadSkill('search-intent') || 'You are a film expert helping users discover movies.');
        
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
                  let data: TmdbSearchResponse = res.ok ? await res.json() : EMPTY_SEARCH;
                  // Fallback: search without year if no results (handles year mismatches & new films)
                  if (!data.results?.length) {
                    res = await fetch(
                      `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(m.title)}&language=en-US`,
                      { signal }
                    );
                    data = res.ok ? await res.json() : EMPTY_SEARCH;
                  }
                  const hit = data.results?.[0];
                  if (hit) {
                    return { ...movieFrom(hit), year: hit.release_date?.slice(0, 4) || m.year };
                  }
                } catch (err) {
                  console.error('Failed to hydrate movie:', m.title, err);
                }
                return null;
              });
              
              const hydrated = await Promise.all(hydratePromises);
              searchResults = hydrated.filter((m): m is SearchResult => m !== null);
            }
          } catch (err) {
            console.error('Failed to parse AI response:', err);
          }
        }
        
        if (searchResults.length === 0) {
          // Fall back to standard search if AI fails
          classification.mode = 'standard';
        }
      }
      
      // Standard search (or fallback)
      if (classification.mode === 'standard' || searchResults.length === 0) {
        metadata.mode = 'standard';
        
        // Search movies (pages 1+2) and TV (page 1) in parallel so popular films
        // like "Casino Royale" that TMDB buries on page 2 still surface correctly.
        const sig = { signal: abortControllerRef.current.signal };
        const movieUrl = (page: number) =>
          `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(trimmedQuery)}&language=en-US&page=${page}`;
        const tvUrl =
          `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(trimmedQuery)}&language=en-US&page=1`;

        const [movie1Res, movie2Res, tvRes] = await Promise.all([
          fetch(movieUrl(1), sig),
          fetch(movieUrl(2), sig),
          fetch(tvUrl, sig),
        ]);

        if (!movie1Res.ok || !tvRes.ok) throw new Error('Search failed');

        const [movie1Data, movie2Data, tvData]: TmdbSearchResponse[] = await Promise.all([
          movie1Res.json(),
          movie2Res.ok ? movie2Res.json() : EMPTY_SEARCH,
          tvRes.json(),
        ]);

        // Merge page 1+2 movie results, deduplicate by id
        const seenIds = new Set<number>();
        const mergedMovieResults = [...(movie1Data.results || []), ...(movie2Data.results || [])]
          .filter((m) => { if (seenIds.has(m.id)) return false; seenIds.add(m.id); return true; });

        const movies: SearchResult[] = mergedMovieResults.map(movieFrom);

        const tvShows: SearchResult[] = (tvData.results || []).map(showFrom);

        // Combine and sort by enhanced relevance algorithm
        const queryLower = trimmedQuery.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(Boolean);
        
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

          // Within same rank: use TMDB popularity as primary tiebreaker.
          // Popularity reflects real-time trending — a 2026 film that's currently
          // viral will score higher than a 1995 film with more all-time votes.
          // Use a blended score: 70% popularity, 30% log-scaled vote_count.
          const scoreA = a.popularity * 0.7 + Math.log10((a.voteCount || 0) + 1) * 0.3;
          const scoreB = b.popularity * 0.7 + Math.log10((b.voteCount || 0) + 1) * 0.3;
          return scoreB - scoreA;
        });
      }
      
      setResults(searchResults);
      setSearchMetadata(metadata);
      return searchResults;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return []; // Return empty on abort, don't update state
      }
      console.error('Search failed:', err);
      const local = fallbackByQuery(trimmedQuery).map((f) => ({
        id: f.id,
        title: f.title,
        year: f.year,
        posterPath: f.posterPath,
        backdropPath: f.backdropPath ?? null,
        genres: [] as string[],
        overview: f.overview,
        popularity: 1,
        voteAverage: 0,
        voteCount: 0,
        mediaType: f.mediaType,
      }));
      setResults(local);
      setError(null);
      return local;
    } finally {
      setIsSearching(false);
    }
  }, [user?.uid]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setSearchMetadata({ mode: 'standard' });
    lastQueryRef.current = '';
  }, []);

  return {
    results,
    isSearching,
    error,
    searchMetadata,
    searchMovies,
    clearResults,
  };
}
