import { describe, expect, it } from 'vitest';
import { adjacencyDoc, parseNeighbor, parseNeighbors } from './parseNeighbors';

describe('parseNeighbors', () => {
  it('requires a numeric id and a title', () => {
    expect(parseNeighbor({ title: 'Heat' })).toBeNull();
    expect(parseNeighbor({ movieId: 949, title: 'Heat', year: 1995, axes: ['story', 'nope'] })).toEqual({
      movieId: 949,
      title: 'Heat',
      year: '1995',
      posterPath: null,
      reason: '',
      source: 'scholar',
      axes: ['story'],
    });
  });

  it('caps and dedupes', () => {
    const rows = parseNeighbors({
      neighbors: [
        { movieId: 1, title: 'A' },
        { id: '1', title: 'A again' },
        { movieId: 2, title: 'B' },
      ],
    });
    expect(rows.map((r) => r.movieId)).toEqual([1, 2]);
  });

  it('marks stored docs as scholar', () => {
    const doc = adjacencyDoc(155, [{ movieId: 1, title: 'A', year: '', posterPath: null, reason: '', source: 'lineage', axes: [] }]);
    expect(doc.neighbors[0].source).toBe('scholar');
  });
});
