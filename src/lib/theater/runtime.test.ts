import { afterEach, describe, expect, it, vi } from 'vitest';
import { fingerprint } from './fingerprint';
import { IDLE_CLOSE_MS, INFER_WAIT_MS } from './gate';
import { loadTheaterSession, saveTheaterSession } from './persist';
import { IDLE_SESSION } from './session';
import {
  createTheaterEngine,
  delayUntil,
  dwellSignal,
  keepShowingTheater,
  nextDeadline,
  sessionFilms,
  theaterCardModel,
  theaterDocFrom,
  theaterInference,
  theaterRuntimeReducer,
  type KeepDeps,
  type TheaterCancel,
  type TheaterInfer,
  type TheaterRuntimeEvent,
} from './runtime';
import {
  FALLBACK_SWATCHES,
  type Theater,
  type TheaterDoc,
  type TheaterFilm,
  type TheaterLineupItem,
  type TheaterSession,
  type TheaterSignal,
} from './types';

const HEAT: TheaterFilm = {
  id: 949,
  title: 'Heat',
  year: '1995',
  posterPath: '/heat.jpg',
  backdropPath: '/heat-backdrop.jpg',
  genres: ['Crime', 'Drama'],
  director: 'Michael Mann',
  mediaType: 'movie',
};
const THIEF: TheaterFilm = {
  id: 10858,
  title: 'Thief',
  year: '1981',
  posterPath: '/thief.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};

const LINEUP_ROWS: [number, string, string, string][] = [
  [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
  [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
  [1538, 'Collateral', '2004', 'One long night where the professional and the amateur both lose the map.'],
  [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
  [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
  [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
  [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
  [64690, 'Drive', '2011', 'The driver is perfect behind the wheel and helpless everywhere else.'],
];
const LINEUP: TheaterLineupItem[] = LINEUP_ROWS.map(([id, title, year, reason]) => ({
  id,
  title,
  year,
  posterPath: `/${id}.jpg`,
  backdropPath: null,
  genres: [],
  director: null,
  mediaType: 'movie',
  reason,
}));

const INSIGHT = 'You keep opening films where the plan is perfect and the ending is not.';

const THEATER: Theater = {
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: INSIGHT,
  swatches: FALLBACK_SWATCHES,
  sourceFilmIds: [10858],
  lineup: LINEUP,
};

const LATER_THEATER: Theater = { ...THEATER, title: 'Thieves who cannot stop working', sourceFilmIds: [10858, 949] };

const QUERY_HEAT: TheaterSignal = { kind: 'query', text: 'heat', mode: 'standard', at: 0 };
const QUERY_THIEF: TheaterSignal = { kind: 'query', text: 'thief', mode: 'standard', at: 100 };
const VIEW_THIEF: TheaterSignal = { kind: 'detail_view', film: THIEF, at: 100 };

const TRAIL: TheaterSignal[] = [QUERY_HEAT, VIEW_THIEF];
const TRAIL_FINGERPRINT = 'bb8c37784ee25cf5';

const collecting = (signals: TheaterSignal[], lastActiveAt: number, failedFingerprint: string | null = null): TheaterSession => ({
  status: 'collecting',
  signals,
  lastActiveAt,
  failedFingerprint,
});

const showing = (theater: Theater, signals: TheaterSignal[], lastActiveAt: number): TheaterSession => ({
  status: 'showing',
  theater,
  signals,
  fingerprint: fingerprint(signals),
  lastActiveAt,
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  keys() {
    return [...this.map.keys()];
  }
}

type Task = { at: number; run: () => void };

function testClock() {
  let now = 0;
  let tasks: Task[] = [];
  return {
    now: () => now,
    pending: () => tasks.length,
    schedule(run: () => void, delayMs: number): TheaterCancel {
      const task: Task = { at: now + delayMs, run };
      tasks.push(task);
      return () => {
        tasks = tasks.filter((entry) => entry !== task);
      };
    },
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const [due] = tasks.filter((task) => task.at <= target).sort((a, b) => a.at - b.at);
        if (!due) break;
        tasks = tasks.filter((task) => task !== due);
        now = Math.max(now, due.at);
        due.run();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

function harness(infer: TheaterInfer, start: TheaterSession = IDLE_SESSION) {
  const clock = testClock();
  let session = start;
  const engine = createTheaterEngine({ infer, dispatch, now: clock.now, schedule: clock.schedule });

  function dispatch(event: TheaterRuntimeEvent) {
    session = theaterRuntimeReducer(session, event);
    engine.syncSession(session);
  }

  engine.syncSession(session);
  return {
    clock,
    engine,
    get session() {
      return session;
    },
    dispatch,
    signal: (signal: TheaterSignal) => dispatch({ type: 'signal', signal }),
    query: (text: string, mode: 'standard' | 'ai-curated' = 'standard') =>
      dispatch({ type: 'signal', signal: { kind: 'query', text, mode, at: clock.now() } }),
    view: (film: TheaterFilm) => dispatch({ type: 'signal', signal: { kind: 'detail_view', film, at: clock.now() } }),
  };
}

describe('nextDeadline', () => {
  it('waits 2500 ms after the last unique signal once the gate is open', () => {
    const session = collecting(TRAIL, 100);
    expect(nextDeadline(session, 100)).toEqual({ event: 'infer', at: 2600 });
    expect(delayUntil({ event: 'infer', at: 2600 }, 100)).toBe(INFER_WAIT_MS);
    expect(delayUntil({ event: 'infer', at: 2600 }, 2600)).toBe(0);
    expect(delayUntil({ event: 'infer', at: 2600 }, 9000)).toBe(0);
  });

  it('holds a closed gate at the idle deadline', () => {
    expect(nextDeadline(collecting([QUERY_HEAT], 0), 0)).toEqual({ event: 'expire', at: IDLE_CLOSE_MS });
  });

  it('opens on one AI-curated query', () => {
    const session = collecting([{ kind: 'query', text: 'men who are good at their jobs', mode: 'ai-curated', at: 500 }], 500);
    expect(nextDeadline(session, 500)).toEqual({ event: 'infer', at: 3000 });
  });

  it('does not re-infer a fingerprint that already failed', () => {
    expect(nextDeadline(collecting(TRAIL, 100, TRAIL_FINGERPRINT), 100)).toEqual({ event: 'expire', at: IDLE_CLOSE_MS + 100 });
  });

  it('gives inferring and showing sessions only the idle deadline', () => {
    const inferring: TheaterSession = { status: 'inferring', signals: TRAIL, revision: 1, fingerprint: TRAIL_FINGERPRINT, lastActiveAt: 100 };
    expect(nextDeadline(inferring, 2600)).toEqual({ event: 'expire', at: IDLE_CLOSE_MS + 100 });
    expect(nextDeadline(showing(THEATER, TRAIL, 100), 2600)).toEqual({ event: 'expire', at: IDLE_CLOSE_MS + 100 });
  });

  it('closes a restored session that is already past the idle window instead of inferring', () => {
    const session = collecting(TRAIL, 100);
    expect(nextDeadline(session, 100 + IDLE_CLOSE_MS)).toEqual({ event: 'expire', at: IDLE_CLOSE_MS + 100 });
  });

  it('schedules nothing for idle, kept, or closed', () => {
    expect(nextDeadline(IDLE_SESSION, 0)).toBeNull();
    expect(nextDeadline({ status: 'kept', theater: THEATER, keptId: TRAIL_FINGERPRINT }, 0)).toBeNull();
    expect(nextDeadline({ status: 'closed', reason: 'dismissed' }, 0)).toBeNull();
  });
});

describe('dwellSignal', () => {
  it('marks a visit under eight seconds with no action as not engaged', () => {
    expect(dwellSignal(949, 7999, false)).toEqual({ kind: 'dwell', filmId: 949, ms: 7999, engaged: false });
    expect(dwellSignal(949, 8000, false)?.engaged).toBe(false);
    expect(dwellSignal(949, 11999, false)?.engaged).toBe(false);
  });

  it('marks twelve seconds or any like, save, or log action as engaged', () => {
    expect(dwellSignal(949, 12000, false)).toEqual({ kind: 'dwell', filmId: 949, ms: 12000, engaged: true });
    expect(dwellSignal(949, 4000, true)).toEqual({ kind: 'dwell', filmId: 949, ms: 4000, engaged: true });
    expect(dwellSignal(949, 30000, true)?.engaged).toBe(true);
  });

  it('drops a bounce that no person could feel', () => {
    expect(dwellSignal(949, 999, false)).toBeNull();
    expect(dwellSignal(949, 0, true)).toBeNull();
    expect(dwellSignal(949, Number.NaN, false)).toBeNull();
  });
});

describe('theaterCardModel', () => {
  it('shows the inferring shell with no model copy', () => {
    const inferring: TheaterSession = { status: 'inferring', signals: TRAIL, revision: 1, fingerprint: TRAIL_FINGERPRINT, lastActiveAt: 100 };
    expect(theaterCardModel(inferring)).toEqual({ status: 'inferring', title: null, facets: null, insight: null, lineup: [] });
  });

  it('carries title, facets, insight, and the eight lineup reasons for showing and kept', () => {
    for (const session of [showing(THEATER, TRAIL, 100), { status: 'kept', theater: THEATER, keptId: TRAIL_FINGERPRINT }] satisfies TheaterSession[]) {
      const model = theaterCardModel(session);
      expect(model?.title).toBe('Men who are good at their jobs and lose anyway');
      expect(model?.facets).toEqual(['COMPETENCE PORN', 'NOBODY WINS']);
      expect(model?.insight).toBe(INSIGHT);
      expect(model?.lineup.map((item) => item.reason)).toEqual(LINEUP_ROWS.map(([, , , reason]) => reason));
    }
  });

  it('renders nothing for idle, collecting, and closed', () => {
    expect(theaterCardModel(IDLE_SESSION)).toBeNull();
    expect(theaterCardModel(collecting(TRAIL, 100))).toBeNull();
    expect(theaterCardModel({ status: 'closed', reason: 'idle' })).toBeNull();
  });
});

describe('sessionFilms', () => {
  it('lists the opened films of a live session and nothing for an ended one', () => {
    expect(sessionFilms(collecting(TRAIL, 100))).toEqual([THIEF]);
    expect(sessionFilms(IDLE_SESSION)).toEqual([]);
    expect(sessionFilms({ status: 'closed', reason: 'signed_out' })).toEqual([]);
  });
});

describe('engine', () => {
  it('infers once, 2500 ms after the second signal', async () => {
    const seen: TheaterSignal[][] = [];
    const app = harness(async (signals) => {
      seen.push([...signals]);
      return THEATER;
    });

    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    expect(app.session.status).toBe('collecting');

    await app.clock.advance(INFER_WAIT_MS - 1);
    expect(app.session.status).toBe('collecting');
    expect(seen).toHaveLength(0);

    await app.clock.advance(1);
    expect(seen).toEqual([TRAIL]);
    expect(app.session).toEqual({
      status: 'showing',
      theater: THEATER,
      signals: TRAIL,
      fingerprint: TRAIL_FINGERPRINT,
      lastActiveAt: 100,
    });
  });

  it('never infers from one plain query', async () => {
    let calls = 0;
    const app = harness(async () => {
      calls += 1;
      return THEATER;
    });
    app.query('heat');
    await app.clock.advance(INFER_WAIT_MS * 4);
    expect(calls).toBe(0);
    expect(app.session.status).toBe('collecting');
  });

  it('spends one inference per fingerprint and none on a repeated query', async () => {
    let calls = 0;
    const app = harness(async () => {
      calls += 1;
      return THEATER;
    });
    app.query('heat');
    await app.clock.advance(100);
    app.query('thief');
    await app.clock.advance(INFER_WAIT_MS);
    expect(calls).toBe(1);
    expect(app.session.status).toBe('showing');

    app.query('Thief');
    await app.clock.advance(INFER_WAIT_MS * 2);
    expect(calls).toBe(1);
  });

  it('aborts the older inference when the fingerprint changes and ignores its late result', async () => {
    const first = deferred<Theater | null>();
    const second = deferred<Theater | null>();
    const signals: AbortSignal[] = [];
    const app = harness((_, signal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });

    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    await app.clock.advance(INFER_WAIT_MS);
    expect(app.session.status).toBe('inferring');
    expect(signals[0].aborted).toBe(false);

    app.view(HEAT);
    expect(app.session.status).toBe('collecting');
    expect(signals[0].aborted).toBe(true);

    await app.clock.advance(INFER_WAIT_MS);
    expect(signals).toHaveLength(2);

    second.resolve(LATER_THEATER);
    await flush();
    first.resolve(THEATER);
    await flush();

    expect(app.session.status).toBe('showing');
    expect(app.session).toMatchObject({ theater: LATER_THEATER, fingerprint: 'a0744096085ab69b' });
  });

  it('rejects a stale revision that the reducer outranks', () => {
    const inferring: TheaterSession = { status: 'inferring', signals: TRAIL, revision: 2, fingerprint: TRAIL_FINGERPRINT, lastActiveAt: 100 };
    expect(theaterRuntimeReducer(inferring, { type: 'infer_succeeded', revision: 1, theater: THEATER })).toEqual(inferring);
    expect(theaterRuntimeReducer(inferring, { type: 'infer_failed', revision: 1 })).toEqual(inferring);
    expect(theaterRuntimeReducer(inferring, { type: 'infer_succeeded', revision: 2, theater: THEATER }).status).toBe('showing');
  });

  it('returns to collecting on a malformed draft and retries only after new evidence', async () => {
    let calls = 0;
    const app = harness(async () => {
      calls += 1;
      return calls === 1 ? null : LATER_THEATER;
    });

    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    await app.clock.advance(INFER_WAIT_MS);
    expect(calls).toBe(1);
    expect(app.session).toEqual(collecting(TRAIL, 100, TRAIL_FINGERPRINT));

    await app.clock.advance(INFER_WAIT_MS * 3);
    expect(calls).toBe(1);

    app.view(HEAT);
    await app.clock.advance(INFER_WAIT_MS);
    expect(calls).toBe(2);
    expect(app.session.status).toBe('showing');
  });

  it('treats a rejected inference as a failure without publishing a Theater', async () => {
    const app = harness(() => Promise.reject(new Error('HTTP 500')));
    app.query('heat');
    await app.clock.advance(100);
    app.query('thief');
    await app.clock.advance(INFER_WAIT_MS);
    expect(app.session).toEqual(collecting([QUERY_HEAT, QUERY_THIEF], 100, '626f16ac561ba3e7'));
  });

  it('closes a showing Theater after thirty idle minutes and clears its stored session', async () => {
    const storage = new MemoryStorage();
    const app = harness(async () => THEATER);
    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    await app.clock.advance(INFER_WAIT_MS);
    saveTheaterSession(storage, 'alice', app.session);
    expect(loadTheaterSession(storage, 'alice').status).toBe('showing');

    await app.clock.advance(IDLE_CLOSE_MS);
    expect(app.session).toEqual({ status: 'closed', reason: 'idle' });
    saveTheaterSession(storage, 'alice', app.session);
    expect(storage.keys()).toEqual([]);
    expect(app.clock.pending()).toBe(0);
  });

  it('closes on dismiss and on sign-out, and clears the stored session for both', async () => {
    const storage = new MemoryStorage();
    for (const ending of [{ type: 'dismiss' }, { type: 'sign_out' }] satisfies TheaterRuntimeEvent[]) {
      const app = harness(async () => THEATER);
      app.query('heat');
      await app.clock.advance(100);
      app.query('thief');
      await app.clock.advance(INFER_WAIT_MS);
      saveTheaterSession(storage, 'alice', app.session);

      app.dispatch(ending);
      expect(app.session).toEqual({ status: 'closed', reason: ending.type === 'dismiss' ? 'dismissed' : 'signed_out' });
      saveTheaterSession(storage, 'alice', app.session);
      expect(storage.keys()).toEqual([]);
      expect(app.clock.pending()).toBe(0);
    }
  });

  it('aborts in-flight work when the provider unmounts', async () => {
    const pending = deferred<Theater | null>();
    const signals: AbortSignal[] = [];
    const app = harness((_, signal) => {
      signals.push(signal);
      return pending.promise;
    });
    app.query('heat');
    await app.clock.advance(100);
    app.query('thief');
    await app.clock.advance(INFER_WAIT_MS);

    app.engine.stop();
    expect(signals[0].aborted).toBe(true);
    expect(app.clock.pending()).toBe(0);

    pending.resolve(THEATER);
    await flush();
    expect(app.session.status).toBe('inferring');
  });
});

describe('restore', () => {
  it('returns the stored Theater without an inference', async () => {
    const storage = new MemoryStorage();
    const live = showing(THEATER, TRAIL, 100);
    saveTheaterSession(storage, 'alice', live);

    let calls = 0;
    const app = harness(async () => {
      calls += 1;
      return THEATER;
    });
    app.dispatch({ type: 'restore', session: loadTheaterSession(storage, 'alice') });

    expect(app.session).toEqual(live);
    await app.clock.advance(INFER_WAIT_MS * 4);
    expect(calls).toBe(0);
    expect(app.session).toEqual(live);
  });

  it('infers straight away when a restored trail is already past its due time', async () => {
    const storage = new MemoryStorage();
    saveTheaterSession(storage, 'alice', collecting(TRAIL, 100));

    let calls = 0;
    const app = harness(async () => {
      calls += 1;
      return THEATER;
    });
    await app.clock.advance(INFER_WAIT_MS * 2);
    app.dispatch({ type: 'restore', session: loadTheaterSession(storage, 'alice') });
    await app.clock.advance(0);

    expect(calls).toBe(1);
    expect(app.session.status).toBe('showing');
  });

  it('starts empty when the tab has no stored session', () => {
    expect(loadTheaterSession(new MemoryStorage(), 'alice')).toEqual(IDLE_SESSION);
    expect(theaterRuntimeReducer(showing(THEATER, TRAIL, 100), { type: 'restore', session: IDLE_SESSION })).toEqual(IDLE_SESSION);
  });
});

describe('keepShowingTheater', () => {
  const EXPECTED_DOC: TheaterDoc = {
    schema: 1,
    title: 'Men who are good at their jobs and lose anyway',
    facets: ['COMPETENCE PORN', 'NOBODY WINS'],
    insight: INSIGHT,
    swatches: FALLBACK_SWATCHES,
    sourceSignals: TRAIL,
    sourceFilmIds: [10858],
    lineup: LINEUP,
    keptAt: 1_700_000_000_000,
  };

  function keepRecorder() {
    const written = new Map<string, TheaterDoc>();
    const taste: unknown[] = [];
    const activity: { action: string; metadata: unknown }[] = [];
    const deps: KeepDeps = {
      now: () => 1_700_000_000_000,
      write: async (id, doc) => {
        written.set(id, doc);
      },
      recordTaste: (event) => taste.push(event),
      logKept: (entry) => activity.push({ action: 'theater_kept', metadata: entry }),
    };
    return { written, taste, activity, deps };
  }

  it('writes the canonical document, one taste event, and one theater_kept row', async () => {
    const recorder = keepRecorder();
    const keptId = await keepShowingTheater(showing(THEATER, TRAIL, 100), recorder.deps);

    expect(keptId).toBe(TRAIL_FINGERPRINT);
    expect([...recorder.written.entries()]).toEqual([[TRAIL_FINGERPRINT, EXPECTED_DOC]]);
    expect(recorder.taste).toEqual([{ type: 'theater', insight: INSIGHT, movieIds: [10858] }]);
    expect(recorder.activity).toEqual([{ action: 'theater_kept', metadata: { insight: INSIGHT, movieCount: 8 } }]);
  });

  it('keeps raw query text out of the activity row and inside the document', async () => {
    const recorder = keepRecorder();
    const trail: TheaterSignal[] = [{ kind: 'query', text: 'sodium vapour heist films', mode: 'ai-curated', at: 0 }, VIEW_THIEF];
    const keptId = await keepShowingTheater(showing(THEATER, trail, 100), recorder.deps);

    expect(Object.keys(recorder.activity[0].metadata as object)).toEqual(['insight', 'movieCount']);
    expect(JSON.stringify(recorder.activity)).not.toContain('sodium');
    expect(recorder.written.get(keptId ?? '')?.sourceSignals).toEqual(trail);
  });

  it('writes nothing a second time', async () => {
    const recorder = keepRecorder();
    const live = showing(THEATER, TRAIL, 100);
    const keptId = await keepShowingTheater(live, recorder.deps);
    const kept = theaterRuntimeReducer(live, { type: 'keep' });

    expect(kept).toEqual({ status: 'kept', theater: THEATER, keptId: TRAIL_FINGERPRINT });
    expect(await keepShowingTheater(kept, recorder.deps)).toBeNull();
    expect(recorder.written.size).toBe(1);
    expect(recorder.taste).toHaveLength(1);
    expect(recorder.activity).toHaveLength(1);
    expect(keptId).toBe(TRAIL_FINGERPRINT);
  });

  it('clears the kept shell on dismiss without another write', async () => {
    const recorder = keepRecorder();
    const live = showing(THEATER, TRAIL, 100);
    await keepShowingTheater(live, recorder.deps);
    const kept = theaterRuntimeReducer(live, { type: 'keep' });

    const closed = theaterRuntimeReducer(kept, { type: 'dismiss' });
    expect(closed).toEqual({ status: 'closed', reason: 'dismissed' });
    expect(theaterCardModel(closed)).toBeNull();
    expect(await keepShowingTheater(closed, recorder.deps)).toBeNull();
    expect(recorder.written.size).toBe(1);
  });

  it('converges on one document when the same trail is kept twice', async () => {
    const recorder = keepRecorder();
    await keepShowingTheater(showing(THEATER, TRAIL, 100), recorder.deps);
    await keepShowingTheater(showing(THEATER, TRAIL, 900), recorder.deps);
    expect([...recorder.written.keys()]).toEqual([TRAIL_FINGERPRINT]);
  });

  it('writes nothing for a session that has no Theater', async () => {
    const recorder = keepRecorder();
    for (const session of [IDLE_SESSION, collecting(TRAIL, 100), { status: 'closed', reason: 'dismissed' }] satisfies TheaterSession[]) {
      expect(await keepShowingTheater(session, recorder.deps)).toBeNull();
    }
    expect(recorder.written.size).toBe(0);
    expect(recorder.taste).toEqual([]);
    expect(recorder.activity).toEqual([]);
  });

  it('emits no save while inference runs', async () => {
    const recorder = keepRecorder();
    const app = harness(async () => THEATER);
    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    await app.clock.advance(INFER_WAIT_MS);

    expect(app.session.status).toBe('showing');
    expect(recorder.written.size).toBe(0);
    expect(recorder.taste).toEqual([]);
    expect(recorder.activity).toEqual([]);
  });

  it('records the exact source trail it was kept from', () => {
    expect(theaterDocFrom(THEATER, TRAIL, 1_700_000_000_000)).toEqual(EXPECTED_DOC);
  });
});

describe('theaterInference', () => {
  const DRAFT = {
    title: THEATER.title,
    facets: THEATER.facets,
    insight: INSIGHT,
    picks: LINEUP_ROWS.map(([, title, year, reason]) => ({ title, year, reason })),
  };

  const CREDITS: Record<number, { genres: string[]; director: string }> = {
    5511: { genres: ['Crime', 'Drama'], director: 'Jean-Pierre Melville' },
    9526: { genres: ['Action', 'Crime'], director: 'William Friedkin' },
    1538: { genres: ['Crime', 'Thriller'], director: 'Michael Mann' },
    31672: { genres: ['Crime', 'Drama'], director: 'Peter Yates' },
    24559: { genres: ['Adventure', 'Thriller'], director: 'William Friedkin' },
    379: { genres: ['Crime', 'Drama'], director: 'Joel Coen' },
    273481: { genres: ['Action', 'Crime'], director: 'Denis Villeneuve' },
    64690: { genres: ['Crime', 'Drama'], director: 'Nicolas Winding Refn' },
  };

  type Row = (typeof LINEUP_ROWS)[number];
  const byTitle = new Map(LINEUP_ROWS.map((row) => [row[1], row]));
  const byId = new Map(LINEUP_ROWS.map((row) => [String(row[0]), row]));

  const tmdbFields = ([id, title, year]: Row) => ({
    id,
    title,
    release_date: `${year}-03-14`,
    poster_path: `/${id}.jpg`,
    backdrop_path: `/${id}-backdrop.jpg`,
  });

  const searchPayload = (row: Row) => ({ page: 1, total_results: 1, results: [{ ...tmdbFields(row), genre_ids: [80, 18] }] });

  const detailsPayload = (row: Row) => ({
    ...tmdbFields(row),
    runtime: 105,
    genres: CREDITS[row[0]].genres.map((name, i) => ({ id: i, name })),
    credits: {
      cast: [{ id: 3, name: 'A Lead', character: 'The Professional' }],
      crew: [
        { id: 7, name: 'A Cutter', job: 'Editor' },
        { id: 8, name: CREDITS[row[0]].director, job: 'Director' },
      ],
    },
  });

  const HYDRATED: TheaterLineupItem[] = LINEUP_ROWS.map(([id, title, year, reason]) => ({
    id,
    title,
    year,
    posterPath: `/${id}.jpg`,
    backdropPath: `/${id}-backdrop.jpg`,
    genres: CREDITS[id].genres,
    director: CREDITS[id].director,
    mediaType: 'movie',
    reason,
  }));

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  function stubBoundaries(grokText: string = JSON.stringify(DRAFT)) {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (input: string, init?: { signal?: AbortSignal }) => {
      urls.push(input);
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (input === '/api/llm') return json({ text: grokText });
      const params = new URL(input).searchParams;
      const search = params.get('query');
      if (search) {
        const row = byTitle.get(search);
        return row && params.get('year') === row[2] ? json(searchPayload(row)) : json({ results: [] });
      }
      const row = byId.get(new URL(input).pathname.replace('/3/movie/', ''));
      return row ? json(detailsPayload(row)) : new Response('not found', { status: 404 });
    });
    return {
      urls,
      llmCalls: () => urls.filter((url) => url === '/api/llm').length,
      searches: () => urls.filter((url) => url.includes('/search/movie')).length,
      details: () => urls.filter((url) => /\/movie\/\d+\?/.test(url)).length,
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('turns a trail into a showing Theater on one Grok call and TMDB hydration', async () => {
    const tmdb = stubBoundaries();
    let inflight: Promise<Theater | null> = Promise.resolve(null);
    const app = harness((signals, signal) => (inflight = theaterInference('test-key')(signals, signal)));

    app.query('heat');
    await app.clock.advance(100);
    app.view(THIEF);
    await app.clock.advance(INFER_WAIT_MS);
    await inflight;
    await flush();

    expect(app.session).toEqual({
      status: 'showing',
      theater: {
        title: 'Men who are good at their jobs and lose anyway',
        facets: ['COMPETENCE PORN', 'NOBODY WINS'],
        insight: INSIGHT,
        swatches: FALLBACK_SWATCHES,
        sourceFilmIds: [10858],
        lineup: HYDRATED,
      },
      signals: TRAIL,
      fingerprint: TRAIL_FINGERPRINT,
      lastActiveAt: 100,
    });
    expect(tmdb.llmCalls()).toBe(1);
    expect(tmdb.urls[1]).toBe(
      'https://api.themoviedb.org/3/search/movie?api_key=test-key&language=en-US&query=Le+Samoura%C3%AF&year=1967',
    );
    expect(tmdb.searches()).toBe(8);
    expect(tmdb.details()).toBe(8);
  });

  it('carries genres, director, poster, and backdrop into every lineup card', async () => {
    const tmdb = stubBoundaries();
    const theater = await theaterInference('test-key')(
      [QUERY_THIEF, { kind: 'detail_view', film: HEAT, at: 200 }],
      new AbortController().signal,
    );

    expect(theater?.lineup[0]).toEqual({
      id: 5511,
      title: 'Le Samouraï',
      year: '1967',
      posterPath: '/5511.jpg',
      backdropPath: '/5511-backdrop.jpg',
      genres: ['Crime', 'Drama'],
      director: 'Jean-Pierre Melville',
      mediaType: 'movie',
      reason: 'A contract killer follows his routine flawlessly and it still closes on him.',
    });
    expect(theater?.lineup.map((item) => item.director)).toEqual([
      'Jean-Pierre Melville',
      'William Friedkin',
      'Michael Mann',
      'Peter Yates',
      'William Friedkin',
      'Joel Coen',
      'Denis Villeneuve',
      'Nicolas Winding Refn',
    ]);
    expect(tmdb.details()).toBe(8);
  });

  it('publishes nothing once the caller aborts, and never reads details', async () => {
    const tmdb = stubBoundaries();
    const controller = new AbortController();
    controller.abort();

    const theater = await theaterInference('test-key')(
      [{ kind: 'query', text: 'nitroglycerin', mode: 'ai-curated', at: 0 }, VIEW_THIEF],
      controller.signal,
    );

    expect(theater).toBeNull();
    expect(tmdb.details()).toBe(0);
  });

  it('publishes nothing when Grok returns a truncated draft', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const tmdb = stubBoundaries('{"title": "Men who are good at their jobs and');

    const theater = await theaterInference('test-key')(
      [{ kind: 'query', text: 'sodium vapour', mode: 'ai-curated', at: 0 }, VIEW_THIEF],
      new AbortController().signal,
    );

    expect(theater).toBeNull();
    expect(tmdb.llmCalls()).toBe(1);
    expect(tmdb.searches()).toBe(0);
  });
});
