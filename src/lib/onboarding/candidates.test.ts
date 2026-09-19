import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCandidateCache,
  facetOverlap,
  getCandidates,
  rankCandidates,
  tmdbResultToFilm,
  type Candidate,
} from './candidates';
import type { FilmPick } from './state';

const pick: FilmPick = { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg', genreIds: [28, 80, 18] };

function cand(id: number, year: string, genreIds: number[], voteCount: number, posterPath: string | null = `/p${id}.jpg`): Candidate {
  return { id, title: `Film ${id}`, year, posterPath, genreIds, voteCount, popularity: 0 };
}

describe('rankCandidates', () => {
  it('orders by shared genres, decade proximity, then vote count, with id as tiebreak', () => {
    const pool: Candidate[] = [
      cand(5, '2010', [35], 10), // no overlap, far decade: ~0.52
      cand(4, '1994', [80], 100), // 3 + 2 + 1 + 1.002 = 7.00
      cand(2, '1997', [28, 80], 1000), // 6 + 2 + 1 + 1.5 = 10.5
      cand(3, '2001', [28, 80], 1000), // 6 + 0 + 1 + 1.5 = 8.5
      cand(1, '1997', [28, 80], 1000), // ties with 2 on score, lower id wins
      cand(9, '1995', [28, 80, 18], 5000, null), // no poster: dropped
      cand(7, '1995', [28], 100), // excluded by id
      cand(949, '1995', [28, 80, 18], 5000), // the pick itself: dropped
    ];
    const ranked = rankCandidates(pick, pool, new Set([7]));
    expect(ranked.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('dedupes repeated ids in the pool', () => {
    const pool = [cand(1, '1995', [28], 10), cand(1, '1995', [28], 10)];
    expect(rankCandidates(pick, pool, new Set())).toHaveLength(1);
  });
});

describe('facetOverlap', () => {
  it('counts shared genres and decade proximity', () => {
    expect(facetOverlap(pick, cand(1, '2001', [80, 18], 0))).toEqual({ sharedGenres: 2, sameDecade: false, nearDecade: true });
    expect(facetOverlap(pick, cand(1, '', [80], 0))).toEqual({ sharedGenres: 1, sameDecade: false, nearDecade: false });
  });
});

describe('tmdbResultToFilm', () => {
  it('maps TMDB list and detail shapes', () => {
    expect(
      tmdbResultToFilm({ id: 1, title: 'A', release_date: '1999-10-15', poster_path: '/a.jpg', genre_ids: [1, 2], vote_count: 12 }),
    ).toEqual({ id: 1, title: 'A', year: '1999', posterPath: '/a.jpg', genreIds: [1, 2], voteCount: 12, popularity: 0 });
    expect(tmdbResultToFilm({ id: 2, name: 'B', genres: [{ id: 5 }, { id: 6 }] })).toMatchObject({
      title: 'B',
      year: '',
      posterPath: null,
      genreIds: [5, 6],
    });
    expect(tmdbResultToFilm(null).title).toBe('Unknown');
  });
});

describe('getCandidates', () => {
  beforeEach(() => clearCandidateCache());

  function fakeFetch() {
    const rec = {
      results: [
        { id: 10, title: 'Rec A', release_date: '1995-01-01', poster_path: '/10.jpg', genre_ids: [28, 80], vote_count: 500 },
        { id: 11, title: 'Rec B', release_date: '1996-01-01', poster_path: '/11.jpg', genre_ids: [28], vote_count: 500 },
        { id: 12, title: 'Excluded', release_date: '1995-01-01', poster_path: '/12.jpg', genre_ids: [28, 80, 18], vote_count: 9000 },
      ],
    };
    const sim = {
      results: [
        { id: 10, title: 'Rec A again', release_date: '1995-01-01', poster_path: '/10.jpg', genre_ids: [28, 80], vote_count: 500 },
        { id: 13, title: 'No poster', release_date: '1995-01-01', poster_path: null, genre_ids: [28, 80, 18], vote_count: 9000 },
        { id: 14, title: 'Sim C', release_date: '2015-01-01', poster_path: '/14.jpg', genre_ids: [35], vote_count: 5 },
      ],
    };
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/recommendations') ? rec : url.includes('/similar') ? sim : { results: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
  }

  it('merges both endpoints, dedupes, excludes, ranks, and caches per pick id', async () => {
    const f = fakeFetch();
    const first = await getCandidates(pick, new Set([12]), f as unknown as typeof fetch);
    expect(first.map((c) => c.id)).toEqual([10, 11, 14]);
    expect(first[0]).toEqual({ id: 10, title: 'Rec A', year: '1995', posterPath: '/10.jpg', genreIds: [28, 80] });
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual([
      expect.stringContaining('/movie/949/recommendations'),
      expect.stringContaining('/movie/949/similar'),
    ]);

    const second = await getCandidates(pick, new Set([12, 10]), f as unknown as typeof fetch);
    expect(second.map((c) => c.id)).toEqual([11, 14]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('fetches genre ids once when the pick has none', async () => {
    const f = fakeFetch();
    f.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/\/movie\/949\?/.test(url)) {
        return new Response(JSON.stringify({ id: 949, genres: [{ id: 35 }] }), { status: 200 });
      }
      const body = url.includes('/recommendations')
        ? { results: [{ id: 14, title: 'Comedy', release_date: '1995-01-01', poster_path: '/14.jpg', genre_ids: [35], vote_count: 5 }] }
        : { results: [{ id: 10, title: 'Action', release_date: '1995-01-01', poster_path: '/10.jpg', genre_ids: [28], vote_count: 5 }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const bare: FilmPick = { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg' };
    const out = await getCandidates(bare, new Set(), f as unknown as typeof fetch);
    expect(out.map((c) => c.id)).toEqual([14, 10]);
    expect(f).toHaveBeenCalledTimes(3);
    await getCandidates(bare, new Set(), f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('returns an empty array when the network fails', async () => {
    const f = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(getCandidates(pick, new Set(), f as unknown as typeof fetch)).resolves.toEqual([]);
  });
});
