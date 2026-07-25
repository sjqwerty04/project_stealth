import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sanitizeFacets } from './facets';
import type { Candidate } from './constraints';

/**
 * The warm queue: candidates generated ahead of time and persisted, so opening
 * the app costs one Firestore read instead of a model call.
 *
 * This is the single change that makes the ten-second claim possible. Generating
 * on open meant the first pick cost 6–14 seconds of sequential network work
 * every time, and there is no amount of UI polish that hides that.
 *
 * The queue is generated *without* knowing tonight's constraints and is filtered
 * locally — see constraints.ts for why.
 */

const QUEUE_DOC = 'tonight_queue';

/** Aim to keep this many candidates warm. */
export const TARGET_QUEUE_SIZE = 12;

/** Refill once the queue drops to here, so a user never waits for generation. */
export const REFILL_THRESHOLD = 5;

/**
 * Candidates go stale: a film the user watched elsewhere, or a mood from a week
 * ago, is worse than no suggestion. A day is long enough to survive a weekend of
 * not opening the app and short enough that the queue still feels current.
 */
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;

export type StoredQueue = {
  candidates: Candidate[];
  generatedAt: number;
  /** Schema version, so a format change can invalidate rather than misparse. */
  version: number;
};

export const QUEUE_VERSION = 1;

export function isStale(queue: Pick<StoredQueue, 'generatedAt'>, now: number = Date.now()): boolean {
  return now - queue.generatedAt >= QUEUE_TTL_MS;
}

export function needsRefill(queue: StoredQueue | null, now: number = Date.now()): boolean {
  if (!queue) return true;
  if (queue.version !== QUEUE_VERSION) return true;
  if (isStale(queue, now)) return true;
  return queue.candidates.length <= REFILL_THRESHOLD;
}

/**
 * Coerces whatever is in Firestore into candidates, dropping anything malformed.
 *
 * Documents written by an older build, or half-written by an interrupted refill,
 * must not crash the first screen the user sees.
 */
export function parseQueue(raw: unknown): StoredQueue | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const generatedAt = typeof data.generatedAt === 'number' ? data.generatedAt : 0;
  const version = typeof data.version === 'number' ? data.version : 0;
  if (!Array.isArray(data.candidates)) return null;

  const candidates: Candidate[] = [];
  for (const entry of data.candidates) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.movieId !== 'number' || typeof item.title !== 'string') continue;

    candidates.push({
      movieId: item.movieId,
      title: item.title,
      year: typeof item.year === 'string' ? item.year : '',
      posterPath: typeof item.posterPath === 'string' ? item.posterPath : null,
      runtimeMinutes: typeof item.runtimeMinutes === 'number' ? item.runtimeMinutes : null,
      reason: typeof item.reason === 'string' ? item.reason : '',
      facets: sanitizeFacets(item.facets),
    });
  }

  return { candidates, generatedAt, version };
}

/** Drops candidates the user has since logged, skipped, or already been shown. */
export function pruneQueue(queue: StoredQueue, excludeMovieIds: Iterable<number>): StoredQueue {
  const excluded = new Set(excludeMovieIds);
  return { ...queue, candidates: queue.candidates.filter((c) => !excluded.has(c.movieId)) };
}

function queueRef(uid: string) {
  return doc(db, 'users', uid, 'queues', QUEUE_DOC);
}

export async function readQueue(uid: string): Promise<StoredQueue | null> {
  try {
    const snapshot = await getDoc(queueRef(uid));
    return snapshot.exists() ? parseQueue(snapshot.data()) : null;
  } catch (error) {
    // A warm queue is an optimisation; failing to read it must degrade to
    // generating on demand, never to a broken screen.
    console.error('Could not read the tonight queue:', error);
    return null;
  }
}

export async function writeQueue(uid: string, candidates: Candidate[]): Promise<void> {
  const payload: StoredQueue = {
    candidates: candidates.slice(0, TARGET_QUEUE_SIZE),
    generatedAt: Date.now(),
    version: QUEUE_VERSION,
  };
  try {
    await setDoc(queueRef(uid), payload);
  } catch (error) {
    console.error('Could not persist the tonight queue:', error);
  }
}
