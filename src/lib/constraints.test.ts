import { describe, expect, it } from 'vitest';
import {
  constraintKey,
  DEFAULT_CONSTRAINTS,
  fitScore,
  fitsRuntime,
  MAX_PICKS,
  parseConstraintKey,
  selectPicks,
  type Candidate,
  type Constraints,
} from './constraints';

const candidate = (over: Partial<Candidate> & { movieId: number }): Candidate => ({
  title: `Film ${over.movieId}`,
  year: '2000',
  posterPath: null,
  runtimeMinutes: 100,
  reason: 'because',
  facets: {},
  ...over,
});

const DEMANDING_FILM = candidate({
  movieId: 1,
  runtimeMinutes: 170,
  facets: { shape: ['nonlinear'], tempo: ['slow burn'] },
});

const EASY_FILM = candidate({
  movieId: 2,
  runtimeMinutes: 95,
  facets: { tempo: ['breathless'], sound: ['needle-drop maximalism'] },
});

const SOLITARY_FILM = candidate({
  movieId: 3,
  runtimeMinutes: 88,
  facets: { world: ['one apartment'], shape: ['two-hander'] },
});

const constraints = (over: Partial<Constraints> = {}): Constraints => ({
  ...DEFAULT_CONSTRAINTS,
  ...over,
});

describe('fitsRuntime', () => {
  it('applies the stated cap', () => {
    expect(fitsRuntime(candidate({ movieId: 1, runtimeMinutes: 89 }), constraints({ runtime: 'short' }))).toBe(true);
    expect(fitsRuntime(candidate({ movieId: 1, runtimeMinutes: 91 }), constraints({ runtime: 'short' }))).toBe(false);
  });

  it("doesn't hide a film just because TMDB has no runtime for it", () => {
    expect(fitsRuntime(candidate({ movieId: 1, runtimeMinutes: null }), constraints({ runtime: 'short' }))).toBe(true);
  });

  it('lets everything through on "any"', () => {
    expect(fitsRuntime(candidate({ movieId: 1, runtimeMinutes: 320 }), constraints({ runtime: 'any' }))).toBe(true);
  });
});

describe('fitScore', () => {
  it('penalises demanding films when the viewer has no energy left', () => {
    expect(fitScore(DEMANDING_FILM, constraints({ energy: 'low' }))).toBeLessThan(0);
  });

  it('rewards them when the viewer does', () => {
    expect(fitScore(DEMANDING_FILM, constraints({ energy: 'high' }))).toBeGreaterThan(0);
  });

  it('is neutral at medium energy', () => {
    expect(fitScore(DEMANDING_FILM, constraints({ energy: 'medium' }))).toBe(0);
  });

  it('favours crowd-pleasers for a group and penalises solitary films', () => {
    const group = constraints({ company: 'group' });
    expect(fitScore(EASY_FILM, group)).toBeGreaterThan(fitScore(SOLITARY_FILM, group));
    expect(fitScore(SOLITARY_FILM, group)).toBeLessThan(0);
  });

  it('favours solitary films when watching alone', () => {
    expect(fitScore(SOLITARY_FILM, constraints({ company: 'alone' }))).toBeGreaterThan(0);
  });

  it('returns a neutral score when a candidate has no facets', () => {
    expect(fitScore(candidate({ movieId: 9 }), constraints({ energy: 'low' }))).toBe(0);
  });
});

describe('selectPicks', () => {
  const queue = [DEMANDING_FILM, EASY_FILM, SOLITARY_FILM];

  it('never returns more than the hard cap', () => {
    const many = Array.from({ length: 20 }, (_, i) => candidate({ movieId: i, runtimeMinutes: 90 }));
    expect(selectPicks(many, constraints()).picks.length).toBe(MAX_PICKS);
  });

  it('applies the runtime cap before ranking', () => {
    const result = selectPicks(queue, constraints({ runtime: 'short' }));
    expect(result.picks.map((p) => p.movieId)).not.toContain(DEMANDING_FILM.movieId);
    expect(result.relaxedRuntime).toBe(false);
  });

  it('ranks the tired viewer away from the demanding film', () => {
    const result = selectPicks(queue, constraints({ energy: 'low', runtime: 'any' }));
    expect(result.picks[result.picks.length - 1].movieId).toBe(DEMANDING_FILM.movieId);
  });

  it('puts the group-friendly film first for a group', () => {
    const result = selectPicks(queue, constraints({ company: 'group', runtime: 'any' }));
    expect(result.picks[0].movieId).toBe(EASY_FILM.movieId);
  });

  it('relaxes the runtime cap rather than showing an empty screen, and says so', () => {
    const longOnly = [candidate({ movieId: 5, runtimeMinutes: 200 })];
    const result = selectPicks(longOnly, constraints({ runtime: 'short' }));

    expect(result.picks).toHaveLength(1);
    expect(result.relaxedRuntime).toBe(true);
  });

  it('reports no relaxation when the queue is simply empty', () => {
    expect(selectPicks([], constraints())).toEqual({ picks: [], relaxedRuntime: false });
  });
});

describe('constraintKey', () => {
  it('round-trips', () => {
    const value = constraints({ runtime: 'short', energy: 'high', company: 'group' });
    expect(parseConstraintKey(constraintKey(value))).toEqual(value);
  });

  it('rejects a malformed key rather than returning a half-built object', () => {
    expect(parseConstraintKey('nonsense')).toBeNull();
    expect(parseConstraintKey('short:invalid:group')).toBeNull();
    expect(parseConstraintKey('short:high')).toBeNull();
  });
});
