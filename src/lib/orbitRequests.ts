import type { OrbitMovie, SwipeDirection } from '../stores/orbitStore';

export interface OrbitRecommendation {
  movie: OrbitMovie;
  connectionReason: string;
  similarityScore: number;
}

export type OrbitRequestStatus =
  | { state: 'idle' }
  | { state: 'loading'; promise: Promise<OrbitRecommendation | null> }
  | { state: 'ready'; value: OrbitRecommendation }
  | { state: 'failed' };

export type OrbitLoader = (
  movie: OrbitMovie,
  direction: SwipeDirection,
  taste?: string | null
) => Promise<OrbitRecommendation | null>;

export type OrbitBatchLoader = (
  movie: OrbitMovie,
  taste?: string | null
) => Promise<Record<SwipeDirection, OrbitRecommendation | null> | null>;

type ImageWarmer = (url: string) => void;

const directions: SwipeDirection[] = ['up', 'right', 'down', 'left'];

const defaultImageWarmer: ImageWarmer = (url) => {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = url;
};

export const getOrbitSourceKey = (
  movie: OrbitMovie,
  taste?: string | null
): string => JSON.stringify([
  movie.id,
  movie.mediaType,
  movie.title,
  movie.year,
  movie.genres ?? [],
  movie.director ?? null,
  taste ?? null,
]);

const getRequestKey = (
  movie: OrbitMovie,
  direction: SwipeDirection,
  taste?: string | null
): string => JSON.stringify([getOrbitSourceKey(movie, taste), direction]);

export const warmOrbitImages = (
  movie: OrbitMovie,
  warmImage: ImageWarmer = defaultImageWarmer
): void => {
  if (movie.posterPath) {
    warmImage(`https://image.tmdb.org/t/p/w500${movie.posterPath}`);
  }
  if (movie.backdropPath) {
    warmImage(`https://image.tmdb.org/t/p/w780${movie.backdropPath}`);
  }
};

export interface OrbitRequestCoordinator {
  sourceKey: (movie: OrbitMovie, taste?: string | null) => string;
  status: (
    movie: OrbitMovie,
    direction: SwipeDirection,
    taste?: string | null
  ) => OrbitRequestStatus;
  peek: (
    movie: OrbitMovie,
    direction: SwipeDirection,
    taste?: string | null
  ) => OrbitRecommendation | null;
  request: (
    movie: OrbitMovie,
    direction: SwipeDirection,
    taste?: string | null
  ) => Promise<OrbitRecommendation | null>;
  prefetch: (
    movie: OrbitMovie,
    backDirection: SwipeDirection | null,
    taste: string | null | undefined,
    publish: (
      sourceKey: string,
      direction: SwipeDirection,
      result: OrbitRecommendation
    ) => void
  ) => string;
}

