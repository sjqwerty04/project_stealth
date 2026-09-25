export type Verdict = 'liked' | 'okay' | 'nope';

export const VERDICTS: readonly Verdict[] = ['liked', 'okay', 'nope'] as const;

export const VERDICT_LABEL: Record<Verdict, string> = {
  liked: 'Liked',
  okay: "It's okay",
  nope: 'Nope',
};

export type FilmSource =
  | 'letterboxd'
  | 'imdb'
  | 'paste'
  | 'screenshot'
  | 'manual'
  | 'calendar'
  | 'discovery'
  | 'rec';

export type MediaType = 'movie' | 'tv';

/** One doc per film per user at users/{uid}/films/{movieId}. */
export type LibraryFilm = {
  movieId: number;
  title: string;
  year?: string | number;
  poster: string;
  backdrop?: string;
  mediaType: MediaType;
  watched: boolean;
  verdict: Verdict | null;
  stars: number | null;
  hearted: boolean;
  watchCount: number;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  /** Every imported watch day, `yyyy-MM-dd`. The strip and year view read this when a calendar row was not written. */
  watchDates?: string[];
  onWatchlist: boolean;
  tags: string[];
  reviewExcerpt: string | null;
  listNames: string[];
  sources: FilmSource[];
  external: { letterboxdUri?: string; imdbId?: string };
  updatedAt: number;
};

export type LibraryFilmPatch = Partial<Omit<LibraryFilm, 'movieId' | 'updatedAt'>>;

export type BundleFilm = {
  title: string;
  year?: string;
  stars?: number;
  hearted?: boolean;
  watched?: boolean;
  imdbId?: string;
  letterboxdUri?: string;
  tags?: string[];
  review?: string;
  listNames?: string[];
  /** Number of diary entries seen for this film when a source has no dated rows. */
  watchCount?: number;
};

export type BundleDiaryRow = {
  title: string;
  year?: string;
  watchedDate: string;
  stars?: number;
  rewatch: boolean;
  tags: string[];
};

export type BundleWatchlistRow = { title: string; year?: string };

/** What every intake path produces before anything is written. */
export type ImportBundle = {
  source: FilmSource;
  films: BundleFilm[];
  diary: BundleDiaryRow[];
  watchlist: BundleWatchlistRow[];
  /** Films whose reviews the user liked. Soft curiosity signal only. */
  curious: BundleWatchlistRow[];
  meta: {
    exportedAt?: string;
    username?: string;
    filesSeen: string[];
    counts: Record<string, number>;
  };
};

export function emptyBundle(source: FilmSource): ImportBundle {
  return { source, films: [], diary: [], watchlist: [], curious: [], meta: { filesSeen: [], counts: {} } };
}
