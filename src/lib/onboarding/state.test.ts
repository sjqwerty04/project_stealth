import { describe, expect, it } from 'vitest';
import {
  anyImportDone,
  canAdvance,
  filmsRead,
  initialOnboardingState,
  onboardingReducer,
  type FilmPick,
  type OnboardingState,
} from './state';
import { normalizeStats, parseSelectsProfile, templateProfile, type TasteStats } from './profile';

const film = (id: number): FilmPick => ({ id, title: `Film ${id}`, year: '1999', posterPath: null });

function run(actions: Parameters<typeof onboardingReducer>[1][], from: OnboardingState = initialOnboardingState) {
  return actions.reduce(onboardingReducer, from);
}

describe('onboardingReducer', () => {
  it('starts on splash and advances to positive', () => {
    expect(run([{ type: 'next' }]).step).toBe('positive');
  });

  it('refuses to leave positive with zero picks', () => {
    const s = run([{ type: 'next' }, { type: 'next' }]);
    expect(s.step).toBe('positive');
    expect(canAdvance(s)).toBe(false);
  });

  it('caps positive at 3 and negative at 2, toggling off on repeat', () => {
    const s = run([
      { type: 'togglePick', wall: 'positive', film: film(1) },
      { type: 'togglePick', wall: 'positive', film: film(2) },
      { type: 'togglePick', wall: 'positive', film: film(3) },
      { type: 'togglePick', wall: 'positive', film: film(4) },
      { type: 'togglePick', wall: 'negative', film: film(5) },
      { type: 'togglePick', wall: 'negative', film: film(6) },
      { type: 'togglePick', wall: 'negative', film: film(7) },
      { type: 'togglePick', wall: 'negative', film: film(5) },
    ]);
    expect(s.positive.map((f) => f.id)).toEqual([1, 2, 3]);
    expect(s.negative.map((f) => f.id)).toEqual([6]);
  });

  it('negative and neutral are skippable, reading waits for stats', () => {
    const s = run([
      { type: 'next' },
      { type: 'togglePick', wall: 'positive', film: film(1) },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
    ]);
    expect(s.step).toBe('reading');
    expect(onboardingReducer(s, { type: 'next' }).step).toBe('reading');
    const ready = onboardingReducer(s, { type: 'statsReady', stats: stats({ filmsRead: 3 }) });
    expect(onboardingReducer(ready, { type: 'next' }).step).toBe('negativeProfile');
  });

  it('axes are a multi-select set', () => {
    const s = run([{ type: 'toggleAxis', axis: 'story' }, { type: 'toggleAxis', axis: 'visual' }, { type: 'toggleAxis', axis: 'story' }]);
    expect(s.axes).toEqual(['visual']);
  });

  it('sums films read across sources and ignores errors', () => {
    const s = run([
      { type: 'importStarted', source: 'letterboxd' },
      { type: 'importDone', source: 'letterboxd', films: 40, nights: 12 },
      { type: 'importDone', source: 'imdb', films: 15, nights: 0 },
      { type: 'importFailed', source: 'notes', message: 'nope' },
    ]);
    expect(filmsRead(s)).toBe(55);
    expect(anyImportDone(s)).toBe(true);
  });
});

function stats(over: Partial<TasteStats> = {}): TasteStats {
  return {
    filmsRead: 0,
    nights: 0,
    hours: 0,
    lateNightPct: null,
    rewatchOfFiveStarPct: null,
    fiveStarCount: 0,
    topDecades: [],
    topPeople: [],
    topGenres: [],
    facetWeights: { look: 0, tempo: 0, weather: 0, world: 0, shape: 0, format: 0 },
    colourHex: '#3a6e85',
    postersSampled: 0,
    graphSeed: 'seed',
    sources: [],
    positive: [],
    negative: [],
    axes: [],
    ...over,
  };
}

const card = (tone: 'warm' | 'sharp', i: number) => ({ title: `t${i}`, headline: `h${i}`, body: `b${i}`, tone });
const goodPayload = () => ({
  archetype: 'nocturnalist',
  read: 'You watch at night, and you go back to the same six people.',
  insights: [...Array.from({ length: 8 }, (_, i) => card('warm', i)), card('sharp', 8), card('sharp', 9)],
});

describe('parseSelectsProfile', () => {
  it('accepts a well formed payload and uppercases labels', () => {
    const p = parseSelectsProfile(goodPayload());
    expect(p?.archetype).toBe('NOCTURNALIST');
    expect(p?.insights).toHaveLength(10);
    expect(p?.insights[0].title).toBe('T0');
  });

  it('rejects the wrong sharp ratio', () => {
    const bad = goodPayload();
    bad.insights[9].tone = 'warm';
    expect(parseSelectsProfile(bad)).toBeNull();
  });

  it('rejects nine or eleven cards', () => {
    const nine = goodPayload();
    nine.insights.pop();
    expect(parseSelectsProfile(nine)).toBeNull();
  });

  it('replaces em dashes instead of failing', () => {
    const p = parseSelectsProfile({ ...goodPayload(), read: 'Late nights \u2014 same six people.' });
    expect(p?.read).toBe('Late nights , same six people.');
  });

  it('allows a null archetype', () => {
    expect(parseSelectsProfile({ ...goodPayload(), archetype: null })?.archetype).toBeNull();
  });
});

describe('templateProfile', () => {
  it('always yields ten cards with two sharp', () => {
    const p = templateProfile(stats({ filmsRead: 12, hours: 20.4, positive: ['Heat'], negative: ['Dune'] }));
    expect(p.insights).toHaveLength(10);
    expect(p.insights.filter((c) => c.tone === 'sharp')).toHaveLength(2);
    expect(p.insights[0].headline).toBe('12');
    expect(p.insights[1].headline).toBe('Heat.');
  });
});

describe('normalizeStats', () => {
  it('fills missing fields so the template never reads undefined', () => {
    const p = templateProfile(normalizeStats({ filmsRead: 0 }));
    expect(p.insights).toHaveLength(10);
    expect(normalizeStats({ colourHex: 'nope' }).colourHex).toBe('#3A6E85');
  });
});
