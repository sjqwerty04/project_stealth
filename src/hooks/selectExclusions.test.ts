import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectExclusions,
  buildYourSelectsBody,
  canGenerateSelects,
  coerceSelectTrio,
  dropExcludedPicks,
  openSelectSlots,
  selectsStatusWhileBusy,
  hydrateUniqueSelectPicks,
  uniqueByMovieId,
} from './selectExclusions';

describe('select exclusions', () => {
  it('keeps Logan in the generate POST body after a rec verdict', () => {
    const excluded = buildSelectExclusions({
      lastPicks: [
        { movieId: 949, title: 'Heat' },
        { movieId: 64690, title: 'Drive' },
      ],
      ledgerWatched: [{ movieId: 949, title: 'Heat' }],
      sessionRated: [{ movieId: 263115, title: 'Logan' }],
    });
    const body = buildYourSelectsBody({ history: [{ item: 'Logan', rating: 5, id: '263115' }] }, excluded, 3);
    expect(body.excluded.some((row) => row.id === '263115' && row.title === 'Logan')).toBe(true);
    expect(body.count).toBe(3);
  });

  it('drops duplicate hydrated movie ids before the trio is shown', () => {
    const unique = uniqueByMovieId([
      { movieId: 155, title: 'The Dark Knight' },
      { movieId: 155, title: 'The Dark Knight' },
      { movieId: 155, title: 'Batman Begins' },
    ]);
    expect(unique).toHaveLength(1);
    expect(unique.map((row) => row.movieId)).toEqual([155]);
  });

  it('requests again when hydration collapses to fewer than the asked count', async () => {
    const requestMore = vi.fn(async () => [{ title: 'Thief' }]);
    const picks = await hydrateUniqueSelectPicks({
      raw: [{ title: 'Heat' }, { title: 'Heat again' }, { title: 'Drive' }],
      hydrate: async (raw) => {
        if (raw.title.startsWith('Heat')) return { movieId: 949, title: 'Heat' };
        if (raw.title === 'Drive') return { movieId: 64690, title: 'Drive' };
        return { movieId: 11524, title: 'Thief' };
      },
      count: 3,
      excluded: [{ id: '1', title: 'Collateral' }],
      requestMore,
    });
    expect(requestMore).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: '949', title: 'Heat' }),
        expect.objectContaining({ id: '64690', title: 'Drive' }),
      ]),
      1,
    );
    expect(picks.map((row) => row.movieId).sort((a, b) => a - b)).toEqual([949, 11524, 64690]);
    expect(new Set(picks.map((row) => row.movieId)).size).toBe(3);
  });

  it('drops Collateral after hydrate when Grok used a different title string', async () => {
    const requestMore = vi.fn(async () => [{ title: 'Thief' }]);
    const picks = await hydrateUniqueSelectPicks({
      raw: [{ title: 'Collateral (2004)' }, { title: 'Heat' }, { title: 'Drive' }],
      hydrate: async (raw) => {
        if (raw.title.startsWith('Collateral')) return { movieId: 1538, title: 'Collateral' };
        if (raw.title === 'Heat') return { movieId: 949, title: 'Heat' };
        if (raw.title === 'Thief') return { movieId: 11524, title: 'Thief' };
        return { movieId: 64690, title: 'Drive' };
      },
      count: 3,
      excluded: [{ id: '1538', title: 'Collateral' }],
      requestMore,
    });
    expect(picks.map((row) => row.movieId)).not.toContain(1538);
    expect(requestMore).toHaveBeenCalled();
    expect(picks).toHaveLength(3);
  });

  it('does not keep movieId 1538 when Collateral is watched', () => {
    const cached = [
      { movieId: 1538, title: 'Collateral' },
      { movieId: 11524, title: 'Thief' },
      { movieId: 8195, title: 'Ronin' },
    ];
    expect(dropExcludedPicks(cached, [{ id: '1538', title: 'Collateral' }]).map((row) => row.movieId)).toEqual([
      11524, 8195,
    ]);
  });

  it('keeps the cached trio when lastPicks are omitted from cache exclusions', () => {
    const cached = [
      { movieId: 1538, title: 'Collateral' },
      { movieId: 11524, title: 'Thief' },
      { movieId: 8195, title: 'Ronin' },
    ];
    const forCache = buildSelectExclusions({
      ledgerWatched: [{ movieId: 949, title: 'Heat' }],
      sessionRated: [],
    });
    expect(dropExcludedPicks(cached, forCache).map((row) => row.movieId)).toEqual([1538, 11524, 8195]);
    expect(dropExcludedPicks(cached, buildSelectExclusions({ lastPicks: cached }))).toEqual([]);
  });

  it('keeps three slots when one cached select is excluded', () => {
    const cached = [
      { movieId: 1538, title: 'Collateral' },
      { movieId: 11524, title: 'Thief' },
      { movieId: 8195, title: 'Ronin' },
    ];
    expect(openSelectSlots(cached, [{ id: '1538', title: 'Collateral' }])).toEqual([0]);
    expect(coerceSelectTrio(cached, dropExcludedPicks(cached, [{ id: '1538', title: 'Collateral' }]))).toEqual(
      cached,
    );
    expect(
      coerceSelectTrio(
        cached,
        dropExcludedPicks(cached, [{ id: '1538', title: 'Collateral' }]),
      ),
    ).toHaveLength(3);
  });

  it('accepts a full incoming trio and a short list when nothing is on screen', () => {
    const incoming = [
      { movieId: 1, title: 'Heat' },
      { movieId: 2, title: 'Thief' },
      { movieId: 3, title: 'Ronin' },
    ];
    expect(coerceSelectTrio([], incoming)).toEqual(incoming);
    expect(coerceSelectTrio([{ movieId: 9, title: 'Old' }], [{ movieId: 4, title: 'Only' }])).toEqual([
      { movieId: 4, title: 'Only' },
    ]);
    expect(coerceSelectTrio(incoming, [])).toEqual(incoming);
  });

  it('keeps the strip ready while cards are already on screen', () => {
    expect(selectsStatusWhileBusy(3, false)).toBe('ready');
    expect(selectsStatusWhileBusy(0, true)).toBe('ready');
    expect(selectsStatusWhileBusy(0, false)).toBe('loading');
  });

  it('does not generate while the library is empty or a slot is replacing', () => {
    expect(canGenerateSelects({ libraryReady: false, replacing: false })).toBe(false);
    expect(canGenerateSelects({ libraryReady: true, replacing: true })).toBe(false);
    expect(canGenerateSelects({ libraryReady: true, replacing: false })).toBe(true);
  });
});
