import { useState, useCallback } from 'react';
import { callClaude } from '../lib/claude';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export type MovieRatings = {
  imdb: string | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
  letterboxd: string | null;
  imdbId: string | null;
};

export type TechSpecs = {
  certification: string | null; // R, PG-13, PG, G, NC-17, TV-MA, etc.
  isImax: boolean;
  isDolbyAtmos: boolean;
  isDolbyVision: boolean;
};

export type MovieDetails = {
  id: number;
  title: string;
  year: string;
  runtime: string;
  posterPath: string | null;
  backdropPath: string | null;
  logoPath: string | null;
  genres: string[];
  overview: string;
  tagline: string;
  voteAverage: number;
  voteCount: number;
  director: string | null;
  cast: { id: number; name: string; character: string; profilePath: string | null }[];
  trailer: { key: string; site: string; name: string } | null;
  // Best clip for the hero — prefers an official Clip/Featurette (a real scene) over the trailer.
  heroVideo: { key: string; site: string; name: string; type: string } | null;
  watchProviders: {
    flatrate: { name: string; logoPath: string }[];
    rent: { name: string; logoPath: string }[];
    buy: { name: string; logoPath: string }[];
  } | null;
  vibeDescription: string | null;
  ratings: MovieRatings | null;
  techSpecs: TechSpecs | null;
  mediaType: 'movie' | 'tv';
};

const formatRuntime = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

// Fetch IMAX/Dolby info from IMDb technical specs via our API
async function fetchIMDbTechSpecs(imdbId: string): Promise<{ isImax: boolean; isDolbyAtmos: boolean; isDolbyVision: boolean }> {
  try {
    const response = await fetch(`/api/imdb-techspecs?imdbId=${imdbId}`);
    if (!response.ok) {
      console.warn('Failed to fetch IMDb tech specs:', response.status);
      return { isImax: false, isDolbyAtmos: false, isDolbyVision: false };
    }
    const data = await response.json();
    return {
      isImax: data.isImax || false,
      isDolbyAtmos: data.isDolbyAtmos || false,
      isDolbyVision: data.isDolbyVision || false,
    };
  } catch (err) {
    console.warn('Error fetching IMDb tech specs:', err);
    return { isImax: false, isDolbyAtmos: false, isDolbyVision: false };
  }
}

