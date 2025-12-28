import type { OrbitMovie, SwipeDirection } from '../stores/orbitStore';
import { callGeminiForJSON } from './gemini';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Response schema from Gemini - connection_reason is LAST to handle truncation
export interface OrbitResponse {
  title: string;
  year: string;
  hex: string;
  score: number;
  reason: string; // LAST - can be truncated safely
}

// NEW ORBIT PROMPTS - 4 attributes
// UP = Visual (cinematography, colors)
// RIGHT = Balanced (overall match)
// DOWN = Storytelling (narrative style)
// LEFT = Emotional (same feeling)

const VISUAL_PROMPT = `Film: "{title}" ({year})
Recommend 1 VISUALLY similar film - same cinematography style, color palette, or lighting.
JSON ONLY (no markdown):
{"title":"Film","year":"2020","hex":"#4a5568","score":85,"reason":"3 words"}`;

const BALANCED_PROMPT = `Film: "{title}" ({year}), {genres}
Recommend 1 well-matched film - similar tone, quality, and overall vibe.
JSON ONLY (no markdown):
{"title":"Film","year":"2020","hex":"#4a5568","score":85,"reason":"3 words"}`;

const STORYTELLING_PROMPT = `Film: "{title}" ({year}), dir: {director}
Recommend 1 film with similar NARRATIVE style - pacing, structure, or storytelling approach.
JSON ONLY (no markdown):
{"title":"Film","year":"2020","hex":"#4a5568","score":85,"reason":"3 words"}`;

const EMOTIONAL_PROMPT = `Film: "{title}" ({year})
Recommend 1 film that evokes the SAME EMOTION - same feeling when watching.
JSON ONLY (no markdown):
{"title":"Film","year":"2020","hex":"#4a5568","score":85,"reason":"3 words"}`;

// Build prompt based on direction
// UP = visual, RIGHT = balanced, DOWN = storytelling, LEFT = emotional
const buildPrompt = (
  movie: OrbitMovie,
  direction: SwipeDirection
): string => {
  const genres = movie.genres?.join(', ') || 'Drama';
  const director = movie.director || 'Unknown';
  
  let template: string;
  
  switch (direction) {
    case 'up':
      template = VISUAL_PROMPT;
      break;
    case 'right':
      template = BALANCED_PROMPT;
      break;
    case 'down':
      template = STORYTELLING_PROMPT;
      break;
    case 'left':
      template = EMOTIONAL_PROMPT;
      break;
    default:
      template = BALANCED_PROMPT;
  }
  
  return template
    .replace('{title}', movie.title)
    .replace('{year}', movie.year)
    .replace('{genres}', genres)
    .replace('{director}', director);
};

// Validate and normalize orbit response fields
const normalizeOrbitResponse = (parsed: any): OrbitResponse | null => {
  // Support both old and new field names for backwards compatibility
  const title = parsed.title || parsed.next_movie_title;
  const year = parsed.year;
  
  // Validate required fields
  if (!title || !year) {
    console.error('Missing required fields in orbit response:', parsed);
    return null;
  }
  
  // Ensure hex color is valid (default if missing)
  let hexColor = parsed.hex || parsed.dominant_hex_color || '#1a1a2e';
  if (!hexColor.startsWith('#')) {
    hexColor = '#' + hexColor;
  }
  
  return {
    title: title,
    year: year,
    hex: hexColor,
    score: parsed.score || parsed.similarity_score || 75,
    reason: parsed.reason || parsed.connection_reason || 'Connected',
  };
};

// Search TMDB for movie details
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

