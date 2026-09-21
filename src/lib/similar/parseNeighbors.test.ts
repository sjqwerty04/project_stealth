import { describe, expect, it } from 'vitest';
import { adjacencyDoc, adjacencyDocId, parseNeighbor, parseNeighbors } from './parseNeighbors';

describe('parseNeighbors', () => {
  it('keeps title-only rows so hydrate can resolve ids', () => {
    expect(parseNeighbor({ year: 1995 })).toBeNull();
    expect(parseNeighbor({ title: 'Heat', year: 1995 })).toEqual({
      movieId: 0,
      title: 'Heat',
      year: '1995',
      posterPath: null,
      reason: '',
      source: 'scholar',
      axes: [],
    });
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
        { title: 'Heat' },
        { title: 'Zodiac' },
      ],
    });
    expect(rows.map((r) => r.title)).toEqual(['A', 'B', 'Heat', 'Zodiac']);
  });

  it('marks stored docs as scholar', () => {
    const doc = adjacencyDoc(155, [{ movieId: 1, title: 'A', year: '', posterPath: null, reason: '', source: 'lineage', axes: [] }]);
    expect(doc.neighbors[0].source).toBe('scholar');
  });

  it('namespaces tv adjacency ids away from movies', () => {
    expect(adjacencyDocId(1396)).toBe('1396');
    expect(adjacencyDocId(1396, 'movie')).toBe('1396');
    expect(adjacencyDocId(1396, 'tv')).toBe('tv_1396');
  });
});
