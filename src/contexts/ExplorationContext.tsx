import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { callClaude } from '../lib/claude';
import { logActivity } from '../lib/activityLogger';

type ExploredMovie = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  mediaType: 'movie' | 'tv';
};

type ExplorationContextType = {
  clickedMovies: ExploredMovie[];
  addMovie: (movie: ExploredMovie) => void;
  resetSession: () => void;
  patternInsight: string | null;
  isAnalyzing: boolean;
  showMoreMovies: () => Promise<any[]>;
  showMoreResults: any[];
  isLoadingMore: boolean;
  saveVibe: () => Promise<boolean>;
  isSavingVibe: boolean;
  vibeSaved: boolean;
  dismissPattern: () => void;
};

const ExplorationContext = createContext<ExplorationContextType | null>(null);

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

// System prompt for pattern analysis
const PATTERN_SYSTEM_PROMPT = `You are a film-obsessed cinephile with encyclopedic knowledge of cinema. You excel at identifying meaningful patterns in viewing behavior. Your voice is playful and Letterboxd-style.`;

// Pattern analysis prompt using Claude's XML structure
const PATTERN_PROMPT = `<task>
Determine if there's a MEANINGFUL pattern in the user's browsed movies.
</task>

<browsed_movies>
{movieList}
</browsed_movies>

<pattern_criteria>
Look for:
- Shared director or cinematographer
- Specific era or decade
- Genre combinations (not just single genre)
- Thematic threads or subject matter
- Visual style or aesthetic
- Film movement (French New Wave, Italian Neorealism, etc.)
</pattern_criteria>

<response_format>
If YES (confidence > 50%): Write 1-2 punchy sentences in Letterboxd voice. Be specific - reference directors, movements, eras.

If NO clear pattern: Respond with exactly "NO_PATTERN"
</response_format>

<good_examples>
"Ah, the 'morally bankrupt men doing crimes with style' marathon. Guy Ritchie would be proud."
"Someone's got a thing for slow-burn existential dread. Very A24 of you."
</good_examples>

<no_pattern_examples>
- Random mix of unrelated genres with no thematic connection
- Just 3 popular movies from different decades/styles with nothing in common
</no_pattern_examples>

<rules>
- DO NOT be generic ("you like action movies")
- Be specific or return NO_PATTERN
- Never force a pattern if none exists
</rules>`;

// System prompt for show more recommendations
const SHOW_MORE_SYSTEM_PROMPT = `You are an expert film curator who specializes in pattern recognition and recommending films that match specific vibes, themes, and aesthetics.`;

// Show more recommendations prompt
const SHOW_MORE_PROMPT = `<task>
Suggest 10 movies that perfectly match the detected viewing pattern.
</task>

<detected_pattern>
{pattern}
</detected_pattern>

<movies_explored>
{movieList}
</movies_explored>

<recommendation_criteria>
- Match the tone, style, and mood of the pattern
- Include films from the same era or film movement if relevant
- Prioritize hidden gems the user might not know
- Mix of classics and recent films
- Avoid the movies already explored
</recommendation_criteria>

<output_format>
Return ONLY a valid JSON array (no markdown, no explanations):
[{"title": "Movie Title", "year": "YYYY"}, {"title": "Another Film", "year": "YYYY"}]
</output_format>

<example>
[{"title": "Punch-Drunk Love", "year": "2002"}, {"title": "The Master", "year": "2012"}]
</example>`;

