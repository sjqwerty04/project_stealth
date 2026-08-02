import { describe, expect, it } from 'vitest';
import {
  buildImageUrl,
  formatRuntime,
  genreNames,
  imageUrlOrNull,
  normalizeMovie,
} from './tmdb';

describe('buildImageUrl', () => {
  it('builds a sized TMDB URL', () => {
    expect(buildImageUrl('/abc.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
  });

  it('defaults to w200', () => {
    expect(buildImageUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w200/abc.jpg');
  });

  it('falls back to a placeholder rather than rendering a broken image', () => {
    expect(buildImageUrl(null)).toContain('placehold.co');
    expect(buildImageUrl(undefined)).toContain('placehold.co');
    expect(buildImageUrl('')).toContain('placehold.co');
  });

  it('honours a caller-supplied fallback', () => {
    expect(buildImageUrl(null, 'w500', '')).toBe('');
  });
});

describe('imageUrlOrNull', () => {
  it('returns null when there is no path, so callers can branch', () => {
    expect(imageUrlOrNull(null)).toBeNull();
    expect(imageUrlOrNull('/a.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/a.jpg');
  });
});

describe('formatRuntime', () => {
  it('formats hours and minutes', () => {
    expect(formatRuntime(170)).toBe('2h 50m');
    expect(formatRuntime(60)).toBe('1h 0m');
    expect(formatRuntime(47)).toBe('47m');
  });

  it('degrades to a neutral label when runtime is unknown', () => {
    expect(formatRuntime(null)).toBe('Feature');
    expect(formatRuntime(undefined)).toBe('Feature');
    expect(formatRuntime(0)).toBe('Feature');
    expect(formatRuntime(-5)).toBe('Feature');
  });
});

describe('genreNames', () => {
  it('maps known ids and drops unknown ones', () => {
    expect(genreNames([28, 80, 999999])).toEqual(['Action', 'Crime']);
  });

  it('tolerates missing input', () => {
    expect(genreNames(undefined)).toEqual([]);
    expect(genreNames(null)).toEqual([]);
  });
});

describe('normalizeMovie', () => {
  it('normalises a movie search result', () => {
    expect(
      normalizeMovie({
        id: 949,
        title: 'Heat',
        release_date: '1995-12-15',
        poster_path: '/p.jpg',
        backdrop_path: '/b.jpg',
        overview: 'Cops and robbers.',
        genre_ids: [28, 80],
        vote_average: 7.9,
      })
    ).toEqual({
      id: 949,
      title: 'Heat',
      year: '1995',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      overview: 'Cops and robbers.',
      genreIds: [28, 80],
      mediaType: 'movie',
      voteAverage: 7.9,
      runtimeMinutes: null,
    });
  });

  it('reads TV naming (name / first_air_date)', () => {
    const result = normalizeMovie({ id: 1, name: 'Fargo', first_air_date: '2014-04-15' }, 'tv');
    expect(result.title).toBe('Fargo');
    expect(result.year).toBe('2014');
    expect(result.mediaType).toBe('tv');
  });

  it('reads genres from a detail payload, which uses objects not ids', () => {
    expect(normalizeMovie({ id: 1, title: 'X', genres: [{ id: 18 }, { id: 53 }] }).genreIds).toEqual([
      18, 53,
    ]);
  });

  it('survives a sparse payload without throwing', () => {
    const result = normalizeMovie({ id: 7 });
    expect(result.title).toBe('Untitled');
    expect(result.year).toBe('');
    expect(result.posterPath).toBeNull();
    expect(result.genreIds).toEqual([]);
  });
});
