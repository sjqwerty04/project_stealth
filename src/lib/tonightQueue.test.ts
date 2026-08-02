import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));

const {
  isStale,
  needsRefill,
  parseQueue,
  pruneQueue,
  QUEUE_TTL_MS,
  QUEUE_VERSION,
  REFILL_THRESHOLD,
} = await import('./tonightQueue');

const NOW = 1_800_000_000_000;

const queue = (over: Partial<{ candidates: any[]; generatedAt: number; version: number }> = {}) => ({
  candidates: Array.from({ length: 10 }, (_, i) => ({
    movieId: i,
    title: `Film ${i}`,
    year: '2000',
    posterPath: null,
    runtimeMinutes: 100,
    reason: '',
    facets: {},
  })),
  generatedAt: NOW,
  version: QUEUE_VERSION,
  ...over,
});

describe('isStale', () => {
  it('is fresh inside the window and stale outside it', () => {
    expect(isStale({ generatedAt: NOW }, NOW + QUEUE_TTL_MS - 1)).toBe(false);
    expect(isStale({ generatedAt: NOW }, NOW + QUEUE_TTL_MS)).toBe(true);
  });
});

describe('needsRefill', () => {
  it('refills when there is no queue at all', () => {
    expect(needsRefill(null, NOW)).toBe(true);
  });

  it('refills a queue written by an older schema rather than misreading it', () => {
    expect(needsRefill(queue({ version: QUEUE_VERSION - 1 }), NOW)).toBe(true);
  });

  it('refills a stale queue even when it is still full', () => {
    expect(needsRefill(queue(), NOW + QUEUE_TTL_MS)).toBe(true);
  });

  it('refills once the queue is running down', () => {
    expect(needsRefill(queue({ candidates: queue().candidates.slice(0, REFILL_THRESHOLD) }), NOW)).toBe(true);
  });

  it('leaves a fresh, full queue alone', () => {
    expect(needsRefill(queue(), NOW)).toBe(false);
  });
});

describe('parseQueue', () => {
  it('reads a well-formed document', () => {
    const parsed = parseQueue({
      candidates: [
        {
          movieId: 949,
          title: 'Heat',
          year: '1995',
          posterPath: '/p.jpg',
          runtimeMinutes: 170,
          reason: 'Because of the night.',
          facets: { tempo: ['procedural'] },
        },
      ],
      generatedAt: NOW,
      version: QUEUE_VERSION,
    });

    expect(parsed!.candidates).toHaveLength(1);
    expect(parsed!.candidates[0].facets).toEqual({ tempo: ['procedural'] });
  });

  it('drops entries missing an id or title instead of rendering blanks', () => {
    const parsed = parseQueue({
      candidates: [{ movieId: 1, title: 'Good' }, { title: 'No id' }, { movieId: 2 }, null, 'junk'],
      generatedAt: NOW,
      version: QUEUE_VERSION,
    });

    expect(parsed!.candidates.map((c) => c.title)).toEqual(['Good']);
  });

  it('fills defaults for optional fields so callers never see undefined', () => {
    const parsed = parseQueue({
      candidates: [{ movieId: 1, title: 'Sparse' }],
      generatedAt: NOW,
      version: QUEUE_VERSION,
    });

    expect(parsed!.candidates[0]).toMatchObject({
      year: '',
      posterPath: null,
      runtimeMinutes: null,
      reason: '',
      facets: {},
    });
  });

  it('strips facets that are not in the vocabulary', () => {
    const parsed = parseQueue({
      candidates: [{ movieId: 1, title: 'X', facets: { look: ['neon-drenched'], bogus: ['x'] } }],
      generatedAt: NOW,
      version: QUEUE_VERSION,
    });

    expect(parsed!.candidates[0].facets).toEqual({});
  });

  it('returns null for a document that is not a queue', () => {
    expect(parseQueue(null)).toBeNull();
    expect(parseQueue('nope')).toBeNull();
    expect(parseQueue({ generatedAt: NOW })).toBeNull();
  });

  it('treats a missing timestamp as epoch, which reads as stale', () => {
    const parsed = parseQueue({ candidates: [] });
    expect(isStale(parsed!, NOW)).toBe(true);
  });
});

describe('pruneQueue', () => {
  it('removes candidates the user has already dealt with', () => {
    const pruned = pruneQueue(queue(), [0, 1, 2]);
    expect(pruned.candidates.map((c) => c.movieId)).not.toContain(0);
    expect(pruned.candidates).toHaveLength(7);
  });

  it('leaves the queue untouched when nothing is excluded', () => {
    expect(pruneQueue(queue(), []).candidates).toHaveLength(10);
  });

  it('preserves the timestamp so pruning does not make a queue look fresh', () => {
    expect(pruneQueue(queue(), [0]).generatedAt).toBe(NOW);
  });
});
