import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectExclusions,
  buildYourSelectsBody,
  hydrateUniqueSelectPicks,
  rejectSeenPicks,
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

  it('drops a rated film from a cache written before the verdict landed', () => {
    const cached = [
      { movieId: 263115, title: 'Logan' },
      { movieId: 949, title: 'Heat' },
      { movieId: 1949, title: 'Zodiac' },
    ];
    const seen = buildSelectExclusions({ sessionRated: [{ movieId: 263115, title: 'Logan' }] });

    expect(rejectSeenPicks(cached, seen).map((p) => p.title)).toEqual(['Heat', 'Zodiac']);
    expect(rejectSeenPicks(cached, []).map((p) => p.title)).toEqual(['Logan', 'Heat', 'Zodiac']);
  });

  it('drops a ledger-watched film by title when the cached id does not match', () => {
    const cached = [{ movieId: 111, title: 'Collateral' }];
    const seen = buildSelectExclusions({ ledgerWatched: [{ movieId: 1538, title: 'collateral' }] });

    expect(rejectSeenPicks(cached, seen)).toEqual([]);
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
});
