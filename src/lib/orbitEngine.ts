import type { OrbitMovie, SwipeDirection } from '../stores/orbitStore';
import { callGemini, extractJSON } from './gemini';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Response schema from Gemini
export interface OrbitResponse {
  next_movie_title: string;
  year: string;
  dominant_hex_color: string;
  connection_reason: string;
  similarity_score: number;
  tmdb_id?: number;
}

// Compact prompts - MUST output valid JSON only, no markdown
const VIBE_PROMPT = `TASK: Recommend 1 movie with similar vibe to "{title}" ({year}), {genres}.
Pick something unexpected - NOT the obvious choice.
RESPOND WITH EXACTLY THIS JSON AND NOTHING ELSE:
{"next_movie_title":"Movie Name","year":"2020","dominant_hex_color":"#4a5568","connection_reason":"6 words max","similarity_score":85}`;

const AESTHETIC_PROMPT = `TASK: Recommend 1 visually similar movie to "{title}" ({year}).
Same color palette, lighting style, or visual aesthetic.
RESPOND WITH EXACTLY THIS JSON AND NOTHING ELSE:
{"next_movie_title":"Movie Name","year":"2020","dominant_hex_color":"#4a5568","connection_reason":"visual link","similarity_score":85}`;

const AUTEUR_PROMPT = `TASK: Recommend 1 movie related to "{title}" ({year}) by {director}.
Either same director OR similar narrative style.
RESPOND WITH EXACTLY THIS JSON AND NOTHING ELSE:
{"next_movie_title":"Movie Name","year":"2020","dominant_hex_color":"#4a5568","connection_reason":"auteur link","similarity_score":85}`;

// Build prompt based on direction
const buildPrompt = (
  movie: OrbitMovie,
  direction: SwipeDirection,
  extraContext?: { cinematographer?: string; writer?: string; visualStyle?: string }
): string => {
  const genres = movie.genres?.join(', ') || 'Unknown';
  const director = movie.director || 'Unknown';
  
  let template: string;
  
  switch (direction) {
    case 'left':
      template = VIBE_PROMPT;
      break;
    case 'down':
      template = AESTHETIC_PROMPT;
      break;
    case 'up':
      template = AUTEUR_PROMPT;
      break;
    default:
      template = VIBE_PROMPT;
  }
  
  return template
    .replace('{title}', movie.title)
    .replace('{year}', movie.year)
    .replace('{genres}', genres)
    .replace('{director}', director)
    .replace('{cinematographer}', extraContext?.cinematographer || 'Unknown')
    .replace('{writer}', extraContext?.writer || 'Unknown')
    .replace('{visual_style}', extraContext?.visualStyle || 'distinctive visual style');
};

// Parse Gemini response to OrbitResponse using robust extractJSON
const parseOrbitResponse = (text: string): OrbitResponse | null => {
  console.log('Orbit raw response:', text);
  
  // Use robust JSON extraction
  const parsed = extractJSON(text);
  if (!parsed) {
    console.error('Failed to extract JSON from orbit response');
    return null;
  }
  
  // Validate required fields
  if (!parsed.next_movie_title || !parsed.year) {
    console.error('Missing required fields in orbit response:', parsed);
    return null;
  }
  
  // Ensure hex color is valid (default if missing)
  let hexColor = parsed.dominant_hex_color || '#1a1a2e';
  if (!hexColor.startsWith('#')) {
    hexColor = '#' + hexColor;
  }
  
  return {
    next_movie_title: parsed.next_movie_title,
    year: parsed.year,
    dominant_hex_color: hexColor,
    connection_reason: parsed.connection_reason || 'Spiritual successor',
    similarity_score: parsed.similarity_score || 75,
    tmdb_id: parsed.tmdb_id,
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
    let tmdbData: any = null;
    
    // If we have a TMDB ID, use it directly
    if (orbitResponse.tmdb_id) {
      tmdbData = await getMovieDetails(orbitResponse.tmdb_id);
    }
    
    // Otherwise search for the movie
    if (!tmdbData) {
      const searchResult = await searchTMDB(orbitResponse.next_movie_title, orbitResponse.year);
      if (searchResult) {
        tmdbData = await getMovieDetails(searchResult.id);
      }
    }
    
    if (!tmdbData) {
      console.warn('Could not find movie on TMDB:', orbitResponse.next_movie_title);
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
      dominantHex: orbitResponse.dominant_hex_color,
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
  direction: SwipeDirection,
  extraContext?: { cinematographer?: string; writer?: string; visualStyle?: string }
): Promise<{ movie: OrbitMovie; connectionReason: string; similarityScore: number } | null> => {
  // Don't process 'right' swipe - that's history navigation
  if (direction === 'right') return null;
  
  const prompt = buildPrompt(currentMovie, direction, extraContext);
  
  const response = await callGemini(prompt);
  if (!response) {
    console.error('Gemini returned no response');
    return null;
  }
  
  const orbitResponse = parseOrbitResponse(response);
  if (!orbitResponse) {
    console.error('Failed to parse Gemini response');
    return null;
  }
  
  const hydratedMovie = await hydrateWithTMDB(orbitResponse);
  if (!hydratedMovie) {
    return null;
  }
  
  return {
    movie: hydratedMovie,
    connectionReason: orbitResponse.connection_reason,
    similarityScore: orbitResponse.similarity_score,
  };
};

// Pre-fetch all possible next moves for a movie
export const prefetchNextMoves = async (
  currentMovie: OrbitMovie,
  extraContext?: { cinematographer?: string; writer?: string; visualStyle?: string }
): Promise<{
  vibe: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
  aesthetic: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
  auteur: { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null;
}> => {
  // Fire all three requests in parallel
  const [vibe, aesthetic, auteur] = await Promise.all([
    getNextMovie(currentMovie, 'left', extraContext),
    getNextMovie(currentMovie, 'down', extraContext),
    getNextMovie(currentMovie, 'up', extraContext),
  ]);
  
  return { vibe, aesthetic, auteur };
};

// Get extra context for a movie (cinematographer, writer, etc.)
export const getMovieContext = async (tmdbId: number): Promise<{
  cinematographer?: string;
  writer?: string;
  visualStyle?: string;
} | null> => {
  try {
    const details = await getMovieDetails(tmdbId);
    if (!details) return null;
    
    const cinematographer = details.credits?.crew?.find((c: any) => c.job === 'Director of Photography')?.name;
    const writer = details.credits?.crew?.find((c: any) => c.job === 'Screenplay' || c.job === 'Writer')?.name;
    
    // Generate a visual style description based on genres
    const genres = details.genres?.map((g: any) => g.name) || [];
    let visualStyle = 'cinematic visuals';
    
    if (genres.includes('Science Fiction')) visualStyle = 'futuristic, high-tech visuals';
    else if (genres.includes('Horror')) visualStyle = 'dark, atmospheric tension';
    else if (genres.includes('Romance')) visualStyle = 'warm, intimate cinematography';
    else if (genres.includes('Action')) visualStyle = 'dynamic, high-energy visuals';
    else if (genres.includes('Drama')) visualStyle = 'naturalistic, character-focused framing';
    
    return { cinematographer, writer, visualStyle };
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

