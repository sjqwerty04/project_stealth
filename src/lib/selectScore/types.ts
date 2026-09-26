export const SOURCE_KEYS = ['letterboxd', 'imdb', 'tomatoes', 'audience', 'metacritic', 'queue'] as const;

export type SourceKey = (typeof SOURCE_KEYS)[number];

/** A platform number in its native scale, plus the sample size when we know it. */
export type PublicScore = {
  value: number | null;
  count: number | null;
};

export type PublicScores = Record<SourceKey, PublicScore>;

export function emptyPublicScores(): PublicScores {
  return {
    letterboxd: { value: null, count: null },
    imdb: { value: null, count: null },
    tomatoes: { value: null, count: null },
    audience: { value: null, count: null },
    metacritic: { value: null, count: null },
    queue: { value: null, count: null },
  };
}
