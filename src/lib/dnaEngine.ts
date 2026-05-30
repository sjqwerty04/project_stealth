import type { DNAMovie, DNAPerson } from '../stores/dnaStore';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const yearOf = (date?: string | null): string => (date ? date.slice(0, 4) : '');

const pickEnglishLogo = (images: any): string | null => {
  const logos = images?.logos || [];
  const en = logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
  return en?.file_path || null;
};

// A movie's DNA: its display data + the cast/crew "strands" to branch into.
export const getMovieDNA = async (
  movieId: number
): Promise<{ movie: DNAMovie; people: DNAPerson[] } | null> => {
  try {
    const url = `${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const movie: DNAMovie = {
      id: data.id,
      title: data.title,
      year: yearOf(data.release_date),
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      logoPath: pickEnglishLogo(data.images),
    };

    const cast: DNAPerson[] = (data.credits?.cast || [])
      .slice(0, 10)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        profilePath: c.profile_path ?? null,
        role: c.character || undefined,
      }));

    // Key crew strands: director(s) + a few department heads.
    const keyJobs = ['Director', 'Director of Photography', 'Writer', 'Original Music Composer'];
    const seen = new Set<number>();
    const crew: DNAPerson[] = [];
    for (const job of keyJobs) {
      const person = (data.credits?.crew || []).find((c: any) => c.job === job && !seen.has(c.id));
      if (person) {
        seen.add(person.id);
        crew.push({
          id: person.id,
          name: person.name,
          profilePath: person.profile_path ?? null,
          role: person.job,
        });
      }
    }

    return { movie, people: [...crew, ...cast] };
  } catch (err) {
    console.error('getMovieDNA failed:', err);
    return null;
  }
};

// A person's films: their notable movie credits to branch into.
export const getPersonFilms = async (
  personId: number,
  excludeMovieId?: number
): Promise<{ person: DNAPerson; films: DNAMovie[] } | null> => {
  try {
    const url = `${TMDB_BASE}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=movie_credits`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const person: DNAPerson = {
      id: data.id,
      name: data.name,
      profilePath: data.profile_path ?? null,
    };

    // Merge cast + crew credits, dedupe, drop the movie we came from, sort by popularity.
    const credits = [
      ...(data.movie_credits?.cast || []),
      ...(data.movie_credits?.crew || []),
    ];
    const byId = new Map<number, any>();
    for (const c of credits) {
      if (!c.id || c.id === excludeMovieId) continue;
      if (!c.poster_path) continue; // skip obscure entries without art
      const existing = byId.get(c.id);
      if (!existing || (c.popularity || 0) > (existing.popularity || 0)) {
        byId.set(c.id, c);
      }
    }

    const films: DNAMovie[] = Array.from(byId.values())
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 12)
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        year: yearOf(c.release_date),
        posterPath: c.poster_path ?? null,
        backdropPath: c.backdrop_path ?? null,
        logoPath: null,
      }));

    return { person, films };
  } catch (err) {
    console.error('getPersonFilms failed:', err);
    return null;
  }
};
