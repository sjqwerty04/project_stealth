import { describe, expect, it } from 'vitest';
import { blendSelect } from './blend';
import { forYouScore } from './forYou';
import {
  cacheControlFor,
  extractNextData,
  fillClientRatings,
  letterboxdFromHtml,
  mapMdbList,
  mapOmdb,
  mapWikidataScores,
  mergePublicScores,
  queueFromNextData,
  queuePercent,
  queueSlug,
} from './public';
import { emptyPublicScores } from './types';

const heatRoom = [
  { key: 'letterboxd' as const, native: 4.32, count: 1_304_042 },
  { key: 'queue' as const, native: 93, count: 4958 },
  { key: 'imdb' as const, native: 8.3, count: 796_000 },
  { key: 'audience' as const, native: 94, count: 100_000 },
  { key: 'tomatoes' as const, native: 84, count: 157 },
  { key: 'metacritic' as const, native: 76, count: 23 },
];

describe('forYouScore', () => {
  const noise = {
    history: [{ item: 'Heat', rating: 1, id: '949' }],
    lastPicks: [{ movieId: 949, confidence: 0.2 }],
    library: { canon: ['Heat'], rejects: [], recent: ['Heat'] },
  };

  it('lets stars on this film replace every other signal', () => {
    expect(forYouScore({ movieId: 949, title: 'Heat', stars: 4.5, ...noise })).toBe(90);
    expect(forYouScore({ movieId: 949, title: 'Heat', stars: 5, ...noise })).toBe(100);
  });

  it('averages a real history rating with a stored pick', () => {
    expect(
      forYouScore({
        movieId: 949,
        title: 'Heat',
        history: [{ item: 'Heat', rating: 5, id: '949' }],
        lastPicks: [{ movieId: 949, confidence: 0.8 }],
      }),
    ).toBe(91);
  });

  it('skips a history rating of 3, which is also how an unrated watch is stored', () => {
    expect(forYouScore({ movieId: 949, title: 'Heat', history: [{ item: 'Heat', rating: 3, id: '949' }] })).toBeNull();
  });

  it('reads canon, rejects, and recent as title priors', () => {
    expect(forYouScore({ title: 'Heat', library: { canon: ['Heat'], rejects: [], recent: ['Heat'] } })).toBe(92);
    expect(forYouScore({ title: 'Heat', library: { canon: [], rejects: ['Heat'], recent: ['Heat'] } })).toBe(15);
    expect(forYouScore({ title: 'Heat', library: { canon: [], rejects: [], recent: ['Heat'] } })).toBe(68);
  });

  it('returns null when the snapshot has nothing about this film', () => {
    expect(forYouScore({ movieId: 949, title: 'Heat', history: [], lastPicks: [], library: null })).toBeNull();
  });

  it('ignores a stored pick below the skill confidence floor', () => {
    expect(
      forYouScore({
        movieId: 949,
        title: 'Heat',
        lastPicks: [{ movieId: 949, confidence: 0.4 }],
      }),
    ).toBeNull();
  });
});

describe('blendSelect', () => {
  it('blends the Heat fixture to 90', () => {
    const result = blendSelect(94, heatRoom);
    expect(result.weighted).toBeCloseTo(89.732, 2);
    expect(result.score).toBe(90);
  });

  it('renormalizes the room when Metacritic is missing', () => {
    const result = blendSelect(94, heatRoom.filter((source) => source.key !== 'metacritic'));
    expect(result.rows.find((row) => row.key === 'letterboxd')?.weight).toBeCloseTo(20, 5);
    expect(result.rows.find((row) => row.key === 'metacritic')?.used).toBe(false);
    expect(result.weighted).toBeCloseTo(90.4578, 3);
    expect(result.score).toBe(90);
  });

  it('drops a missing source instead of scoring it as zero', () => {
    const result = blendSelect(100, [
      { key: 'letterboxd', native: 0, count: 1000 },
      { key: 'imdb', native: 10, count: 1000 },
    ]);
    expect(result.score).toBe(61);
  });

  it('gives the whole score to the room when For you is null', () => {
    const result = blendSelect(null, heatRoom);
    expect(result.rows.find((row) => row.key === 'letterboxd')?.weight).toBeCloseTo(30, 5);
    expect(result.score).toBe(87);
  });

  it('returns For you alone when the room is empty', () => {
    expect(blendSelect(94, []).score).toBe(94);
  });

  it('hides the score when both sides are empty', () => {
    expect(blendSelect(null, []).score).toBeNull();
  });

  it('lists a thin Letterboxd sample and leaves it out of the blend', () => {
    const result = blendSelect(94, [
      { key: 'letterboxd', native: 4.32, count: 40 },
      { key: 'imdb', native: 8.3, count: 1000 },
    ]);
    const letterboxd = result.rows.find((row) => row.key === 'letterboxd');
    expect(letterboxd?.native).toBe(4.32);
    expect(letterboxd?.thin).toBe(true);
    expect(letterboxd?.used).toBe(false);
    expect(result.rows.find((row) => row.key === 'imdb')?.weight).toBeCloseTo(60, 5);
  });

  it('lists a thin Queue sample and leaves it out of the blend', () => {
    const result = blendSelect(null, [{ key: 'queue', native: 93, count: 12 }]);
    expect(result.rows.find((row) => row.key === 'queue')?.thin).toBe(true);
    expect(result.score).toBeNull();
  });
});

