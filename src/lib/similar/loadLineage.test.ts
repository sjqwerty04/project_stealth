import { describe, expect, it } from 'vitest';
import { lineageFromCredits } from './loadLineage';

describe('lineageFromCredits', () => {
  it('dedupes, drops the source film, and keeps poster-backed titles', () => {
    const rows = lineageFromCredits(155, [
      {
        films: [
          { id: 155, title: 'The Dark Knight', poster_path: '/a.jpg', popularity: 99 },
          { id: 272, title: 'The Dark Knight Rises', poster_path: '/b.jpg', popularity: 80 },
          { id: 49026, title: 'No Poster', poster_path: null, popularity: 70 },
          { id: 272, title: 'TDKR crew', poster_path: '/b.jpg', popularity: 90 },
        ],
      },
    ]);
    expect(rows.map((r) => r.movieId)).toEqual([272]);
    expect(rows[0].source).toBe('lineage');
  });
});
