import { describe, expect, it } from 'vitest';
import {
  firstSentence,
  forgetSelectsCacheMemory,
  hitSelectsCache,
  readSelectsCache,
  selectsCacheFresh,
  writeSelectsCache,
} from './selectsCache';
import { LAST_PICKS_FRESH_MS, type TastePick } from './types';

const picks: TastePick[] = [
  { movieId: 1538, title: 'Collateral', year: '2004', poster: 'x', whyMatch: 'You rated Heat a 5. Mann again.', confidence: 0.9 },
  { movieId: 11524, title: 'Thief', year: '1981', poster: 'y', whyMatch: 'Heat lineage.', confidence: 0.8 },
  { movieId: 8195, title: 'Ronin', year: '1998', poster: 'z', whyMatch: 'Crews.', confidence: 0.7 },
];

describe('selectsCache', () => {
  it('returns the same movie ids after memory is cleared', () => {
    writeSelectsCache('u1', picks, 1);
    forgetSelectsCacheMemory('u1');
    const hit = readSelectsCache('u1');
    expect(hit?.picks.map((p) => p.movieId)).toEqual([1538, 11524, 8195]);
    expect(selectsCacheFresh(hit, 1 + 1000)).toBe(true);
  });

  it('keeps picks fresh past the legacy 6h window so app reopen does not regenerate', () => {
    writeSelectsCache('u-long', picks, 1000);
    forgetSelectsCacheMemory('u-long');
    const hit = readSelectsCache('u-long');
    expect(selectsCacheFresh(hit, 1000 + LAST_PICKS_FRESH_MS + 99999)).toBe(true);
  });

  it('treats snapshot lastPicks as a hit without lastPicksAt', () => {
    forgetSelectsCacheMemory('u2');
    const hit = hitSelectsCache('u2', picks, null);
    expect(hit?.picks.map((p) => p.title)).toEqual(['Collateral', 'Thief', 'Ronin']);
    forgetSelectsCacheMemory('u2');
    expect(readSelectsCache('u2')?.picks[0].title).toBe('Collateral');
  });

  it('updates local cache when snapshot has newer picks', () => {
    writeSelectsCache('u3', picks, 100);
    const newerPicks: TastePick[] = [
      { movieId: 999, title: 'Heat', year: '1995', poster: 'h', whyMatch: 'Updated', confidence: 1 },
    ];
    const hit = hitSelectsCache('u3', newerPicks, 200);
    expect(hit?.picks[0].title).toBe('Heat');
    expect(hit?.at).toBe(200);
    forgetSelectsCacheMemory('u3');
    expect(readSelectsCache('u3')?.picks[0].title).toBe('Heat');
  });
});

describe('firstSentence', () => {
  it('keeps only the first sentence', () => {
    expect(firstSentence('You rated Heat a 5. Mann again at night.')).toBe('You rated Heat a 5.');
  });
});
