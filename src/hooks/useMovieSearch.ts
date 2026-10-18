import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { callLlm, streamLlm } from '../lib/llm';
import { useAuth } from './useAuth';
import { useLibrary } from '../lib/library';
import { getTaste } from '../lib/taste';
import { fallbackByQuery } from '../lib/fallbackCatalog';
import { AI_SEARCH_CACHE_KEY, AI_SEARCH_LIMIT, AI_SEARCH_MAX_TOKENS, AI_SEARCH_MODEL, AI_SEARCH_REASONING, AI_SEARCH_RECENT_EXTRA, AI_SEARCH_SYSTEM, buildAiSearchPrompt, buildRecencyPrompt, takeFilmTitles } from '../lib/aiSearch';
import { watchedFilmExclusions, withoutWatched } from './selectExclusions';

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

async function hydrateMovie(title: string, year: string, signal?: AbortSignal): Promise<SearchResult | null> {
  try {
    const signalInit = signal ? { signal } : undefined;
    let res = await fetch(
      `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&year=${year}&language=en-US`,
      signalInit,
    );
    let data = res.ok ? await res.json() : { results: [] };
    if (!data.results?.length) {
      res = await fetch(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US`,
        signalInit,
      );
      data = res.ok ? await res.json() : { results: [] };
    }
    const movie = data.results?.[0];
    if (!movie) return null;
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
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    console.error('Failed to hydrate movie:', title, err);
    return null;
  }
}

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
const fetchUserContext = async (userId: string): Promise<string> => {
  try {
    const snapshot = await getTaste(userId);
    return snapshot.generated.compactForChat || snapshot.context.preferences.join('; ');
  } catch (err) {
    console.error('Failed to fetch user context:', err);
    return '';
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
  const generationRef = useRef(0);
  const lastQueryRef = useRef<string>('');
  const { user } = useAuth();
  const { films: libraryFilms } = useLibrary();
  const watchedExclusions = useMemo(() => watchedFilmExclusions(libraryFilms), [libraryFilms]);
  const watchedRef = useRef(watchedExclusions);
  watchedRef.current = watchedExclusions;

  useEffect(() => {
    const excluded = watchedRef.current;
    if (!excluded.length) return;
    if (searchMetadata.mode === 'ai-curated') {
      setResults((prev) => {
        const next = withoutWatched(prev, excluded);
        return next.length === prev.length ? prev : next;
      });
    }
    setVibeList((prev) => {
      if (!prev) return prev;
      const movies = withoutWatched(prev.movies, excluded);
      if (movies.length === prev.movies.length) return prev;
      return movies.length ? { ...prev, movies } : null;
    });
  }, [watchedExclusions, searchMetadata.mode]);

  const searchMovies = useCallback(async (query: string): Promise<SearchResult[]> => {
    const trimmedQuery = query.trim();
    
    // Skip if same query
    if (trimmedQuery === lastQueryRef.current) {
      return [];
    }
    
    lastQueryRef.current = trimmedQuery;
    
    if (!trimmedQuery) {
      generationRef.current += 1;
      abortControllerRef.current?.abort();
      setIsSearching(false);
      setResults([]);
      setVibeList(null);
      setSearchMetadata({ mode: 'standard' });
      return [];
    }

    const generation = ++generationRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsSearching(true);
    setError(null);
    setVibeList(null);
    setResults([]);

    try {
      // Classify query intent
      const classification = classifyQuery(trimmedQuery);
      
      let searchResults: SearchResult[] = [];
      let metadata: SearchMetadata = { mode: classification.mode };
      
      // Handle different search modes
      if (classification.mode === 'ai-curated') {
        metadata.label = 'AI-curated results';
        setSearchMetadata(metadata);
        const seenTitles = new Set<string>();
        const seenIds = new Set<number>();
        const found: SearchResult[] = [];
        let pending = '';
        let skippedWatched = 0;
        const hydrations: Promise<void>[] = [];

        const accept = (film: { title: string; year: string }, fromRecency = false) => {
          const key = film.title.toLowerCase();
          const cap = fromRecency ? AI_SEARCH_LIMIT + AI_SEARCH_RECENT_EXTRA : AI_SEARCH_LIMIT;
          if (!key || seenTitles.has(key) || seenTitles.size >= cap) return;
          seenTitles.add(key);
          if (withoutWatched([film], watchedRef.current).length === 0) {
            skippedWatched += 1;
            return;
          }
          hydrations.push((async () => {
            try {
              const movie = await hydrateMovie(film.title, film.year, signal);
              if (!movie || generation !== generationRef.current || seenIds.has(movie.id)) return;
              if (withoutWatched([movie], watchedRef.current).length === 0) {
                skippedWatched += 1;
                return;
              }
              seenIds.add(movie.id);
              found.push(movie);
              setResults((prev) => (prev.some((row) => row.id === movie.id) ? prev : [...prev, movie]));
            } catch (err) {
              if ((err as Error).name !== 'AbortError') console.error('Failed to hydrate movie:', film.title, err);
            }
          })());
        };

        const recencyPromise = callLlm(
          buildRecencyPrompt(trimmedQuery),
          AI_SEARCH_SYSTEM,
          {
            maxTokens: AI_SEARCH_MAX_TOKENS,
            reasoningEffort: AI_SEARCH_REASONING,
            model: AI_SEARCH_MODEL,
            webSearch: true,
          },
        ).catch((err) => {
          console.error('Recent-film search failed:', err);
          return null;
        });

        try {
          await streamLlm(
            buildAiSearchPrompt(trimmedQuery),
            AI_SEARCH_SYSTEM,
            {
              maxTokens: AI_SEARCH_MAX_TOKENS,
              reasoningEffort: AI_SEARCH_REASONING,
              model: AI_SEARCH_MODEL,
              promptCacheKey: AI_SEARCH_CACHE_KEY,
            },
            (delta) => {
              pending += delta;
              const next = takeFilmTitles(pending);
              pending = next.rest;
              next.titles.forEach((film) => accept(film));
            },
            signal,
          );
          const tail = takeFilmTitles(pending + ']');
          tail.titles.forEach((film) => accept(film));
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err;
          console.error('AI search stream failed:', err);
        }

        await Promise.all(hydrations);
        if (generation !== generationRef.current) return [];
        const recencyText = await recencyPromise;
        if (generation === generationRef.current && recencyText) {
          takeFilmTitles(recencyText).titles.forEach((film) => accept(film, true));
          await Promise.all(hydrations);
        }
        if (generation !== generationRef.current) return [];
        searchResults = found;

        if (user?.uid && searchResults.length > 0) {
          generateVibeList(trimmedQuery, '');
        }

        if (searchResults.length === 0 && skippedWatched === 0) {
          classification.mode = 'standard';
          metadata = { mode: 'standard' };
        }
      }
      
      // Standard search (or fallback)
      if (classification.mode === 'standard' || searchResults.length === 0) {
        metadata.mode = 'standard';
        
        // Search movies (pages 1+2) and TV (page 1) in parallel so popular films
        // like "Casino Royale" that TMDB buries on page 2 still surface correctly.
        const sig = { signal };
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

        const [movie1Data, movie2Data, tvData] = await Promise.all([
          movie1Res.json(),
          movie2Res.ok ? movie2Res.json() : { results: [] },
          tvRes.json(),
        ]);

        // Merge page 1+2 movie results, deduplicate by id
        const seenIds = new Set<number>();
        const mergedMovieResults = [...(movie1Data.results || []), ...(movie2Data.results || [])]
          .filter((m: any) => { if (seenIds.has(m.id)) return false; seenIds.add(m.id); return true; });

        const movies: SearchResult[] = mergedMovieResults.map((m: any) => ({
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
        void trimmedQuery.length; // ranking no longer needs short-query special-case
        
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
      
      if (generation !== generationRef.current) return [];
      setResults(searchResults);
      setSearchMetadata(metadata);
      return searchResults;
    } catch (err: any) {
      if (err.name === 'AbortError') {
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
      if (generation !== generationRef.current) return [];
      setResults(local);
      setError(null);
      return local;
    } finally {
      if (generation === generationRef.current) setIsSearching(false);
    }
  }, [user?.uid]); // Depend on user ID for personalized vibes

  // Generate personalized vibe list (runs in background)
  const generateVibeList = useCallback(async (query: string, genreHint: string) => {
    if (!user?.uid) return;
    
    setIsLoadingVibe(true);
    
    try {
      // Fetch user context
      const taste = await fetchUserContext(user.uid);
      const contextString = taste ? `\nViewer taste: ${taste}` : '';
      
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

      const aiResponse = await callLlm(vibePrompt, 'You are a film curator creating personalized movie lists.', {
        maxTokens: 480,
        reasoningEffort: 'none',
      });
      
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
            const validMovies = withoutWatched(
              hydratedMovies.filter((m): m is NonNullable<typeof m> => m !== null) as SearchResult[],
              watchedRef.current,
            );
            
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