export const createOrbitRequestCoordinator = (
  load: OrbitLoader,
  warmImage: ImageWarmer = defaultImageWarmer,
  loadBatch?: OrbitBatchLoader
): OrbitRequestCoordinator => {
  const entries = new Map<string, Exclude<OrbitRequestStatus, { state: 'idle' }>>();
  let activeSourceKey: string | null = null;
  const inFlightBatches = new Map<string, Promise<Record<SwipeDirection, OrbitRecommendation | null> | null>>();
  const batchSubscribers = new Map<string, Set<(sourceKey: string, dir: SwipeDirection, rec: OrbitRecommendation) => void>>();

  const status: OrbitRequestCoordinator['status'] = (movie, direction, taste) =>
    entries.get(getRequestKey(movie, direction, taste)) ?? { state: 'idle' };

  const request: OrbitRequestCoordinator['request'] = (movie, direction, taste) => {
    const key = getRequestKey(movie, direction, taste);
    const entry = entries.get(key);
    if (entry?.state === 'loading') return entry.promise;
    if (entry?.state === 'ready') return Promise.resolve(entry.value);

    const promise = load(movie, direction, taste)
      .then((result) => {
        if (!result) {
          entries.set(key, { state: 'failed' });
          return null;
        }
        entries.set(key, { state: 'ready', value: result });
        try {
          warmOrbitImages(result.movie, warmImage);
        } catch {
          return result;
        }
        return result;
      })
      .catch(() => {
        entries.set(key, { state: 'failed' });
        return null;
      });

    entries.set(key, { state: 'loading', promise });
    return promise;
  };

  return {
    sourceKey: getOrbitSourceKey,
    status,
    peek: (movie, direction, taste) => {
      const entry = status(movie, direction, taste);
      return entry.state === 'ready' ? entry.value : null;
    },
    request,
    prefetch: (movie, backDirection, taste, publish) => {
      const sourceKey = getOrbitSourceKey(movie, taste);
      activeSourceKey = sourceKey;

      if (loadBatch) {
        let subs = batchSubscribers.get(sourceKey);
        if (!subs) {
          subs = new Set();
          batchSubscribers.set(sourceKey, subs);
        }
        subs.add(publish);

        // Immediately publish any directions already ready
        for (const direction of directions) {
          if (direction === backDirection) continue;
          const key = getRequestKey(movie, direction, taste);
          const existing = entries.get(key);
          if (existing?.state === 'ready') {
            publish(sourceKey, direction, existing.value);
          }
        }

        let batchPromise = inFlightBatches.get(sourceKey);
        if (!batchPromise) {
          const resolvers: Partial<Record<SwipeDirection, (val: OrbitRecommendation | null) => void>> = {};
          for (const direction of directions) {
            const key = getRequestKey(movie, direction, taste);
            const existing = entries.get(key);
            if (!existing || existing.state === 'failed') {
              const p = new Promise<OrbitRecommendation | null>((resolve) => {
                resolvers[direction] = resolve;
              });
              entries.set(key, { state: 'loading', promise: p });
            }
          }

          batchPromise = loadBatch(movie, taste)
            .then((batchResult) => {
              inFlightBatches.delete(sourceKey);
              const currentSubs = batchSubscribers.get(sourceKey);
              batchSubscribers.delete(sourceKey);

              if (batchResult) {
                for (const direction of directions) {
                  const result = batchResult[direction];
                  const key = getRequestKey(movie, direction, taste);
                  if (result) {
                    entries.set(key, { state: 'ready', value: result });
                    try {
                      warmOrbitImages(result.movie, warmImage);
                    } catch {}
                    if (direction !== backDirection && activeSourceKey === sourceKey) {
                      currentSubs?.forEach((cb) => {
                        try { cb(sourceKey, direction, result); } catch {}
                      });
                    }
                    resolvers[direction]?.(result);
                  } else {
                    entries.set(key, { state: 'failed' });
                    resolvers[direction]?.(null);
                  }
                }
              } else {
                for (const direction of directions) {
                  const key = getRequestKey(movie, direction, taste);
                  if (entries.get(key)?.state === 'loading') {
                    entries.set(key, { state: 'failed' });
                  }
                  resolvers[direction]?.(null);
                }
              }
              return batchResult;
            })
            .catch(() => {
              inFlightBatches.delete(sourceKey);
              batchSubscribers.delete(sourceKey);
              for (const direction of directions) {
                const key = getRequestKey(movie, direction, taste);
                if (entries.get(key)?.state === 'loading') {
                  entries.set(key, { state: 'failed' });
                }
                resolvers[direction]?.(null);
              }
              return null;
            });

          inFlightBatches.set(sourceKey, batchPromise);
        }
        return sourceKey;
      }

      for (const direction of directions) {
        if (direction === backDirection) continue;
        void request(movie, direction, taste).then((result) => {
          if (result && activeSourceKey === sourceKey) {
            publish(sourceKey, direction, result);
          }
        });
      }

      return sourceKey;
    },
  };
};