export function useMovieDetails() {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVibe, setIsLoadingVibe] = useState(false);

  const fetchDetails = useCallback(async (movieId: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<MovieDetails | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
      
      // Fetch main details, credits, videos, watch providers, images, and external IDs in parallel
      const [detailsRes, creditsRes, videosRes, providersRes, imagesRes, externalIdsRes] = await Promise.all([
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`),
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}/credits?api_key=${TMDB_API_KEY}`),
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}/videos?api_key=${TMDB_API_KEY}`),
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`),
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}/images?api_key=${TMDB_API_KEY}`),
        fetch(`${TMDB_BASE}/${endpoint}/${movieId}/external_ids?api_key=${TMDB_API_KEY}`),
      ]);

      if (!detailsRes.ok) {
        throw new Error('Failed to fetch movie details');
      }

      const [detailsData, creditsData, videosData, providersData, imagesData, externalIdsData] = await Promise.all([
        detailsRes.json(),
        creditsRes.ok ? creditsRes.json() : { crew: [], cast: [] },
        videosRes.ok ? videosRes.json() : { results: [] },
        providersRes.ok ? providersRes.json() : { results: {} },
        imagesRes.ok ? imagesRes.json() : { logos: [] },
        externalIdsRes.ok ? externalIdsRes.json() : { imdb_id: null },
      ]);

      // Find director (for movies) or creator (for TV)
      let director: string | null = null;
      if (mediaType === 'movie') {
        const directorCredit = creditsData.crew?.find((c: any) => c.job === 'Director');
        director = directorCredit?.name || null;
      } else {
        director = detailsData.created_by?.[0]?.name || null;
      }

      // Get top cast
      const cast = (creditsData.cast || []).slice(0, 6).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      }));

      // Find trailer (prefer official YouTube trailers)
      const videos = videosData.results || [];
      const trailer = videos.find((v: any) =>
        v.type === 'Trailer' && v.site === 'YouTube' && v.official
      ) || videos.find((v: any) =>
        v.type === 'Trailer' && v.site === 'YouTube'
      ) || null;

      // Pick the best hero video: an actual scene clip beats a "preview audiences" trailer.
      // Preference: official Clip > Clip > official Featurette > Featurette > Trailer > Teaser.
      const ytVideos = videos.filter((v: any) => v.site === 'YouTube');
      const heroPriority = ['Clip', 'Featurette', 'Trailer', 'Teaser'];
      const pickHero = () => {
        for (const type of heroPriority) {
          const official = ytVideos.find((v: any) => v.type === type && v.official);
          if (official) return official;
          const any = ytVideos.find((v: any) => v.type === type);
          if (any) return any;
        }
        return ytVideos[0] || null;
      };
      const heroVideoRaw = pickHero();
      const heroVideo = heroVideoRaw
        ? { key: heroVideoRaw.key, site: heroVideoRaw.site, name: heroVideoRaw.name, type: heroVideoRaw.type }
        : null;

      // Get US watch providers
      const usProviders = providersData.results?.US;
      const watchProviders = usProviders ? {
        flatrate: (usProviders.flatrate || []).slice(0, 4).map((p: any) => ({
          name: p.provider_name,
          logoPath: p.logo_path,
        })),
        rent: (usProviders.rent || []).slice(0, 4).map((p: any) => ({
          name: p.provider_name,
          logoPath: p.logo_path,
        })),
        buy: (usProviders.buy || []).slice(0, 4).map((p: any) => ({
          name: p.provider_name,
          logoPath: p.logo_path,
        })),
      } : null;

      // Find English logo (prefer PNG for transparency)
      const logos = imagesData.logos || [];
      const englishLogo = logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
      const logoPath = englishLogo?.file_path || null;

      // Fetch ratings and certification from OMDb if we have an IMDb ID
      let ratings: MovieRatings | null = null;
      let certification: string | null = null;
      const imdbId = externalIdsData.imdb_id;
      
      if (imdbId && OMDB_API_KEY && OMDB_API_KEY !== 'placeholder_get_from_omdbapi_com') {
        try {
          const omdbRes = await fetch(
            `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`
          );
          
          if (omdbRes.ok) {
            const omdbData = await omdbRes.json();
            
            // Parse ratings
            const imdbRating = omdbData.imdbRating && omdbData.imdbRating !== 'N/A' 
              ? omdbData.imdbRating 
              : null;
            
            const metacriticRating = omdbData.Metascore && omdbData.Metascore !== 'N/A'
              ? omdbData.Metascore
              : null;
            
            // Find Rotten Tomatoes from Ratings array
            let rtRating: string | null = null;
            if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
              const rtEntry = omdbData.Ratings.find((r: any) => r.Source === 'Rotten Tomatoes');
              if (rtEntry && rtEntry.Value) {
                rtRating = rtEntry.Value; // Already includes % sign
              }
            }
            
            ratings = {
              imdb: imdbRating,
              rottenTomatoes: rtRating,
              metacritic: metacriticRating,
              letterboxd: null, // fetched lazily via api/letterboxd-rating
              imdbId: imdbId || null,
            };

            // Extract certification (Rated field: R, PG-13, PG, G, NC-17, TV-MA, etc.)
            if (omdbData.Rated && omdbData.Rated !== 'N/A' && omdbData.Rated !== 'Not Rated') {
              certification = omdbData.Rated;
            }
          }
        } catch (err) {
          console.error('Failed to fetch OMDb ratings:', err);
          // Continue without ratings if OMDb fails
        }
      } else if (!imdbId) {
        console.warn('No IMDb ID found for this movie');
      } else if (!OMDB_API_KEY || OMDB_API_KEY === 'placeholder_get_from_omdbapi_com') {
        console.warn('OMDb API key not configured');
      }

      // Build initial tech specs with certification (IMAX/Dolby will be loaded async)
      let techSpecs: TechSpecs = {
        certification,
        isImax: false,
        isDolbyAtmos: false,
        isDolbyVision: false,
      };

      // Start fetching IMDb tech specs in background (don't block page load)
      const imdbTechPromise = imdbId ? fetchIMDbTechSpecs(imdbId) : Promise.resolve(null);

      // System prompt for vibe descriptions
      const vibeSystemPrompt = `You are a snarky film critic writing for Letterboxd. Your specialty is writing witty, oversimplified plot synopses that capture the essence of films in a humorous way. You never spoil anything.`;
      
      // Generate AI vibe description - smirky synopsis style using Claude's XML structure
      const genreList = detailsData.genres?.map((g: any) => g.name).join(', ') || 'film';
      const vibePrompt = `<task>