const searchTMDB = async (title: string, year?: string): Promise<any | null> => {
  try {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
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

export function ExplorationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [clickedMovies, setClickedMovies] = useState<ExploredMovie[]>([]);
  const [patternInsight, setPatternInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSavingVibe, setIsSavingVibe] = useState(false);
  const [showMoreResults, setShowMoreResults] = useState<any[]>([]);
  const [vibeSaved, setVibeSaved] = useState(false);
  
  // Track which movie count we've already analyzed to prevent re-analysis
  const lastAnalyzedCountRef = useRef(0);

  const analyzePattern = useCallback(async (movies: ExploredMovie[]) => {
    if (movies.length < 3) return;
    
    // Only analyze if we have new movies since last analysis
    if (movies.length <= lastAnalyzedCountRef.current) return;
    lastAnalyzedCountRef.current = movies.length;

    setIsAnalyzing(true);
    try {
      const movieList = movies
        .map((m) => `- ${m.title} (${m.year}) [${m.genres.join(', ')}]`)
        .join('\n');

      const prompt = PATTERN_PROMPT.replace('{movieList}', movieList);
      const insight = await callClaude(prompt, PATTERN_SYSTEM_PROMPT);
      
      // Only set pattern if it's valid (not NO_PATTERN)
      if (insight && !insight.trim().includes('NO_PATTERN')) {
        setPatternInsight(insight.trim());
      } else {
        // No valid pattern detected - don't show assistant
        setPatternInsight(null);
      }
    } catch (error) {
      console.error('Pattern analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const addMovie = useCallback((movie: ExploredMovie) => {
    setClickedMovies((prev) => {
      // Don't add duplicates
      if (prev.some((m) => m.id === movie.id && m.mediaType === movie.mediaType)) {
        return prev;
      }
      
      const updated = [...prev, movie];
      
      // Trigger pattern analysis at 3+ movies (only if new)
      if (updated.length >= 3 && updated.length > lastAnalyzedCountRef.current) {
        analyzePattern(updated);
      }
      
      return updated;
    });
  }, [analyzePattern]);

  const resetSession = useCallback(() => {
    setClickedMovies([]);
    setPatternInsight(null);
    setShowMoreResults([]);
    setVibeSaved(false);
    lastAnalyzedCountRef.current = 0;
  }, []);

  const dismissPattern = useCallback(() => {
    setPatternInsight(null);
    setShowMoreResults([]);
  }, []);

  const showMoreMovies = useCallback(async () => {
    if (!patternInsight || clickedMovies.length < 3) return [];

    setIsLoadingMore(true);
    try {
      const movieList = clickedMovies.map((m) => m.title).join(', ');
      const prompt = SHOW_MORE_PROMPT
        .replace('{pattern}', patternInsight)
        .replace('{movieList}', movieList);

      const response = await callClaude(prompt, SHOW_MORE_SYSTEM_PROMPT);
      if (!response) return [];

      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const suggestions = JSON.parse(jsonMatch[0]);
      
      // Fetch TMDB details for each suggestion
      const detailedResults = await Promise.all(
        suggestions.slice(0, 10).map(async (s: { title: string; year: string }) => {
          const tmdb = await searchTMDB(s.title, s.year);
          if (tmdb) {
            return {
              id: tmdb.id,
              title: tmdb.title,
              year: tmdb.release_date?.slice(0, 4) || s.year,
              posterPath: tmdb.poster_path,
              backdropPath: tmdb.backdrop_path,
              overview: tmdb.overview,
              voteAverage: tmdb.vote_average,
            };
          }
          return null;
        })
      );

      const validResults = detailedResults.filter(Boolean);
      setShowMoreResults(validResults);
      return validResults;
    } catch (error) {
      console.error('Show more failed:', error);
      return [];
    } finally {
      setIsLoadingMore(false);
    }
  }, [patternInsight, clickedMovies]);

  const saveVibe = useCallback(async (): Promise<boolean> => {
    if (!user || !patternInsight || clickedMovies.length < 3) return false;

    setIsSavingVibe(true);
    try {
      const vibesRef = collection(db, 'users', user.uid, 'saved_vibes');
      await addDoc(vibesRef, {
        pattern: patternInsight,
        movies: clickedMovies.map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          posterPath: m.posterPath,
          mediaType: m.mediaType,
        })),
        createdAt: serverTimestamp(),
      });
      setVibeSaved(true);
      
      // Log activity
      if (user.email) {
        logActivity(user.uid, user.email, 'vibe_saved', {
          pattern: patternInsight,
          movieCount: clickedMovies.length,
          movieTitles: clickedMovies.map(m => m.title),
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save vibe:', error);
      return false;
    } finally {
      setIsSavingVibe(false);
    }
  }, [user, patternInsight, clickedMovies]);

  return (
    <ExplorationContext.Provider
      value={{
        clickedMovies,
        addMovie,
        resetSession,
        patternInsight,
        isAnalyzing,
        showMoreMovies,
        showMoreResults,
        isLoadingMore,
        saveVibe,
        isSavingVibe,
        vibeSaved,
        dismissPattern,
      }}
    >
      {children}
    </ExplorationContext.Provider>
  );
}

export function useExploration() {
  const context = useContext(ExplorationContext);
  if (!context) {
    throw new Error('useExploration must be used within an ExplorationProvider');
  }
  return context;
}

