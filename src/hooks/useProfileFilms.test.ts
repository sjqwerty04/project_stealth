import { describe, expect, it } from 'vitest';
import { profileFilms } from './useProfileFilms';

describe('profileFilms', () => {
  it('turns onboarding picks into poster candidates', () => {
    expect(
      profileFilms({
        favoriteFilms: [
          { id: 155, title: 'The Dark Knight', posterPath: '/qJ2tW6.jpg' },
          { id: 1124, title: 'The Prestige', poster: 'https://cdn/prestige.jpg' },
        ],
        dislikedFilms: [{ id: 1, title: 'Transformers', posterPath: '/tf.jpg' }],
      }),
    ).toEqual([
      { title: 'The Dark Knight', poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6.jpg', movieId: 155, mediaType: 'movie' },
      { title: 'The Prestige', poster: 'https://cdn/prestige.jpg', movieId: 1124, mediaType: 'movie' },
      { title: 'Transformers', poster: 'https://image.tmdb.org/t/p/w500/tf.jpg', movieId: 1, mediaType: 'movie' },
    ]);
  });

  it('skips picks with no poster and malformed docs', () => {
    expect(profileFilms({ favoriteFilms: [{ id: 3, title: 'No Art' }] })).toEqual([]);
    expect(profileFilms({ favoriteFilms: 'nope' })).toEqual([]);
    expect(profileFilms(null)).toEqual([]);
  });
});
