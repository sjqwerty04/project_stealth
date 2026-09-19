import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { filterExcludedPicks, parseRecommendRequest } from './your-selects';

describe('your-selects request', () => {
  const context = {
    preferences: ['crime films'],
    profile: '',
    constraints: {},
    history: [],
  };

  it('defaults to three picks and accepts one-pick requests', () => {
    expect(parseRecommendRequest({ context })).toEqual({
      context,
      count: 3,
      excluded: [],
    });
    expect(parseRecommendRequest({ context, count: 1 })).toEqual({
      context,
      count: 1,
      excluded: [],
    });
    expect(parseRecommendRequest({ context, count: 2 })).toBeNull();
  });

  it('names the recommended title in the whyMatch schema example', async () => {
    const source = await readFile(new URL('./your-selects.ts', import.meta.url), 'utf8');
    expect(source).toContain('"whyMatch":"Two or three sentences about Film."');
    expect(source).not.toContain('Name a history title');
  });

  it('normalizes excluded titles and IDs', () => {
    expect(
      parseRecommendRequest({
        context,
        count: 1,
        excluded: [
          { title: ' Heat ', id: 949 },
          { title: 'Zodiac', id: '1949' },
          { title: '', id: null },
        ],
      }),
    ).toEqual({
      context,
      count: 1,
      excluded: [
        { title: 'Heat', id: '949' },
        { title: 'Zodiac', id: '1949' },
      ],
    });
  });

  it('returns one non-visible pick after title and ID exclusions', () => {
    const picks = [
      { title: 'heat', year: '1995', whyMatch: '', confidence: 0.9 },
      { title: 'Thief', year: '1981', whyMatch: '', confidence: 0.9, id: '77' },
      { title: 'Manhunter', year: '1986', whyMatch: '', confidence: 0.9, id: '11454' },
    ];

    expect(
      filterExcludedPicks(
        picks,
        [
          { title: 'Heat', id: '949' },
          { title: 'Collateral', id: '77' },
        ],
        1,
      ),
    ).toEqual([
      { title: 'Manhunter', year: '1986', whyMatch: '', confidence: 0.9, id: '11454' },
    ]);
  });
});
