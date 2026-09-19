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

  it('uniques duplicate titles and ids before slicing to the requested count', () => {
    const picks = [
      { title: 'Heat', year: '1995', whyMatch: '', confidence: 0.9, id: '949' },
      { title: 'HEAT', year: '1995', whyMatch: '', confidence: 0.8, id: '950' },
      { title: 'Thief', year: '1981', whyMatch: '', confidence: 0.9, id: '77' },
      { title: 'Manhunter', year: '1986', whyMatch: '', confidence: 0.9, id: '77' },
      { title: 'Logan', year: '2017', whyMatch: '', confidence: 0.9, id: '263115' },
    ];

    expect(filterExcludedPicks(picks, [], 3).map((row) => row.title)).toEqual(['Heat', 'Thief', 'Logan']);
  });
});
