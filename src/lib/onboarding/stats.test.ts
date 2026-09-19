import { describe, expect, it } from 'vitest';
import type { FilmPick } from './state';
import { computeFacetWeights, computeTasteStats, filmFromDoc, nightFromDoc, posterUrlsFor, type StatsFilm, type StatsInput } from './stats';

const pick = (id: number, title = `Film ${id}`): FilmPick => ({ id, title, year: '1999', posterPath: null });

function film(over: Partial<StatsFilm> & { movieId: number }): StatsFilm {
  return {
    title: `Film ${over.movieId}`,
    year: '1999',
    poster: `/p${over.movieId}.jpg`,
    stars: null,
    watchCount: 1,
    watched: true,
    firstWatchedAt: null,
    ...over,
  };
}

function input(over: Partial<StatsInput> = {}): StatsInput {
  return {
    films: [],
    nights: [],
    positive: [],
    negative: [],
    axes: [],
    sources: [],
    uid: 'u1',
    ...over,
  };
}

describe('computeTasteStats', () => {
  it('handles the empty library without nulls where numbers are expected', () => {
    const s = computeTasteStats(input(), '#3A6E85', 0);
    expect(s.filmsRead).toBe(0);
    expect(s.nights).toBe(0);
    expect(s.hours).toBe(0);
    expect(s.lateNightPct).toBeNull();
    expect(s.rewatchOfFiveStarPct).toBeNull();
    expect(s.fiveStarCount).toBe(0);
    expect(s.topDecades).toEqual([]);
    expect(s.topPeople).toEqual([]);
    expect(s.topGenres).toEqual([]);
    expect(s.colourHex).toBe('#3A6E85');
    expect(s.postersSampled).toBe(0);
    expect(s.graphSeed).toMatch(/^[0-9a-f]{8}$/);
  });

  it('counts only watched films and sums runtime with a 105 minute default', () => {
    const s = computeTasteStats(
      input({
        films: [
          film({ movieId: 1, runtime: 120 }),
          film({ movieId: 2 }),
          film({ movieId: 3, watched: false, runtime: 999 }),
        ],
      }),
      '#000000',
      2,
    );
    expect(s.filmsRead).toBe(2);
    expect(s.hours).toBe(3.75);
  });

  it('computes late night share from timed nights only', () => {
    const s = computeTasteStats(
      input({
        nights: [
          { date: '2024-01-01', time: '22:00' },
          { date: '2024-01-02', time: '23:35' },
          { date: '2024-01-03', time: '19:10' },
          { date: '2024-01-04', time: null },
          { date: '2024-01-05' },
        ],
      }),
      '#000000',
      0,
    );
    expect(s.nights).toBe(5);
    expect(s.lateNightPct).toBeCloseTo(66.67, 2);
    const none = computeTasteStats(input({ nights: [{ date: '2024-01-01' }] }), '#000000', 0);
    expect(none.lateNightPct).toBeNull();
  });

  it('computes rewatch share of five star films', () => {
    const s = computeTasteStats(
      input({
        films: [
          film({ movieId: 1, stars: 5, watchCount: 3 }),
          film({ movieId: 2, stars: 5, watchCount: 1 }),
          film({ movieId: 3, stars: 4, watchCount: 5 }),
          film({ movieId: 4, stars: 5, watchCount: 2, watched: false }),
        ],
      }),
      '#000000',
      0,
    );
    expect(s.fiveStarCount).toBe(3);
    expect(s.rewatchOfFiveStarPct).toBeCloseTo(66.67, 2);
  });

  it('ranks decades, people and genres with a stable tie break', () => {
    const s = computeTasteStats(
      input({
        films: [
          film({ movieId: 1, year: '1994', people: ['Lynch', 'Deakins'], genres: ['Drama'] }),
          film({ movieId: 2, year: 1999, people: ['Lynch'], genres: ['Drama', 'Crime'] }),
          film({ movieId: 3, year: '2007', people: ['Coen'], genres: ['Crime'] }),
          film({ movieId: 4, year: '2019', genres: ['Horror'] }),
          film({ movieId: 5, year: '2011', genres: ['Sci-Fi'] }),
          film({ movieId: 6, year: 'n/a' }),
        ],
      }),
      '#000000',
      0,
    );
    expect(s.topDecades).toEqual([
      ['1990', 2],
      ['2010', 2],
      ['2000', 1],
    ]);
    expect(s.topPeople).toEqual([
      ['Lynch', 2],
      ['Coen', 1],
      ['Deakins', 1],
    ]);
    expect(s.topGenres).toEqual([
      ['Crime', 2],
      ['Drama', 2],
      ['Horror', 1],
    ]);
  });

  it('carries picks, axes and sources through as strings', () => {
    const s = computeTasteStats(
      input({
        positive: [pick(1, 'Heat'), pick(2, 'Ran')],
        negative: [pick(3, 'Crash')],
        axes: ['story', 'mood'],
        sources: ['letterboxd', 'notes'],
      }),
      '#ABCDEF',
      12,
    );
    expect(s.positive).toEqual(['Heat', 'Ran']);
    expect(s.negative).toEqual(['Crash']);
    expect(s.axes).toEqual(['story', 'mood']);
    expect(s.sources).toEqual(['letterboxd', 'notes']);
    expect(s.postersSampled).toBe(12);
  });

  it('is deterministic and keys the graph seed off uid, picks and weights only', () => {
    const base = input({ positive: [pick(1), pick(2)], negative: [pick(3)], axes: ['visual'] });
    const a = computeTasteStats(base, '#000000', 0);
    const b = computeTasteStats({ ...base, positive: [pick(2), pick(1)] }, '#FFFFFF', 99);
    expect(a.graphSeed).toBe(b.graphSeed);
    expect(a).toEqual(computeTasteStats(base, '#000000', 0));
    const c = computeTasteStats({ ...base, uid: 'u2' }, '#000000', 0);
    const d = computeTasteStats({ ...base, negative: [] }, '#000000', 0);
    expect(c.graphSeed).not.toBe(a.graphSeed);
    expect(d.graphSeed).not.toBe(a.graphSeed);
  });
});

