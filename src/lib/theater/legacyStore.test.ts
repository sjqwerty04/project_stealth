import { describe, expect, it } from 'vitest';
import { copyForwardLegacyTheaters, theaterFromLegacy, type LegacySnapshot, type TheaterWriter } from './legacyStore';
import type { TheaterDoc } from './types';

const LEGACY_HEAT = { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg', mediaType: 'movie' };
const LEGACY_THIEF = { id: 10858, title: 'Thief', year: '1981', posterPath: null, mediaType: 'movie' };

const LEGACY_DOC = {
  pattern: 'Men who are good at their jobs and lose anyway',
  movies: [LEGACY_HEAT, LEGACY_THIEF],
  createdAt: { seconds: 1700000000, nanoseconds: 0 },
};

const CANONICAL: TheaterDoc = {
  schema: 1,
  title: 'Men who are good at their jobs and lose anyway',
  facets: null,
  insight: 'Men who are good at their jobs and lose anyway',
  swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
  sourceSignals: [],
  sourceFilmIds: [949, 10858],
  lineup: [
    { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: '' },
    { id: 10858, title: 'Thief', year: '1981', posterPath: null, backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: '' },
  ],
  keptAt: 1700000000000,
};

describe('theaterFromLegacy', () => {
  it('maps the pattern to title and insight and the films to a reasonless lineup with empty evidence fields', () => {
    expect(theaterFromLegacy(LEGACY_DOC)).toEqual(CANONICAL);
  });

  it('defaults the fields a pre-rename film never stored', () => {
    const mapped = theaterFromLegacy({ pattern: 'x', movies: [{ id: 64690, title: 'Drive', year: 2011 }, { id: 1396, title: 'Breaking Bad', mediaType: 'tv' }] });
    expect(mapped?.lineup).toEqual([
      { id: 64690, title: 'Drive', year: '2011', posterPath: null, backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: '' },
      { id: 1396, title: 'Breaking Bad', year: '', posterPath: null, backdropPath: null, genres: [], director: null, mediaType: 'tv', reason: '' },
    ]);
  });

  it('reads a millisecond createdAt and defaults a missing one to zero', () => {
    expect(theaterFromLegacy({ ...LEGACY_DOC, createdAt: 1700000000123 })?.keptAt).toBe(1700000000123);
    expect(theaterFromLegacy({ pattern: 'x', movies: [] })?.keptAt).toBe(0);
  });

  it('drops an unreadable film but keeps the document', () => {
    const mapped = theaterFromLegacy({ ...LEGACY_DOC, movies: [LEGACY_HEAT, { title: 'no id' }, 'junk'] });
    expect(mapped?.sourceFilmIds).toEqual([949]);
    expect(mapped?.lineup.map((item) => item.title)).toEqual(['Heat']);
  });

  it('rejects a document without a pattern or a film list', () => {
    expect(theaterFromLegacy(null)).toBeNull();
    expect(theaterFromLegacy({ movies: [LEGACY_HEAT] })).toBeNull();
    expect(theaterFromLegacy({ pattern: '   ', movies: [LEGACY_HEAT] })).toBeNull();
    expect(theaterFromLegacy({ pattern: 'x', movies: 'Heat' })).toBeNull();
  });
});

describe('copyForwardLegacyTheaters', () => {
  const SOURCE: LegacySnapshot[] = [
    { id: 'a1', data: LEGACY_DOC },
    { id: 'b2', data: { pattern: 'Slow-burn dread with a synth pulse', movies: [LEGACY_THIEF], createdAt: { seconds: 1700001000, nanoseconds: 0 } } },
    { id: 'c3', data: { broken: true } },
  ];

  function memoryWriter() {
    const docs = new Map<string, TheaterDoc>();
    const write: TheaterWriter = async (id, theater) => {
      docs.set(id, theater);
    };
    return { docs, write };
  }

  it('writes each mappable document under its own id and skips the rest', async () => {
    const { docs, write } = memoryWriter();
    expect(await copyForwardLegacyTheaters(SOURCE, write)).toEqual(['a1', 'b2']);
    expect([...docs.keys()]).toEqual(['a1', 'b2']);
    expect(docs.get('a1')).toEqual(CANONICAL);
    expect(docs.get('b2')).toMatchObject({ title: 'Slow-burn dread with a synth pulse', sourceFilmIds: [10858], keptAt: 1700001000000 });
  });

  it('converges on the same documents when run twice and deletes nothing', async () => {
    const before = JSON.stringify(SOURCE);
    const { docs, write } = memoryWriter();
    const first = await copyForwardLegacyTheaters(SOURCE, write);
    const afterFirst = new Map([...docs].map(([id, theater]) => [id, JSON.stringify(theater)]));
    const second = await copyForwardLegacyTheaters(SOURCE, write);
    expect(second).toEqual(first);
    expect(docs.size).toBe(2);
    expect(new Map([...docs].map(([id, theater]) => [id, JSON.stringify(theater)]))).toEqual(afterFirst);
    expect(JSON.stringify(SOURCE)).toBe(before);
  });
});
