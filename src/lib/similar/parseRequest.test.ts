import { describe, expect, it } from 'vitest';
import { parseSimilarAdjacencyRequest } from './parseRequest';

describe('parseSimilarAdjacencyRequest', () => {
  it('requires a movie id and title', () => {
    expect(parseSimilarAdjacencyRequest({})).toBeNull();
    expect(
      parseSimilarAdjacencyRequest({
        movieId: '155',
        title: ' The Dark Knight ',
        year: 2008,
        genres: ['Action', 1, 'Crime'],
      }),
    ).toEqual({
      movieId: 155,
      title: 'The Dark Knight',
      year: '2008',
      genres: ['Action', 'Crime'],
    });
  });
});
