const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TMDBFilm {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  vote_average: number;
}

export function getImageUrl(
  path: string,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w500"
): string {
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function searchFilms(query: string): Promise<TMDBFilm[]> {
  const res = await fetch(
    `${TMDB_BASE}/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
  );
  const data = await res.json();
  return data.results || [];
}

export async function getFilmStills(filmId: number): Promise<TMDBImage[]> {
  const res = await fetch(
    `${TMDB_BASE}/movie/${filmId}/images?api_key=${process.env.TMDB_API_KEY}`
  );
  const data = await res.json();
  return data.backdrops || [];
}

export async function getTrendingFilms(
  region?: string
): Promise<TMDBFilm[]> {
  const regionParam = region ? `&region=${region}` : "";
  const res = await fetch(
    `${TMDB_BASE}/trending/movie/week?api_key=${process.env.TMDB_API_KEY}&language=en-US${regionParam}`
  );
  const data = await res.json();
  return data.results || [];
}

export async function getPopularFilms(page = 1): Promise<TMDBFilm[]> {
  const res = await fetch(
    `${TMDB_BASE}/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=${page}`
  );
  const data = await res.json();
  return data.results || [];
}

export async function getTopRatedFilms(): Promise<TMDBFilm[]> {
  const res = await fetch(
    `${TMDB_BASE}/movie/top_rated?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1`
  );
  const data = await res.json();
  return data.results || [];
}

export async function getFilmVideos(
  filmId: number
): Promise<{ key: string; site: string; type: string; name: string }[]> {
  const res = await fetch(
    `${TMDB_BASE}/movie/${filmId}/videos?api_key=${process.env.TMDB_API_KEY}`
  );
  const data = await res.json();
  return data.results || [];
}

// Region mapping for dynamic content
export const REGION_FILM_LISTS: Record<string, number[]> = {
  // Curated film IDs by region (TMDB IDs)
  default: [
    550, 680, 13, 120, 155, 278, 238, 424, 497, 769, // Fight Club, Pulp Fiction, Forrest Gump, LOTR, Dark Knight, Shawshank, Godfather, Schindler, Green Book, Tenet
    372058, 346364, 264660, 378064, 466272, // Your Name, It, Ex Machina, A Ghost Story, Minari
  ],
  IN: [
    19404, 20453, 588228, 614917, 398818, // Dilwale, Lagaan, The White Tiger, Gully Boy, Call Me By Your Name
  ],
  KR: [
    496243, 577922, 664767, 539681, 497698, // Parasite, Tenet, Minari, Jo Jo Rabbit, Oldboy
  ],
  JP: [
    129, 372058, 508442, 4935, 149, // Spirited Away, Your Name, Soul, Howl, Akira
  ],
};