Write a smirky, oversimplified plot synopsis for this film.
</task>

<film>
Title: "${detailsData.title || detailsData.name}"
Year: ${detailsData.release_date?.slice(0, 4) || detailsData.first_air_date?.slice(0, 4)}
Genres: ${genreList}
</film>

<rules>
- Maximum 2 short sentences
- Be witty and specific, not generic
- Oversimplify the plot humorously
- ABSOLUTELY NO spoilers
- Channel Letterboxd energy
</rules>

<examples>
"Rich people problems get violent. Oscars ensue."
"Sad robot learns to feel. You will too."
"Heist goes wrong. Cool guys walk slow."
</examples>`;

      // Start fetching vibe description in background (don't block page load)
      const vibePromise = callClaude(vibePrompt, vibeSystemPrompt);

      // Build movie details immediately (without waiting for AI)
      const movieDetails: MovieDetails = {
        id: detailsData.id,
        title: detailsData.title || detailsData.name,
        year: (detailsData.release_date || detailsData.first_air_date)?.slice(0, 4) || '',
        runtime: mediaType === 'movie' 
          ? formatRuntime(detailsData.runtime)
          : detailsData.episode_run_time?.[0] ? `${detailsData.episode_run_time[0]}m/ep` : '',
        posterPath: detailsData.poster_path,
        backdropPath: detailsData.backdrop_path,
        logoPath,
        genres: detailsData.genres?.map((g: any) => g.name) || [],
        overview: detailsData.overview || '',
        tagline: detailsData.tagline || '',
        voteAverage: detailsData.vote_average || 0,
        voteCount: detailsData.vote_count || 0,
        director,
        cast,
        trailer: trailer ? { key: trailer.key, site: trailer.site, name: trailer.name } : null,
        heroVideo,
        watchProviders,
        vibeDescription: null, // Will be loaded async
        ratings,
        techSpecs,
        mediaType,
      };

      // Set details immediately so page renders fast
      setDetails(movieDetails);
      
      // Then update with vibe description when ready
      setIsLoadingVibe(true);
      vibePromise.then(vibeDescription => {
        if (vibeDescription) {
          setDetails(prev => prev ? { ...prev, vibeDescription: vibeDescription.trim() } : null);
        }
        setIsLoadingVibe(false);
      }).catch(() => setIsLoadingVibe(false));

      // Update with IMDb tech specs (IMAX/Dolby) when ready
      imdbTechPromise.then(imdbTech => {
        if (imdbTech) {
          setDetails(prev => prev ? {
            ...prev,
            techSpecs: {
              ...prev.techSpecs!,
              isImax: imdbTech.isImax,
              isDolbyAtmos: imdbTech.isDolbyAtmos,
              isDolbyVision: imdbTech.isDolbyVision,
            }
          } : null);
        }
      }).catch(err => console.warn('Failed to load IMDb tech specs:', err));

      return movieDetails;
    } catch (err) {
      console.error('Failed to fetch movie details:', err);
      setError('Failed to load movie details');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
    setError(null);
  }, []);

  return {
    details,
    isLoading,
    isLoadingVibe,
    error,
    fetchDetails,
    clearDetails,
  };
}

