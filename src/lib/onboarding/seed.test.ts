import { describe, expect, it } from 'vitest';
import {
  axesFromSeed,
  encodeSeedParam,
  forgetSeed,
  parseMarketingSeed,
  profileAlreadyFinished,
  readRememberedSeed,
  rememberSeedParam,
  seedFilmDoc,
  stateFromSeed,
  type MarketingSeed,
} from './seed';

const heat = { id: 949, title: 'Heat', year: 1995 };
const mood = { id: 843, title: 'In the Mood for Love', year: 2000 };
const blade = { id: 335984, title: 'Blade Runner 2049', year: 2017 };

function seed(over: Partial<MarketingSeed> = {}): MarketingSeed {
  return {
    v: 1,
    name: 'Parity',
    positive: [heat, mood, blade],
    negative: [],
    axes: ['both'],
    hour: 22,
    letterboxd: '',
    ...over,
  };
}

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
    removeItem: (key: string) => {
      bag.delete(key);
    },
  };
}

describe('parseMarketingSeed', () => {
  it('accepts name, films, axes, hour, and username', () => {
    const parsed = parseMarketingSeed(
      encodeSeedParam(seed({ axes: ['writing', 'room', 'both'], hour: 22, letterboxd: 'parity', negative: [heat] })),
    );
    expect(parsed?.name).toBe('Parity');
    expect(parsed?.positive).toEqual([heat, mood, blade]);
    expect(parsed?.negative).toEqual([heat]);
    expect(parsed?.axes).toEqual(['writing', 'room', 'both']);
    expect(parsed?.hour).toBe(22);
    expect(parsed?.letterboxd).toBe('parity');
  });

  it('accepts a skipped negative list and a skipped Letterboxd handle', () => {
    const parsed = parseMarketingSeed(encodeSeedParam(seed()));
    expect(parsed?.negative).toEqual([]);
    expect(parsed?.letterboxd).toBe('');
  });

  it('rejects a bad payload', () => {
    expect(parseMarketingSeed(null)).toBeNull();
    expect(parseMarketingSeed('not-json')).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ v: 2 as 1 })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ name: '  ' })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ positive: [] })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ hour: 24 })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ axes: ['story' as 'both'] })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ letterboxd: 'bad handle' })))).toBeNull();
    expect(parseMarketingSeed(encodeSeedParam(seed({ positive: [{ id: 0, title: 'Heat', year: 1995 }] })))).toBeNull();
  });
});

describe('seed handoff', () => {
  it('maps writing, room, and both onto the app axes', () => {
    expect(axesFromSeed(['writing', 'room', 'both'])).toEqual(['story', 'visual', 'mood']);
  });

  it('stores films as id, title, and year and skips the answered questions', () => {
    const next = stateFromSeed(seed({ axes: ['writing'], letterboxd: 'parity' }));
    expect(seedFilmDoc(heat)).toEqual({ id: 949, title: 'Heat', year: 1995 });
    expect(next.positive.map((film) => film.title)).toEqual(['Heat', 'In the Mood for Love', 'Blade Runner 2049']);
    expect(next.axes).toEqual(['story']);
    expect(next.step).toBe('import');
  });

  it('keeps posterPath on favorite and disliked films', () => {
    const withPoster = { ...heat, posterPath: '/heat.jpg' };
    const parsed = parseMarketingSeed(
      encodeSeedParam(seed({ positive: [withPoster, mood, blade], negative: [withPoster] })),
    );
    expect(parsed?.positive[0].posterPath).toBe('/heat.jpg');
    expect(seedFilmDoc(parsed!.positive[0])).toEqual({ id: 949, title: 'Heat', year: 1995, posterPath: '/heat.jpg' });
    expect(seedFilmDoc(parsed!.negative[0]).posterPath).toBe('/heat.jpg');
    expect(stateFromSeed(parsed!).positive[0].posterPath).toBe('/heat.jpg');
    expect(stateFromSeed(parsed!).negative[0].posterPath).toBe('/heat.jpg');
  });

  it('stops on the axis question when the seed left it blank', () => {
    expect(stateFromSeed(seed({ axes: [] })).step).toBe('neutral');
  });

  it('keeps a remembered seed and drops a bad one', () => {
    const store = memory();
    const param = encodeSeedParam(seed());
    rememberSeedParam(param, store);
    expect(readRememberedSeed(store)?.name).toBe('Parity');
    rememberSeedParam('nope', store);
    expect(readRememberedSeed(store)).toBeNull();
    rememberSeedParam(param, store);
    forgetSeed(store);
    expect(readRememberedSeed(store)).toBeNull();
  });

  it('treats a finished profile as already written', () => {
    expect(profileAlreadyFinished({ onboardingCompleted: true, version: 2 })).toBe(true);
    expect(profileAlreadyFinished({ onboardingCompleted: false })).toBe(false);
    expect(profileAlreadyFinished(undefined)).toBe(false);
  });
});