// Get movie details from TMDB
const getMovieDetails = async (tmdbId: number): Promise<any | null> => {
  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

// Hydrate OrbitResponse with TMDB data
const hydrateWithTMDB = async (orbitResponse: OrbitResponse): Promise<OrbitMovie | null> => {
  try {
    // Search for the movie on TMDB
    const searchResult = await searchTMDB(orbitResponse.title, orbitResponse.year);
    if (!searchResult) {
      // Try without year if first search fails
      const retryResult = await searchTMDB(orbitResponse.title);
      if (!retryResult) {
        console.warn('Could not find movie on TMDB:', orbitResponse.title);
        return null;
      }
    }
    
    const tmdbData = await getMovieDetails(searchResult?.id || 0);
    if (!tmdbData) {
      console.warn('Could not get movie details from TMDB:', orbitResponse.title);
      return null;
    }
    
    // Extract director from credits
    const director = tmdbData.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
    const cinematographer = tmdbData.credits?.crew?.find((c: any) => c.job === 'Director of Photography')?.name;
    
    return {
      id: tmdbData.id,
      title: tmdbData.title,
      year: tmdbData.release_date?.slice(0, 4) || orbitResponse.year,
      posterPath: tmdbData.poster_path,
      backdropPath: tmdbData.backdrop_path,
      dominantHex: orbitResponse.hex,
      mediaType: 'movie',
      director,
      cinematographer,
      genres: tmdbData.genres?.map((g: any) => g.name) || [],
    };
  } catch (error) {
    console.error('Failed to hydrate with TMDB:', error);
    return null;
  }
};

// Main function to get next movie based on swipe direction
export const getNextMovie = async (
  currentMovie: OrbitMovie,
  direction: SwipeDirection
): Promise<{ movie: OrbitMovie; connectionReason: string; similarityScore: number } | null> => {
  const prompt = buildPrompt(currentMovie, direction);
  
  console.log(`Orbit: Getting ${direction} recommendation for "${currentMovie.title}"`);
  
  // Use validated JSON call with auto-retry
  const exampleFormat = '{"title":"Film","year":"2020","hex":"#4a5568","score":85,"reason":"3 words"}';
  
  const parsed = await callGeminiForJSON<{
    title?: string;
    next_movie_title?: string;
    year: string;
    hex?: string;
    dominant_hex_color?: string;
    score?: number;
    similarity_score?: number;
    reason?: string;
    connection_reason?: string;
  }>(prompt, exampleFormat, 2);
  
  if (!parsed) {
    console.error('Orbit: Gemini JSON call failed after retries');
    return null;
  }
  
  const orbitResponse = normalizeOrbitResponse(parsed);
  if (!orbitResponse) {
    console.error('Orbit: Failed to normalize response');
    return null;
  }
  
  const hydratedMovie = await hydrateWithTMDB(orbitResponse);
  if (!hydratedMovie) {
    return null;
  }
  
  return {
    movie: hydratedMovie,
    connectionReason: orbitResponse.reason,
    similarityScore: orbitResponse.score,
  };
};

// Pre-fetch all possible next moves for a movie
// UP = visual, RIGHT = balanced, DOWN = storytelling, LEFT = emotional
export const prefetchNextMoves = async (
  currentMovie: OrbitMovie,
  backDirection?: SwipeDirection | null // Direction that goes back (skip prefetching)
): Promise<{
  visual: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
  balanced: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
  storytelling: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
  emotional: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
}> => {
  console.log('Orbit: Prefetching moves, back direction:', backDirection);
  
  // Fire all four requests in parallel (skip back direction)
  const [visual, balanced, storytelling, emotional] = await Promise.all([
    backDirection === 'up' ? Promise.resolve(null) : getNextMovie(currentMovie, 'up'),
    backDirection === 'right' ? Promise.resolve(null) : getNextMovie(currentMovie, 'right'),
    backDirection === 'down' ? Promise.resolve(null) : getNextMovie(currentMovie, 'down'),
    backDirection === 'left' ? Promise.resolve(null) : getNextMovie(currentMovie, 'left'),
  ]);
  
  return { visual, balanced, storytelling, emotional };
};

// Get additional movie info from TMDB (for enriching the experience)
export const getMovieCredits = async (tmdbId: number): Promise<{
  director?: string;
  cinematographer?: string;
} | null> => {
  try {
    const details = await getMovieDetails(tmdbId);
    if (!details) return null;
    
    const director = details.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
    const cinematographer = details.credits?.crew?.find((c: any) => c.job === 'Director of Photography')?.name;
    
    return { director, cinematographer };
  } catch {
    return null;
  }
};

// Extract dominant color from poster (fallback if Gemini doesn't provide accurate hex)
export const extractDominantColor = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#1a1a2e');
          return;
        }
        
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        
        // Simple average color extraction
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          // Skip very dark and very light pixels
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 30 && brightness < 220) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        
        if (count === 0) {
          resolve('#1a1a2e');
          return;
        }
        
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        
        // Darken the color slightly for better background use
        r = Math.round(r * 0.7);
        g = Math.round(g * 0.7);
        b = Math.round(b * 0.7);
        
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        resolve(hex);
      } catch {
        resolve('#1a1a2e');
      }
    };
    
    img.onerror = () => {
      resolve('#1a1a2e');
    };
  });
};

