import { describe, expect, it } from 'vitest';
import { appendSignal, filmsOf, gateOpen, normalizeQuery, queriesOf, waitRemaining } from './gate';
import type { QueryMode, TheaterFilm, TheaterSignal } from './types';

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

const COLLATERAL: TheaterFilm = {
  id: 1538,
  title: 'Collateral',
  year: '2004',
  posterPath: '/collateral.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};

const query = (text: string, at: number, mode: QueryMode = 'standard'): TheaterSignal => ({ kind: 'query', text, mode, at });
const view = (film: TheaterFilm, at: number): TheaterSignal => ({ kind: 'detail_view', film, at });

function collect(...signals: TheaterSignal[]): TheaterSignal[] {
  return signals.reduce<TheaterSignal[]>((acc, signal) => appendSignal(acc, signal) ?? acc, []);
}

describe('gateOpen', () => {
  it('opens on three unique films', () => {
    expect(gateOpen(collect(view(HEAT, 0), view(THIEF, 1), view(COLLATERAL, 2)))).toBe(true);
  });

  it('stays closed on two unique queries', () => {
    expect(gateOpen(collect(query('heat', 0), query('thief', 1)))).toBe(false);
  });

  it('stays closed on two unique films', () => {
    expect(gateOpen(collect(view(HEAT, 0), view(THIEF, 1)))).toBe(false);
  });

  it('stays closed on a hunt query plus one film', () => {
    expect(gateOpen(collect(query('heat', 0), view(THIEF, 1)))).toBe(false);
  });

  it('stays closed on a single AI-curated query', () => {
    expect(gateOpen(collect(query('men who are good at their jobs and lose anyway', 0, 'ai-curated')))).toBe(false);
  });

  it('stays closed on nothing, one plain query, or one film', () => {
    expect(gateOpen([])).toBe(false);
    expect(gateOpen(collect(query('heat', 0)))).toBe(false);
    expect(gateOpen(collect(view(HEAT, 0)))).toBe(false);
  });

  it('does not count a dwell as evidence', () => {
    expect(gateOpen(collect(view(HEAT, 0), view(THIEF, 1), { kind: 'dwell', filmId: 949, ms: 15000, engaged: true }))).toBe(false);
  });
});

describe('appendSignal', () => {
  it('replaces "heat" with "heat night" as one committed query', () => {
    const signals = collect(query('heat', 0), query('heat night', 800));
    expect(signals).toEqual([query('heat night', 800)]);
    expect(queriesOf(signals).map((q) => q.text)).toEqual(['heat night']);
  });

  it('replaces a query the person shortened back to its prefix', () => {
    expect(collect(query('heat night', 0), query('heat', 900))).toEqual([query('heat', 900)]);
  });

  it('keeps the film between two refinements and still collapses them', () => {
    const signals = collect(query('heat', 0), view(THIEF, 400), query('heat night', 800));
    expect(signals).toEqual([query('heat night', 800), view(THIEF, 400)]);
  });

  it('ignores an identical query, casing and spacing aside', () => {
    const once = collect(query('heat', 0));
    expect(appendSignal(once, query('  HEAT ', 500))).toBeNull();
    expect(appendSignal(once, query('   ', 500))).toBeNull();
  });

  it('ignores a query already committed earlier in the trail', () => {
    const signals = collect(query('heat', 0), query('thief', 1));
    expect(appendSignal(signals, query('heat', 2))).toBeNull();
  });

  it('keeps a duplicate film landing as one unique film', () => {
    const once = collect(view(HEAT, 0));
    expect(appendSignal(once, view({ ...HEAT, title: 'HEAT', posterPath: null }, 700))).toBeNull();
    expect(filmsOf(once)).toEqual([HEAT]);
  });

  it('treats the same id under a different media type as a different film', () => {
    const signals = collect(view(HEAT, 0), view({ ...HEAT, mediaType: 'tv' }, 1));
    expect(filmsOf(signals)).toHaveLength(2);
  });

  it('appends every dwell', () => {
    const dwell: TheaterSignal = { kind: 'dwell', filmId: 949, ms: 4000, engaged: false };
    expect(collect(view(HEAT, 0), dwell, dwell)).toEqual([view(HEAT, 0), dwell, dwell]);
  });
});

describe('waitRemaining', () => {
  it('counts down 2500 ms from the last new signal and clamps at zero', () => {
    expect(waitRemaining(1000, 1000)).toBe(2500);
    expect(waitRemaining(1000, 3499)).toBe(1);
    expect(waitRemaining(1000, 3500)).toBe(0);
    expect(waitRemaining(1000, 90000)).toBe(0);
  });
});

describe('normalizeQuery', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeQuery('  Heat   Night ')).toBe('heat night');
  });
});
