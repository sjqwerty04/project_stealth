import { describe, expect, it } from 'vitest';
import { fingerprint, fnv1a64 } from './fingerprint';
import type { TheaterFilm, TheaterSignal } from './types';

const HEAT: TheaterFilm = {
  id: 949,
  title: 'Heat',
  year: '1995',
  posterPath: '/heat.jpg',
  backdropPath: '/heat-backdrop.jpg',
  genres: ['Crime', 'Drama'],
  director: 'Michael Mann',
  mediaType: 'movie',
};
const THIEF: TheaterFilm = {
  id: 10858,
  title: 'Thief',
  year: '1981',
  posterPath: '/thief.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};

const FIXTURE: TheaterSignal[] = [
  { kind: 'query', text: 'heat', mode: 'standard', at: 0 },
  { kind: 'detail_view', film: HEAT, at: 1000 },
  { kind: 'detail_view', film: THIEF, at: 2000 },
];

describe('fnv1a64', () => {
  it('matches the published FNV-1a 64 test vectors', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
  });
});

describe('fingerprint', () => {
  it('produces the exact digest for one query plus Heat and Thief', () => {
    expect(fingerprint(FIXTURE)).toBe('a0744096085ab69b');
  });

  it('ignores title casing, year presentation, artwork, genres, and director', () => {
    const restyled: TheaterSignal[] = [
      { kind: 'query', text: '  HEAT ', mode: 'standard', at: 5 },
      {
        kind: 'detail_view',
        film: { ...HEAT, title: 'HEAT (1995)', year: '1995-12-15', posterPath: null, backdropPath: null, genres: [], director: null },
        at: 6,
      },
      { kind: 'detail_view', film: { ...THIEF, title: 'thief', year: '81', director: 'M. Mann' }, at: 7 },
    ];
    expect(fingerprint(restyled)).toBe('a0744096085ab69b');
  });

  it('ignores signal order, query mode, and dwells', () => {
    const shuffled: TheaterSignal[] = [
      { kind: 'detail_view', film: THIEF, at: 0 },
      { kind: 'dwell', filmId: 10858, ms: 20000, engaged: true },
      { kind: 'query', text: 'heat', mode: 'ai-curated', at: 1 },
      { kind: 'detail_view', film: HEAT, at: 2 },
    ];
    expect(fingerprint(shuffled)).toBe('a0744096085ab69b');
  });

  it('changes when the evidence changes', () => {
    expect(fingerprint(FIXTURE.slice(0, 2))).toBe('521f61ad8cf12167');
    expect(fingerprint([{ kind: 'query', text: 'thief', mode: 'standard', at: 0 }, ...FIXTURE.slice(1)])).toBe(
      '652c34027df49ca3',
    );
    expect(fingerprint([...FIXTURE, { kind: 'detail_view', film: { ...HEAT, mediaType: 'tv' }, at: 3 }])).toBe(
      '6f06a542de772b85',
    );
  });

  it('hashes an empty trail to a stable digest', () => {
    expect(fingerprint([])).toBe('9d73114e90492e2d');
  });
});
