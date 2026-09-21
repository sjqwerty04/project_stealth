import { describe, expect, it } from 'vitest';
import { emptySnapshot } from '../taste/buildRecommendContext';
import type { TasteSnapshot } from '../taste/types';
import { mergeNeighborPools, rankNeighbors } from './rankNeighbors';
import type { FilmNeighbor } from './types';

function neighbor(partial: Partial<FilmNeighbor> & Pick<FilmNeighbor, 'movieId' | 'title'>): FilmNeighbor {
  return {
    year: '2015',
    posterPath: '/x.jpg',
    reason: 'Kin',
    source: 'scholar',
    axes: ['story'],
    ...partial,
  };
}

function snapshot(overrides: (base: TasteSnapshot) => TasteSnapshot): TasteSnapshot {
  return overrides(emptySnapshot());
}

describe('rankNeighbors', () => {
  const pool: FilmNeighbor[] = [
    neighbor({ movieId: 1, title: 'Heat', axes: ['story'] }),
    neighbor({ movieId: 2, title: 'Transformers', axes: ['visual'] }),
    neighbor({ movieId: 3, title: 'Sicario', axes: ['mood'] }),
    neighbor({ movieId: 4, title: 'Zodiac', axes: ['story'] }),
    neighbor({ movieId: 949, title: 'Self', source: 'lineage', axes: [] }),
  ];

  it('excludes the current film, watched history ids, and rejects', () => {
    const snap = snapshot((base) => ({
      ...base,
      context: {
        ...base.context,
        history: [{ item: 'Heat', rating: 5, id: '1' }],
        preferences: ['dislikes: Transformers'],
      },
      generated: {
        ...base.generated,
        library: {
          watched: 2,
          rated: 2,
          avgStars: 4,
          canon: [],
          rewatches: [],
          recent: [],
          rejects: ['Sicario'],
          tags: [],
          quotes: [],
        },
      },
    }));
    const ranked = rankNeighbors({ currentMovieId: 949, neighbors: pool, snapshot: snap });
    expect(ranked.map((r) => r.title)).toEqual(['Zodiac']);
  });

  it('boosts axis overlap and marks tasteBoost', () => {
    const snap = snapshot((base) => ({
      ...base,
      identity: { personaLine: null, axis: 'story' },
    }));
    const ranked = rankNeighbors({ currentMovieId: 0, neighbors: pool, snapshot: snap });
    const heat = ranked.find((r) => r.title === 'Heat');
    const sicario = ranked.find((r) => r.title === 'Sicario');
    expect(heat?.tasteBoost).toBe(true);
    expect(heat!.score).toBeGreaterThan(sicario!.score);
  });

  it('boosts canon titles named in lastPicks whyMatch', () => {
    const snap = snapshot((base) => ({
      ...base,
      generated: {
        ...base.generated,
        lastPicks: [
          {
            movieId: 99,
            title: 'The Town',
            year: '2010',
            poster: '',
            whyMatch: 'If Heat still lives in you, start here.',
            confidence: 0.9,
          },
        ],
        library: {
          watched: 1,
          rated: 1,
          avgStars: 5,
          canon: ['Zodiac'],
          rewatches: [],
          recent: [],
          rejects: [],
          tags: [],
          quotes: [],
        },
      },
    }));
    const ranked = rankNeighbors({
      currentMovieId: 0,
      neighbors: [
        neighbor({ movieId: 10, title: 'Heat', axes: [] }),
        neighbor({ movieId: 11, title: 'Zodiac', axes: [] }),
        neighbor({ movieId: 12, title: 'Other', axes: [] }),
      ],
      snapshot: snap,
    });
    expect(ranked[0].title).toBe('Zodiac');
    expect(ranked.find((r) => r.title === 'Heat')?.tasteBoost).toBe(true);
    expect(ranked.find((r) => r.title === 'Other')?.tasteBoost).toBe(false);
  });
});

describe('mergeNeighborPools', () => {
  it('lets scholar rows replace lineage for the same id', () => {
    const merged = mergeNeighborPools(
      [neighbor({ movieId: 1, title: 'Heat', source: 'lineage', reason: 'Nolan' })],
      [neighbor({ movieId: 1, title: 'Heat', source: 'scholar', reason: 'Crime opera' })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('scholar');
    expect(merged[0].reason).toBe('Crime opera');
  });
});
