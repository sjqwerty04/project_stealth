import type { OrbitMovie, SwipeDirection } from '../stores/orbitStore';
import { callLlmForJSON } from './llm';
import { recordOrbitTiming } from './orbitTelemetry';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Response schema. connection_reason is LAST to handle truncation
export interface OrbitResponse {
  title: string;
  year: string;
  hex: string;
  score: number;
  reason: string; // LAST - can be truncated safely
}

const ORBIT_SYSTEM_PROMPT = `You are a film scholar and cinematographer with deep expertise in visual storytelling, narrative structure, emotional resonance, and film analysis. You understand the nuanced connections between films across different dimensions.`;

// ORBIT PROMPTS - 4 directional attributes using XML structure
// UP = Visual (cinematography, colors)
// RIGHT = Balanced (overall match)
// DOWN = Storytelling (narrative style)
// LEFT = Emotional (same feeling)

const VISUAL_PROMPT = `<task>
Recommend ONE film that is visually similar to the reference film.
Focus on: cinematography style, color palette, lighting design, visual composition, camera work.
</task>

<reference_film>
Title: "{title}"
Year: {year}
</reference_film>

<rules>
- Focus purely on visual aesthetics and cinematography
- Consider director of photography's style
- Think about color grading and visual mood
- The "reason" must reference "{title}" by name
- Keep the reason under 8 words
- Make it punchy, evocative, and immediately understandable
- Output ONLY valid JSON, no markdown blocks
</rules>

<output_format>
{"title": "Film Title", "year": "2020", "hex": "#4a5568", "score": 85, "reason": "Brief reason referencing source film"}
</output_format>

<examples>
For "Heat" (1995): {"title": "Sicario", "year": "2015", "hex": "#3d5a80", "score": 88, "reason": "Blue hues and shadows from Heat"}
For "Blade Runner" (1982): {"title": "Ghost in the Shell", "year": "1995", "hex": "#2d3561", "score": 91, "reason": "Neon-soaked cyberpunk like Blade Runner"}
</examples>`;

const BALANCED_PROMPT = `<task>
Recommend ONE film that is a well-balanced match to the reference film.
Consider: overall tone, quality, genre blend, pacing, critical acclaim, and general vibe.
</task>

<reference_film>
Title: "{title}"
Year: {year}
Genres: {genres}
</reference_film>

<rules>
- Balance all aspects: tone, quality, genre, audience appeal
- Consider films that fans of the reference would enjoy
- Aim for similar critical reception and cultural impact
- The "reason" must reference "{title}" by name
- Keep the reason under 8 words
- Make it punchy, evocative, and immediately understandable
- Output ONLY valid JSON, no markdown blocks
</rules>

<output_format>
{"title": "Film Title", "year": "2020", "hex": "#4a5568", "score": 85, "reason": "Brief reason referencing source film"}
</output_format>

<examples>
For "Heat" (1995): {"title": "The Town", "year": "2010", "hex": "#4a5568", "score": 86, "reason": "Crime thriller vibes like Heat"}
For "No Country for Old Men" (2007): {"title": "Hell or High Water", "year": "2016", "hex": "#8b6f47", "score": 89, "reason": "Modern western tension from No Country"}
</examples>`;

const STORYTELLING_PROMPT = `<task>
Recommend ONE film with similar narrative structure and storytelling approach.
Focus on: pacing, plot structure, narrative techniques, directorial style, story complexity.
</task>

<reference_film>
Title: "{title}"
Year: {year}
Director: {director}
</reference_film>

<rules>
- Focus on how the story is told, not what the story is about
- Consider narrative pacing (slow-burn vs rapid)
- Think about structure (linear, non-linear, fragmented)
- Consider the director's storytelling signature
- The "reason" must reference "{title}" by name
- Keep the reason under 8 words
- Make it punchy, evocative, and immediately understandable
- Output ONLY valid JSON, no markdown blocks
</rules>

<output_format>
{"title": "Film Title", "year": "2020", "hex": "#4a5568", "score": 85, "reason": "Brief reason referencing source film"}
</output_format>

<examples>
For "Memento" (2000): {"title": "Primer", "year": "2004", "hex": "#34495e", "score": 87, "reason": "Mind-bending puzzle like Memento"}
For "Dunkirk" (2017): {"title": "1917", "year": "2019", "hex": "#5c6f7a", "score": 90, "reason": "Real-time intensity from Dunkirk"}
</examples>`;

