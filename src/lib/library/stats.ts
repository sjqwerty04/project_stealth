import type { LibraryFilm } from './types';

export function watchedCount(films: readonly LibraryFilm[]): number {
  return films.filter((film) => film.watched).length;
}

export function walletCount(films: readonly LibraryFilm[]): number {
  return films.filter((film) => film.watched && film.verdict === 'liked').length;
}

export function savedCount(films: readonly LibraryFilm[]): number {
  return films.filter((film) => film.onWatchlist).length;
}

export function distinctWatchedInYear(films: readonly LibraryFilm[], year: string): number {
  return films.filter(
    (film) =>
      film.watched &&
      (film.lastWatchedAt?.startsWith(year) === true || film.firstWatchedAt?.startsWith(year) === true),
  ).length;
}

export function watchedFilmIds(films: readonly LibraryFilm[]): Set<number> {
  return new Set(films.filter((film) => film.watched).map((film) => film.movieId));
}
