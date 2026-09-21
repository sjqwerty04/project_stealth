import { describe, expect, it } from 'vitest';
import { loadTheaterSession, saveTheaterSession, theaterSessionKey } from './persist';
import {
  FALLBACK_SWATCHES,
  type Theater,
  type TheaterFilm,
  type TheaterLineupItem,
  type TheaterSession,
  type TheaterSignal,
} from './types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  keys() {
    return [...this.map.keys()];
  }
}

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

const SIGNALS: TheaterSignal[] = [
  { kind: 'query', text: 'heat', mode: 'standard', at: 0 },
  { kind: 'detail_view', film: HEAT, at: 500 },
  { kind: 'detail_view', film: THIEF, at: 1000 },
  { kind: 'detail_view', film: COLLATERAL, at: 1500 },
  { kind: 'dwell', filmId: 10858, ms: 20000, engaged: true },
];

const LINEUP_ROWS: [number, string, string, string][] = [
  [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
  [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
  [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
  [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
  [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
  [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
];
const LINEUP: TheaterLineupItem[] = LINEUP_ROWS.map(([id, title, year, reason]) => ({
  id,
  title,
  year,
  posterPath: `/${id}.jpg`,
  backdropPath: null,
  genres: [],
  director: null,
  mediaType: 'movie',
  reason,
}));

const THEATER: Theater = {
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep opening films where the plan is perfect and the ending is not.',
  swatches: FALLBACK_SWATCHES,
  sourceFilmIds: [949, 10858, 1538],
  trail: [HEAT, THIEF, COLLATERAL],
  lineup: LINEUP,
};

const SHOWING: TheaterSession = { status: 'showing', theater: THEATER, signals: SIGNALS, fingerprint: 'bb8c37784ee25cf5', lastActiveAt: 1500 };

const KEY = 'theater-session:v2:alice';

describe('theaterSessionKey', () => {
  it('scopes the versioned key by uid', () => {
    expect(theaterSessionKey('alice')).toBe(KEY);
    expect(theaterSessionKey('bob')).toBe('theater-session:v2:bob');
  });
});

describe('save and load', () => {
  it('restores the exact showing session', () => {
    const storage = new MemoryStorage();
    saveTheaterSession(storage, 'alice', SHOWING);
    expect(storage.keys()).toEqual([KEY]);
    expect(loadTheaterSession(storage, 'alice')).toEqual(SHOWING);
  });

  it('restores a collecting session with its failed fingerprint', () => {
    const storage = new MemoryStorage();
    const collecting: TheaterSession = { status: 'collecting', signals: SIGNALS, lastActiveAt: 1000, failedFingerprint: 'bb8c37784ee25cf5' };
    saveTheaterSession(storage, 'alice', collecting);
    expect(loadTheaterSession(storage, 'alice')).toEqual(collecting);
  });

  it('stores an in-flight inference as collecting so the reload can infer again', () => {
    const storage = new MemoryStorage();
    saveTheaterSession(storage, 'alice', { status: 'inferring', signals: SIGNALS, revision: 3, fingerprint: 'bb8c37784ee25cf5', lastActiveAt: 1000 });
    expect(loadTheaterSession(storage, 'alice')).toEqual({ status: 'collecting', signals: SIGNALS, lastActiveAt: 1000, failedFingerprint: null });
  });

  it('clears the key for idle, kept, and closed', () => {
    for (const ended of [
      { status: 'idle' },
      { status: 'kept', theater: THEATER, keptId: 'bb8c37784ee25cf5' },
      { status: 'closed', reason: 'dismissed' },
    ] satisfies TheaterSession[]) {
      const storage = new MemoryStorage();
      saveTheaterSession(storage, 'alice', SHOWING);
      saveTheaterSession(storage, 'alice', ended);
      expect(storage.keys()).toEqual([]);
      expect(loadTheaterSession(storage, 'alice')).toEqual({ status: 'idle' });
    }
  });

  it('returns idle when nothing is stored', () => {
    expect(loadTheaterSession(new MemoryStorage(), 'alice')).toEqual({ status: 'idle' });
  });
});

describe('corruption', () => {
  it('removes only the Theater key and returns idle on unparseable JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('llm_cache_123', '{"value":"keep me"}');
    storage.setItem(KEY, '{"status":"showing", "theater": {');
    expect(loadTheaterSession(storage, 'alice')).toEqual({ status: 'idle' });
    expect(storage.keys()).toEqual(['llm_cache_123']);
    expect(storage.getItem('llm_cache_123')).toBe('{"value":"keep me"}');
  });

  it('treats a well-formed document with the wrong shape as corruption', () => {
    for (const bad of [
      '"just a string"',
      '{"status":"showing","signals":[],"lastActiveAt":5}',
      '{"status":"inferring","signals":[],"lastActiveAt":5,"revision":1,"fingerprint":"x"}',
      '{"status":"collecting","signals":[{"kind":"query","text":"heat"}],"lastActiveAt":5,"failedFingerprint":null}',
      '{"status":"collecting","signals":[],"lastActiveAt":"5","failedFingerprint":null}',
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85'] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, facets: ['ONLY ONE'] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, trail: [HEAT, THIEF] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, trail: undefined } }),
      JSON.stringify({
        ...SHOWING,
        theater: {
          ...THEATER,
          lineup: [
            ...LINEUP,
            { ...LINEUP[0], id: 64690, title: 'Drive' },
            { ...LINEUP[0], id: 680, title: 'Pulp Fiction' },
          ],
        },
      }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, lineup: [...LINEUP, { ...LINEUP[0], id: 999 }] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, lineup: [{ ...LINEUP[0], genres: undefined }, ...LINEUP.slice(1)] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, lineup: [{ ...LINEUP[0], director: 7 }, ...LINEUP.slice(1)] } }),
      JSON.stringify({ ...SHOWING, theater: { ...THEATER, lineup: [{ ...LINEUP[0], backdropPath: undefined }, ...LINEUP.slice(1)] } }),
      JSON.stringify({ ...SHOWING, signals: [{ kind: 'detail_view', film: { ...HEAT, mediaType: 'film' }, at: 0 }] }),
    ]) {
      const storage = new MemoryStorage();
      storage.setItem(KEY, bad);
      expect(loadTheaterSession(storage, 'alice')).toEqual({ status: 'idle' });
      expect(storage.keys()).toEqual([]);
    }
  });

  it('folds duplicate stored signals back through the same uniqueness rule', () => {
    const storage = new MemoryStorage();
    const duplicated = [
      { kind: 'detail_view', film: HEAT, at: 0 },
      { kind: 'detail_view', film: { ...HEAT, title: 'HEAT' }, at: 50 },
      { kind: 'query', text: 'heat', mode: 'standard', at: 100 },
      { kind: 'query', text: 'heat night', mode: 'standard', at: 900 },
    ];
    storage.setItem(KEY, JSON.stringify({ status: 'collecting', signals: duplicated, lastActiveAt: 900, failedFingerprint: null }));
    expect(loadTheaterSession(storage, 'alice')).toEqual({
      status: 'collecting',
      signals: [
        { kind: 'detail_view', film: HEAT, at: 0 },
        { kind: 'query', text: 'heat night', mode: 'standard', at: 900 },
      ],
      lastActiveAt: 900,
      failedFingerprint: null,
    });
  });
});

describe('uid isolation', () => {
  it('never shows one person another person\'s session', () => {
    const storage = new MemoryStorage();
    saveTheaterSession(storage, 'alice', SHOWING);
    expect(loadTheaterSession(storage, 'bob')).toEqual({ status: 'idle' });
    expect(loadTheaterSession(storage, 'alice')).toEqual(SHOWING);
    saveTheaterSession(storage, 'bob', { status: 'closed', reason: 'signed_out' });
    expect(storage.keys()).toEqual([KEY]);
  });
});