const EMOTIONAL_PROMPT = `<task>
Recommend ONE film that evokes the same emotional experience and feeling.
Focus on: emotional tone, mood, atmosphere, how the film makes viewers feel.
</task>

<reference_film>
Title: "{title}"
Year: {year}
</reference_film>

<rules>
- Focus on the emotional journey and feeling
- Consider the atmosphere and mood
- Think about the emotional impact on viewers
- Match the intensity and type of emotion (melancholy, joy, tension, etc.)
- The "reason" must reference "{title}" by name
- Keep the reason under 8 words
- Make it punchy, evocative, and immediately understandable
- Output ONLY valid JSON, no markdown blocks
</rules>

<output_format>
{"title": "Film Title", "year": "2020", "hex": "#4a5568", "score": 85, "reason": "Brief reason referencing source film"}
</output_format>

<examples>
For "Lost in Translation" (2003): {"title": "Her", "year": "2013", "hex": "#f39c12", "score": 87, "reason": "Same lonely ache as Lost in Translation"}
For "Parasite" (2019): {"title": "Burning", "year": "2018", "hex": "#c0392b", "score": 85, "reason": "Simmering tension from Parasite"}
</examples>`;

const BATCH_ORBIT_PROMPT = `<task>
For the reference film, recommend exactly FOUR connected films, one for each dimension:
- "up": Visual match (cinematography style, color palette, lighting design, visual composition, camera work)
- "right": Balanced match (overall tone, quality, genre blend, pacing, general vibe)
- "down": Storytelling match (narrative structure, pacing, plot complexity, directorial storytelling approach)
- "left": Emotional match (same feeling, mood, atmosphere, emotional impact)
</task>

<reference_film>
Title: "{title}"
Year: {year}
Genres: {genres}
Director: {director}
</reference_film>

<rules>
- Provide exactly 4 recommendations keyed by direction: "up", "right", "down", "left"
- For each recommendation provide: title, year (4 digits), hex (dominant color #xxxxxx), score (integer 70-98), and reason
- The "reason" must reference "{title}" by name
- Keep each reason under 8 words (punchy, evocative)
- All 4 films must be different from each other and from the reference film
- Output ONLY valid JSON matching the format below, no markdown blocks
</rules>

<output_format>
{
  "up": {"title": "Film Title", "year": "2020", "hex": "#4a5568", "score": 88, "reason": "Cinematography like {title}"},
  "right": {"title": "Film Title", "year": "2019", "hex": "#3d5a80", "score": 86, "reason": "Tension and grit from {title}"},
  "down": {"title": "Film Title", "year": "2018", "hex": "#2d3561", "score": 90, "reason": "Non-linear structure like {title}"},
  "left": {"title": "Film Title", "year": "2021", "hex": "#8b6f47", "score": 87, "reason": "Same melancholic ache as {title}"}
}
</output_format>`;

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

// Ensure hex color is valid and dark enough for background atmosphere
function clampDarkHex(hex: string): string {
  let clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#1a1a2e';
  let r = parseInt(clean.slice(0, 2), 16);
  let g = parseInt(clean.slice(2, 4), 16);
  let b = parseInt(clean.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  if (max > 60) {
    const scale = 50 / max;
    r = Math.round(r * scale);
    g = Math.round(g * scale);
    b = Math.round(b * scale);
  }
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

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
  const rawHex = parsed.hex || parsed.dominant_hex_color || '#1a1a2e';
  const hexColor = clampDarkHex(rawHex);
  
  return {
    title: title,
    year: String(year),
    hex: hexColor,
    score: parsed.score || parsed.similarity_score || 75,
    reason: parsed.reason || parsed.connection_reason || 'Connected',
  };
};

// Search TMDB for movie details
const searchTMDB = async (title: string, year?: string): Promise<any | null> => {
  const startedAt = performance.now();
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
  } finally {
    recordOrbitTiming({
      phase: 'tmdb-search',
      durationMs: performance.now() - startedAt,
    });
  }
};

// Get movie details from TMDB
const getMovieDetails = async (tmdbId: number): Promise<any | null> => {
  const startedAt = performance.now();
  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    recordOrbitTiming({
      phase: 'tmdb-details',
      durationMs: performance.now() - startedAt,
    });
  }
};

