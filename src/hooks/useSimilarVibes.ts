import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { callClaude } from '../lib/claude';
import { genreNames } from '../lib/tmdb';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

const TMDB_BASE = 'https://api.themoviedb.org/3';



export type SimilarMovie = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  overview: string;
  voteAverage: number;
};

const searchTMDB = async (title: string, year?: string): Promise<any | null> => {
  try {
    const url = new URL(`${TMDB_BASE}/search/movie`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('query', title);
    if (year) url.searchParams.set('year', year);
    
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
};

const fetchMovieDetails = async (movieId: number): Promise<any | null> => {
  try {
    const response = await fetch(
      `${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export function useSimilarVibes() {
  const { id } = useParams<{ id: string }>();
  
  const [similarMovies, setSimilarMovies] = useState<SimilarMovie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const loadedIdsRef = useRef<Set<number>>(new Set());

  // Fetch movie details for context
  useEffect(() => {
    if (id) {
      // Reset state when movie changes
      setSimilarMovies([]);
      setPage(0);
      setHasMore(true);
      loadedIdsRef.current = new Set();
      fetchMovieDetails(parseInt(id)).then(setMovieDetails);
    }
  }, [id]);

  // Initial load of similar movies using AI
  useEffect(() => {
    if (movieDetails && similarMovies.length === 0) {
      loadSimilarMovies(movieDetails, 0);
    }
  }, [movieDetails]);

  const loadSimilarMovies = useCallback(async (movie: any, currentPage: number) => {
    if (!movie || isLoading) return;
    
    setIsLoading(true);
    try {
      const alreadyLoaded = Array.from(loadedIdsRef.current);
      const skipList = similarMovies.map(m => m.title).join(', ');
      
      // System prompt for similar vibes
      const systemPrompt = `You are a film scholar and critic who specializes in identifying deep connections between films beyond surface-level similarities. You consider directorial style, cinematography, themes, tone, and cultural impact.`;
      
      // Similar vibes prompt using Claude's XML structure
      const prompt = `<task>
Recommend ${currentPage === 0 ? 8 : 6} films that fans of the reference film would love.
</task>

<reference_film>
Title: "${movie.title}"
Year: ${movie.release_date?.slice(0, 4)}
Genres: ${movie.genres?.map((g: any) => g.name).join(', ')}
</reference_film>

<recommendation_criteria>
- Same director or cinematographer's other acclaimed work
- Films with similar narrative structure or themes
- Critically acclaimed films (7.5+ rating preferred) with similar tone
- Mix of classics and modern films
- Hidden gems that cinephiles love
- Avoid mainstream obvious picks if possible
${skipList ? `\n- DO NOT recommend: ${skipList}` : ''}
</recommendation_criteria>

<output_format>
Return ONLY a valid JSON array, no markdown blocks or explanations:
[{"title": "Movie Title", "year": "YYYY"}, {"title": "Another Film", "year": "YYYY"}]
</output_format>

<example>
[{"title": "There Will Be Blood", "year": "2007"}, {"title": "The Master", "year": "2012"}]
</example>`;

      const response = await callClaude(prompt, systemPrompt);
      if (!response) {
        // Fallback to TMDB similar endpoint
        await loadFromTMDBFallback(parseInt(id || '0'));
        return;
      }

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        await loadFromTMDBFallback(parseInt(id || '0'));
        return;
      }

      let suggestions;
      try {
        suggestions = JSON.parse(jsonMatch[0]);
      } catch {
        await loadFromTMDBFallback(parseInt(id || '0'));
        return;
      }
      
      // Fetch TMDB details for each suggestion (in parallel for speed)
      const detailedMovies = await Promise.all(
        suggestions.map(async (s: { title: string; year: string }) => {
          const tmdb = await searchTMDB(s.title, s.year);
          if (tmdb && tmdb.id !== parseInt(id || '0') && !alreadyLoaded.includes(tmdb.id)) {
            loadedIdsRef.current.add(tmdb.id);
            return {
              id: tmdb.id,
              title: tmdb.title,
              year: tmdb.release_date?.slice(0, 4) || s.year,
              posterPath: tmdb.poster_path,
              backdropPath: tmdb.backdrop_path,
              genres: genreNames(tmdb.genre_ids),
              overview: tmdb.overview || '',
              voteAverage: tmdb.vote_average || 0,
            };
          }
          return null;
        })
      );

      const validMovies = detailedMovies.filter(Boolean) as SimilarMovie[];
      
      if (currentPage === 0) {
        setSimilarMovies(validMovies);
      } else {
        setSimilarMovies(prev => [...prev, ...validMovies]);
      }
      
      setPage(currentPage + 1);
      setHasMore(validMovies.length >= 3);
    } catch (error) {
      console.error('Failed to load similar movies:', error);
      // Try TMDB fallback
      await loadFromTMDBFallback(parseInt(id || '0'));
    } finally {
      setIsLoading(false);
    }
  }, [id, similarMovies, isLoading]);

  // TMDB fallback if AI fails - use recommendations endpoint (better quality than /similar)
  const loadFromTMDBFallback = async (movieId: number) => {
    try {
      // Try recommendations first (better quality), fallback to similar
      let response = await fetch(
        `${TMDB_BASE}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`
      );
      
      if (!response.ok) {
        response = await fetch(
          `${TMDB_BASE}/movie/${movieId}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`
        );
      }
      
      if (!response.ok) {
        setHasMore(false);
        return;
      }
      
      const data = await response.json();
      // Filter for higher quality movies (rating > 6.5) and sort by rating
      const movies = (data.results || [])
        .filter((m: any) => m.vote_average >= 6.5 && m.vote_count > 100)
        .sort((a: any, b: any) => b.vote_average - a.vote_average)
        .slice(0, 8)
        .map((m: any) => ({
          id: m.id,
          title: m.title,
          year: m.release_date?.slice(0, 4) || '',
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          genres: genreNames(m.genre_ids),
          overview: m.overview || '',
          voteAverage: m.vote_average || 0,
        }));
      
      // If no high-quality results, take any results
      if (movies.length === 0) {
        const anyMovies = (data.results || []).slice(0, 8).map((m: any) => ({
          id: m.id,
          title: m.title,
          year: m.release_date?.slice(0, 4) || '',
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          genres: genreNames(m.genre_ids),
          overview: m.overview || '',
          voteAverage: m.vote_average || 0,
        }));
        setSimilarMovies(anyMovies);
      } else {
        setSimilarMovies(movies);
      }
      setHasMore(false); // TMDB fallback doesn't support AI-powered "load more"
    } catch {
      setHasMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && movieDetails) {
      loadSimilarMovies(movieDetails, page);
    }
  }, [isLoading, hasMore, movieDetails, page, loadSimilarMovies]);

  const reset = useCallback(() => {
    setSimilarMovies([]);
    setPage(0);
    setHasMore(true);
    loadedIdsRef.current = new Set();
  }, []);

  return {
    similarMovies,
    isLoading,
    hasMore,
    loadMore,
    reset,
  };
}