describe('computeFacetWeights', () => {
  it('starts every facet at 1', () => {
    expect(computeFacetWeights({ positive: [], negative: [], axes: [] })).toEqual({
      look: 1,
      tempo: 1,
      weather: 1,
      world: 1,
      shape: 1,
      format: 1,
    });
  });

  it('applies axis and pick adjustments', () => {
    const w = computeFacetWeights({
      positive: [pick(1), pick(2), pick(3)],
      negative: [pick(4), pick(5)],
      axes: ['story', 'visual', 'mood', 'unknown'],
    });
    expect(w).toEqual({
      look: 2.25,
      tempo: 1.5,
      weather: 2,
      world: 1.75,
      shape: 1.2,
      format: 1.5,
    });
  });

  it('never drops shape below 0.2', () => {
    const negative = Array.from({ length: 20 }, (_, i) => pick(i));
    expect(computeFacetWeights({ positive: [], negative, axes: [] }).shape).toBe(0.2);
  });
});

describe('doc mappers', () => {
  it('maps a films doc defensively', () => {
    const f = filmFromDoc({ title: 'Heat', year: 1995, poster: '/h.jpg', stars: 5, watchCount: 2, watched: true }, '949');
    expect(f).toMatchObject({ movieId: 949, title: 'Heat', year: 1995, stars: 5, watchCount: 2, watched: true });
    expect(filmFromDoc({}, 'abc').movieId).toBe(0);
  });

  it('maps calendar rows, pulling a clock from ISO dates and skipping planned rows', () => {
    expect(nightFromDoc({ date: '2024-05-01', movieId: 1 })).toEqual({ date: '2024-05-01', time: null, movieId: 1 });
    expect(nightFromDoc({ date: '2024-05-01T22:35:00Z' })?.time).toBe('22:35');
    expect(nightFromDoc({ date: '2024-05-01', time: '21:00' })?.time).toBe('21:00');
    expect(nightFromDoc({ date: '2024-05-01', status: 'planned' })).toBeNull();
    expect(nightFromDoc({})).toBeNull();
  });
});

describe('posterUrlsFor', () => {
  it('dedupes, skips unwatched and expands TMDB paths', () => {
    const urls = posterUrlsFor(
      input({
        films: [
          film({ movieId: 1, poster: '/a.jpg' }),
          film({ movieId: 2, poster: '/a.jpg' }),
          film({ movieId: 3, poster: 'https://cdn/x.jpg' }),
          film({ movieId: 4, poster: '' }),
          film({ movieId: 5, poster: '/b.jpg', watched: false }),
        ],
      }),
    );
    expect(urls).toEqual(['https://image.tmdb.org/t/p/w200/a.jpg', 'https://cdn/x.jpg']);
  });
});