// Hydrate OrbitResponse with TMDB data
const hydrateWithTMDB = async (orbitResponse: OrbitResponse): Promise<OrbitMovie | null> => {
  try {
    // Search for the movie on TMDB
    let searchResult = await searchTMDB(orbitResponse.title, orbitResponse.year);
    if (!searchResult) {
      // Try without year if first search fails
      searchResult = await searchTMDB(orbitResponse.title);
      if (!searchResult) {
        console.warn('Could not find movie on TMDB:', orbitResponse.title);
        return null;
      }
    }
    
    const tmdbData = await getMovieDetails(searchResult.id);
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
  direction: SwipeDirection,
  taste?: string | null
): Promise<{ movie: OrbitMovie; connectionReason: string; similarityScore: number } | null> => {
  const recommendationStartedAt = performance.now();
  let prompt = buildPrompt(currentMovie, direction);
  if (taste) {
    prompt += `\n<viewer_taste>\n${taste}\n</viewer_taste>\nSteer the pick toward this viewer. Do not fetch or invent their watch history.`;
  }
  
  console.log(`Orbit: Getting ${direction} recommendation for "${currentMovie.title}"`);

  let parsed: {
    title?: string;
    next_movie_title?: string;
    year: string;
    hex?: string;
    dominant_hex_color?: string;
    score?: number;
    similarity_score?: number;
    reason?: string;
    connection_reason?: string;
  } | null = null;

  const llmStartedAt = performance.now();
  try {
    parsed = await callLlmForJSON(prompt, ORBIT_SYSTEM_PROMPT, 2, {
      maxTokens: 300,
      reasoningEffort: 'low',
    });
  } catch (error) {
    console.error('Orbit: Grok call failed', error);
    return null;
  } finally {
    recordOrbitTiming({
      phase: 'llm',
      durationMs: performance.now() - llmStartedAt,
      sourceMovieId: currentMovie.id,
      direction,
    });
  }

  if (!parsed) {
    console.error('Orbit: JSON call failed after retries');
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

  recordOrbitTiming({
    phase: 'recommendation',
    durationMs: performance.now() - recommendationStartedAt,
    sourceMovieId: currentMovie.id,
    direction,
  });
  
  return {
    movie: hydratedMovie,
    connectionReason: orbitResponse.reason,
    similarityScore: orbitResponse.score,
  };
};

// Batch function to get recommendations for all 4 swipe directions in one LLM call
export const getNextMovieBatch = async (
  currentMovie: OrbitMovie,
  taste?: string | null
): Promise<Record<SwipeDirection, { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null> | null> => {
  const genres = currentMovie.genres?.join(', ') || 'Drama';
  const director = currentMovie.director || 'Unknown';
  let prompt = BATCH_ORBIT_PROMPT
    .replace(/\{title\}/g, currentMovie.title)
    .replace('{year}', currentMovie.year)
    .replace('{genres}', genres)
    .replace('{director}', director);

  if (taste) {
    prompt += `\n<viewer_taste>\n${taste}\n</viewer_taste>\nSteer the picks toward this viewer. Do not fetch or invent their watch history.`;
  }

  const llmStartedAt = performance.now();
  let parsed: Record<string, any> | null = null;
  try {
    parsed = await callLlmForJSON<Record<string, any>>(prompt, ORBIT_SYSTEM_PROMPT, 2, {
      maxTokens: 600,
      reasoningEffort: 'low',
    });
  } catch (error) {
    console.error('Orbit: Batch Grok call failed', error);
    return null;
  } finally {
    recordOrbitTiming({
      phase: 'llm',
      durationMs: performance.now() - llmStartedAt,
      sourceMovieId: currentMovie.id,
    });
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const directions: SwipeDirection[] = ['up', 'right', 'down', 'left'];
  const results = await Promise.all(
    directions.map(async (dir) => {
      const raw = parsed![dir];
      if (!raw) return null;
      const normalized = normalizeOrbitResponse(raw);
      if (!normalized) return null;
      const movie = await hydrateWithTMDB(normalized);
      if (!movie) return null;
      return {
        direction: dir,
        recommendation: {
          movie,
          connectionReason: normalized.reason,
          similarityScore: normalized.score,
        },
      };
    })
  );

  const moves: Record<SwipeDirection, { movie: OrbitMovie; connectionReason: string; similarityScore: number } | null> = {
    up: null,
    right: null,
    down: null,
    left: null,
  };

  for (const res of results) {
    if (res) {
      moves[res.direction] = res.recommendation;
    }
  }

  return moves;
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

// Extract dominant color from poster when the model hex is missing or unusable
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