describe('public score parsers', () => {
  it('turns Queue feed stats into the liked-or-loved percent', () => {
    expect(queuePercent({ liked: 2529, loved: 2103, meh: 260, disliked: 66 })).toEqual({ value: 93, count: 4958 });
    expect(queueSlug('Heat', '1995')).toBe('heat-1995');
  });

  it('reads the title id and stats for this slug out of the Queue page', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                queryKey: ['title', 'similar', 'movies/heat-1995', 6],
                state: { data: { data: [{ id: 'other', slug: 'movies/other-1999' }] } },
              },
              {
                queryKey: ['title', 'get', 'movies/heat-1995'],
                state: { data: { id: 'TW92aWUvNjg0NA', slug: 'movies/heat-1995', title: 'Heat' } },
              },
              {
                queryKey: ['review', 'stats', 'movies/heat-1995'],
                state: { data: { liked: 2529, disliked: 66, meh: 260, loved: 2103 } },
              },
            ],
            mutations: [],
          },
        },
      },
    })}</script>`;
    const next = extractNextData(html);
    expect(queueFromNextData(next, 'heat-1995')).toEqual({
      id: 'TW92aWUvNjg0NA',
      score: { value: 93, count: 4958 },
    });
  });

  it('maps MDbList and OMDb into native scores, with MDbList winning a hole-fill', () => {
    const mdb = mapMdbList({
      ratings: [
        { source: 'imdb', value: 8.3, votes: 796000 },
        { source: 'letterboxd', value: 4.32, votes: 1304042 },
        { source: 'tomatoes', value: 84, votes: 157 },
        { source: 'tomatoesaudience', value: 94, votes: 100000 },
        { source: 'metacritic', value: 76, votes: 23 },
      ],
    });
    const omdb = mapOmdb({
      imdbRating: '8.1',
      imdbVotes: '1,000',
      Metascore: '70',
      Ratings: [{ Source: 'Rotten Tomatoes', Value: '80%' }],
    });
    const merged = mergePublicScores([mdb, omdb]);
    expect(merged.imdb).toEqual({ value: 8.3, count: 796000 });
    expect(merged.letterboxd.value).toBe(4.32);
    expect(merged.audience).toEqual({ value: 94, count: 100000 });
    expect(merged.tomatoes.value).toBe(84);
    expect(merged.queue.value).toBeNull();
  });

  it('reads a Letterboxd rating and its count from JSON-LD', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      aggregateRating: { ratingValue: '4.32', ratingCount: '1304042' },
    })}</script>`;
    expect(letterboxdFromHtml(html)).toEqual({ value: 4.32, count: 1304042 });
  });

  it('reads the latest IMDb, Tomatometer, and Metascore from Wikidata', () => {
    const mapped = mapWikidataScores([
      { score: '83%', when: '2024-08-02T00:00:00Z', reviewed: 'Rotten Tomatoes', method: 'Tomatometer score' },
      { score: '84%', when: '2026-02-19T00:00:00Z', reviewed: 'Rotten Tomatoes', method: 'Tomatometer score' },
      { score: '7.8/10', when: '2021-10-10T00:00:00Z', reviewed: 'Rotten Tomatoes', method: 'Rotten Tomatoes average of rated reviews' },
      { score: '8.3/10', when: '2026-02-19T00:00:00Z', reviewed: 'IMDb', method: 'weighted average' },
      { score: '76/100', when: '2025-07-14T00:00:00Z', reviewed: 'Metacritic', method: 'Metascore' },
    ]);
    expect(mapped.imdb).toEqual({ value: 8.3, count: null });
    expect(mapped.tomatoes).toEqual({ value: 84, count: null });
    expect(mapped.metacritic).toEqual({ value: 76, count: null });
    expect(mapped.audience).toBeUndefined();
  });

  it('fills IMDb, Tomatometer, and Metacritic holes from the page OMDb payload', () => {
    const scores = emptyPublicScores();
    scores.letterboxd = { value: 4.32, count: 1000 };
    const filled = fillClientRatings(scores, { imdb: '8.3', rottenTomatoes: '84%', metacritic: '76' });
    expect(filled.imdb.value).toBe(8.3);
    expect(filled.tomatoes.value).toBe(84);
    expect(filled.metacritic.value).toBe(76);
    expect(filled.letterboxd.value).toBe(4.32);
    expect(filled.audience.value).toBeNull();
  });

  it('caches a payload that has a score for 12 hours and a miss for a minute', () => {
    const scores = emptyPublicScores();
    expect(cacheControlFor(scores)).toBe('public, s-maxage=60');
    scores.imdb = { value: 8.3, count: 10 };
    expect(cacheControlFor(scores)).toBe('public, s-maxage=43200');
  });
});
