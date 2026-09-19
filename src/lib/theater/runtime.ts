import { filmsOf, IDLE_CLOSE_MS, INFER_WAIT_MS } from './gate';
import { inferTheater, theaterLlm } from './infer';
import { inferDue, theaterReducer } from './session';
import { tmdbTheaterSearch } from './tmdb';
import type { TheaterWriter } from './legacyStore';
import type { TheaterTasteEvent } from '../taste/types';
import {
  THEATER_DOC_SCHEMA,
  type Theater,
  type TheaterDoc,
  type TheaterEvent,
  type TheaterFilm,
  type TheaterLineupItem,
  type TheaterSession,
  type TheaterSignal,
} from './types';

export const DWELL_MIN_MS = 1000;
export const DWELL_ENGAGED_MS = 12000;

type DwellSignal = Extract<TheaterSignal, { kind: 'dwell' }>;

export function dwellSignal(filmId: number, ms: number, acted: boolean): DwellSignal | null {
  if (!Number.isFinite(ms) || ms < DWELL_MIN_MS) return null;
  return { kind: 'dwell', filmId, ms, engaged: acted || ms >= DWELL_ENGAGED_MS };
}

export type TheaterRuntimeEvent = TheaterEvent | { type: 'restore'; session: TheaterSession };

export function theaterRuntimeReducer(session: TheaterSession, event: TheaterRuntimeEvent): TheaterSession {
  if (event.type === 'restore') return event.session;
  if (event.type === 'dismiss' && session.status === 'kept') return { status: 'closed', reason: 'dismissed' };
  return theaterReducer(session, event);
}

export function sessionFilms(session: TheaterSession): TheaterFilm[] {
  return 'signals' in session ? filmsOf(session.signals) : [];
}

export type TheaterDeadline = { event: 'infer' | 'expire'; at: number };

export function delayUntil(deadline: TheaterDeadline, now: number): number {
  return Math.max(0, deadline.at - now);
}

export function nextDeadline(session: TheaterSession, now: number): TheaterDeadline | null {
  if (!('lastActiveAt' in session)) return null;
  const expire: TheaterDeadline = { event: 'expire', at: session.lastActiveAt + IDLE_CLOSE_MS };
  if (delayUntil(expire, now) === 0) return expire;
  if (session.status === 'collecting') {
    const at = session.lastActiveAt + INFER_WAIT_MS;
    if (inferDue(session, at)) return { event: 'infer', at };
  }
  return expire;
}

export type TheaterInfer = (signals: readonly TheaterSignal[], signal: AbortSignal) => Promise<Theater | null>;

export function theaterInference(tmdbApiKey: string): TheaterInfer {
  return (signals, signal) =>
    inferTheater(signals, {
      llm: theaterLlm,
      searchFilm: tmdbTheaterSearch({ apiKey: tmdbApiKey, fetch: (url) => fetch(url, { signal }) }),
    });
}

export type TheaterCancel = () => void;

export type TheaterEngineDeps = {
  infer: TheaterInfer;
  dispatch: (event: TheaterEvent) => void;
  now: () => number;
  schedule: (run: () => void, delayMs: number) => TheaterCancel;
};

export type TheaterEngine = {
  syncSession: (session: TheaterSession) => void;
  stop: () => void;
};

type InferRun = { revision: number; controller: AbortController };

export function createTheaterEngine(deps: TheaterEngineDeps): TheaterEngine {
  let cancelTimer: TheaterCancel | null = null;
  let run: InferRun | null = null;
  let revisions = 0;

  const clearTimer = () => {
    cancelTimer?.();
    cancelTimer = null;
  };

  const abortRun = () => {
    run?.controller.abort();
    run = null;
  };

  const settle = (current: InferRun, event: TheaterEvent) => {
    if (run !== current || current.controller.signal.aborted) return;
    run = null;
    deps.dispatch(event);
  };

  const start = (signals: readonly TheaterSignal[]) => {
    abortRun();
    revisions += 1;
    const current: InferRun = { revision: revisions, controller: new AbortController() };
    run = current;
    deps.dispatch({ type: 'infer_started', revision: current.revision, now: deps.now() });
    deps.infer(signals, current.controller.signal).then(
      (theater) =>
        settle(
          current,
          theater
            ? { type: 'infer_succeeded', revision: current.revision, theater }
            : { type: 'infer_failed', revision: current.revision },
        ),
      () => settle(current, { type: 'infer_failed', revision: current.revision }),
    );
  };

  const syncSession = (session: TheaterSession) => {
    clearTimer();
    if (run && !(session.status === 'inferring' && session.revision === run.revision)) abortRun();
    const deadline = nextDeadline(session, deps.now());
    if (!deadline) return;
    const fire =
      deadline.event === 'expire'
        ? () => deps.dispatch({ type: 'expire', now: deps.now() })
        : () => {
            if (session.status === 'collecting') start(session.signals);
          };
    cancelTimer = deps.schedule(fire, delayUntil(deadline, deps.now()));
  };

  return {
    syncSession,
    stop: () => {
      clearTimer();
      abortRun();
    },
  };
}

export function theaterDocFrom(theater: Theater, signals: readonly TheaterSignal[], keptAt: number): TheaterDoc {
  return {
    schema: THEATER_DOC_SCHEMA,
    title: theater.title,
    facets: theater.facets,
    insight: theater.insight,
    swatches: theater.swatches,
    sourceSignals: [...signals],
    sourceFilmIds: theater.sourceFilmIds,
    lineup: theater.lineup,
    keptAt,
  };
}

export type TheaterKeptEntry = { insight: string; movieCount: number };

export type KeepDeps = {
  now: () => number;
  write: TheaterWriter;
  recordTaste: (event: TheaterTasteEvent) => unknown;
  logKept: (entry: TheaterKeptEntry) => unknown;
};

export async function keepShowingTheater(session: TheaterSession, deps: KeepDeps): Promise<string | null> {
  if (session.status !== 'showing') return null;
  const { theater, signals, fingerprint } = session;
  await deps.write(fingerprint, theaterDocFrom(theater, signals, deps.now()));
  await Promise.allSettled([
    Promise.resolve(
      deps.recordTaste({ type: 'theater', insight: theater.insight, movieIds: theater.sourceFilmIds }),
    ),
    Promise.resolve(deps.logKept({ insight: theater.insight, movieCount: theater.lineup.length })),
  ]);
  return fingerprint;
}

export type TheaterCardModel = {
  status: 'inferring' | 'showing' | 'kept';
  title: string | null;
  facets: [string, string] | null;
  insight: string | null;
  lineup: TheaterLineupItem[];
};

export function theaterCardModel(session: TheaterSession): TheaterCardModel | null {
  switch (session.status) {
    case 'inferring':
      return { status: 'inferring', title: null, facets: null, insight: null, lineup: [] };
    case 'showing':
    case 'kept':
      return {
        status: session.status,
        title: session.theater.title,
        facets: session.theater.facets,
        insight: session.theater.insight,
        lineup: session.theater.lineup,
      };
    default:
      return null;
  }
}
