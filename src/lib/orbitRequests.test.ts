import { describe, expect, it } from 'vitest';
import {
  createOrbitRequestCoordinator,
  type OrbitRecommendation,
} from './orbitRequests';
import type { OrbitMovie, SwipeDirection } from '../stores/orbitStore';

const source: OrbitMovie = {
  id: 155,
  title: 'The Dark Knight',
  year: '2008',
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  dominantHex: '#111111',
  mediaType: 'movie',
  director: 'Christopher Nolan',
  genres: ['Drama', 'Action'],
};

const recommendation: OrbitRecommendation = {
  movie: {
    ...source,
    id: 152601,
    title: 'Her',
    year: '2013',
  },
  connectionReason: 'Same lonely ache',
  similarityScore: 88,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Orbit request coordinator', () => {
  it('publishes each allowed direction as soon as it resolves', async () => {
    const requests = new Map<SwipeDirection, ReturnType<typeof deferred<OrbitRecommendation | null>>>();
    const coordinator = createOrbitRequestCoordinator((_, direction) => {
      const request = deferred<OrbitRecommendation | null>();
      requests.set(direction, request);
      return request.promise;
    });
    const published: SwipeDirection[] = [];

    coordinator.prefetch(source, null, 'noir', (_, direction) => published.push(direction));
    requests.get('left')!.resolve(recommendation);
    await requests.get('left')!.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(published).toEqual(['left']);
  });

  it('joins the exact in-flight promise and exposes the ready result synchronously', async () => {
    const pending = deferred<OrbitRecommendation | null>();
    let calls = 0;
    const warmed: string[] = [];
    const coordinator = createOrbitRequestCoordinator(
      () => {
        calls += 1;
        return pending.promise;
      },
      (url) => warmed.push(url)
    );

    const first = coordinator.request(source, 'left', 'noir');
    const second = coordinator.request(source, 'left', 'noir');
    expect(second).toBe(first);
    expect(calls).toBe(1);

    pending.resolve(recommendation);
    await first;

    expect(coordinator.peek(source, 'left', 'noir')?.movie.title).toBe('Her');
    expect(warmed).toEqual([
      'https://image.tmdb.org/t/p/w500/poster.jpg',
      'https://image.tmdb.org/t/p/w780/backdrop.jpg',
    ]);
  });

  it('rejects a late publication after the active source changes', async () => {
    const requests = new Map<string, ReturnType<typeof deferred<OrbitRecommendation | null>>>();
    const coordinator = createOrbitRequestCoordinator((movie, direction) => {
      const request = deferred<OrbitRecommendation | null>();
      requests.set(`${movie.id}:${direction}`, request);
      return request.promise;
    });
    const published: string[] = [];
    const nextSource = { ...source, id: 27205, title: 'Inception' };

    coordinator.prefetch(source, 'up', 'noir', (_, direction) => published.push(`old:${direction}`));
    coordinator.prefetch(nextSource, 'up', 'noir', (_, direction) => published.push(`new:${direction}`));
    requests.get('155:left')!.resolve(recommendation);
    requests.get('27205:left')!.resolve(recommendation);
    await Promise.all([
      requests.get('155:left')!.promise,
      requests.get('27205:left')!.promise,
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(published).toEqual(['new:left']);
  });

  it('invalidates requests when the exact taste text changes', async () => {
    let calls = 0;
    const coordinator = createOrbitRequestCoordinator(async () => {
      calls += 1;
      return recommendation;
    });

    await coordinator.request(source, 'left', 'likes noir');
    await coordinator.request(source, 'left', 'likes noir ');

    expect(calls).toBe(2);
  });

  it('retries a failed entry', async () => {
    let calls = 0;
    const coordinator = createOrbitRequestCoordinator(async () => {
      calls += 1;
      return calls === 1 ? null : recommendation;
    });

    expect(await coordinator.request(source, 'left', 'noir')).toBeNull();
    expect((await coordinator.request(source, 'left', 'noir'))?.movie.title).toBe('Her');
    expect(calls).toBe(2);
  });

  it('keeps a ready recommendation when image warming fails', async () => {
    const coordinator = createOrbitRequestCoordinator(
      async () => recommendation,
      () => {
        throw new Error('image failed');
      }
    );

    expect((await coordinator.request(source, 'left', 'noir'))?.movie.title).toBe('Her');
    expect(coordinator.status(source, 'left', 'noir').state).toBe('ready');
  });

  it('does not request the dynamic back direction', () => {
    const requested: SwipeDirection[] = [];
    const coordinator = createOrbitRequestCoordinator((_, direction) => {
      requested.push(direction);
      return new Promise(() => {});
    });

    coordinator.prefetch(source, 'down', 'noir', () => {});

    expect(requested).toEqual(['up', 'right', 'left']);
  });

  it('keeps visual-only color changes on the same source key', () => {
    const coordinator = createOrbitRequestCoordinator(async () => recommendation);

    expect(coordinator.sourceKey(source, 'noir')).toBe(
      coordinator.sourceKey({ ...source, dominantHex: '#ffffff' }, 'noir')
    );
    expect(coordinator.sourceKey(source, 'noir')).not.toBe(
      coordinator.sourceKey({ ...source, id: 999 }, 'noir')
    );
  });

  it('uses loadBatch during prefetch to populate all directions in one call', async () => {
    let batchCalls = 0;
    let singleCalls = 0;
    const published: SwipeDirection[] = [];

    const coordinator = createOrbitRequestCoordinator(
      async () => {
        singleCalls += 1;
        return recommendation;
      },
      () => {},
      async () => {
        batchCalls += 1;
        return {
          up: { ...recommendation, connectionReason: 'Up reason' },
          right: { ...recommendation, connectionReason: 'Right reason' },
          down: { ...recommendation, connectionReason: 'Down reason' },
          left: { ...recommendation, connectionReason: 'Left reason' },
        };
      }
    );

    coordinator.prefetch(source, 'up', 'taste', (_sourceKey, dir) => {
      published.push(dir);
    });

    // In-flight request should wait on the batch
    const pendingRight = coordinator.request(source, 'right', 'taste');
    expect(coordinator.status(source, 'right', 'taste').state).toBe('loading');

    const result = await pendingRight;
    expect(result?.connectionReason).toBe('Right reason');
    expect(batchCalls).toBe(1);
    expect(singleCalls).toBe(0);
    expect(coordinator.peek(source, 'down', 'taste')?.connectionReason).toBe('Down reason');
    expect(coordinator.peek(source, 'left', 'taste')?.connectionReason).toBe('Left reason');
    // 'up' was the back direction, so it shouldn't be published to store
    expect(published).toEqual(['right', 'down', 'left']);
  });
});
