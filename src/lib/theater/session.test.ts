import { describe, expect, it } from 'vitest';
import { IDLE_CLOSE_MS } from './gate';
import { IDLE_SESSION, inferDue, theaterReducer } from './session';
import {
  FALLBACK_SWATCHES,
  type QueryMode,
  type Theater,
  type TheaterEvent,
  type TheaterFilm,
  type TheaterLineupItem,
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

const COLLATERAL: TheaterFilm = {
  id: 1538,
  title: 'Collateral',
  year: '2004',
  posterPath: '/collateral.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};

const LINEUP_ROWS: [number, string, string, string][] = [
  [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
  [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
  [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
  [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
  [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
  [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
];
const LINEUP: TheaterLineupItem[] = LINEUP_ROWS.map(([id, title, year, reason]) => ({
  id,
  title,
  year,
  posterPath: null,
  backdropPath: null,
  genres: [],
  director: null,
  mediaType: 'movie',
  reason,
}));

const THEATER: Theater = {
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep opening films where the plan is perfect and the ending is not.',
  swatches: FALLBACK_SWATCHES,
  sourceFilmIds: [949, 10858, 1538],
  trail: [HEAT, THIEF, COLLATERAL],
  lineup: LINEUP,
};
const LATER_THEATER: Theater = { ...THEATER, title: 'Night shifts and the men who cannot clock out', facets: ['NOCTURNAL', 'WORK IS THE PLOT'] };

const querySignal = (text: string, at: number, mode: QueryMode = 'standard'): TheaterSignal => ({ kind: 'query', text, mode, at });
const signal = (s: TheaterSignal): TheaterEvent => ({ type: 'signal', signal: s });
const query = (text: string, at: number, mode: QueryMode = 'standard'): TheaterEvent => signal(querySignal(text, at, mode));
const view = (film: TheaterFilm, at: number): TheaterEvent => signal({ kind: 'detail_view', film, at });
const dwell = (filmId: number, ms: number, engaged: boolean): TheaterEvent => signal({ kind: 'dwell', filmId, ms, engaged });
const start = (revision: number, now: number): TheaterEvent => ({ type: 'infer_started', revision, now });
const succeed = (revision: number, theater: Theater): TheaterEvent => ({ type: 'infer_succeeded', revision, theater });
const fail = (revision: number): TheaterEvent => ({ type: 'infer_failed', revision });

const run = (...events: TheaterEvent[]) => events.reduce(theaterReducer, IDLE_SESSION);

describe('gate paths into inferring', () => {
  it('three unique films', () => {
    const session = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000), start(1, 4500));
    expect(session).toMatchObject({ status: 'inferring', revision: 1, lastActiveAt: 2000 });
  });

  it('stays collecting on two unique queries', () => {
    expect(run(query('heat', 0), query('thief', 1000), start(1, 3500))).toMatchObject({ status: 'collecting' });
  });

  it('stays collecting on two unique films', () => {
    expect(run(view(HEAT, 0), view(THIEF, 1000), start(1, 3500))).toMatchObject({ status: 'collecting' });
  });

  it('stays collecting on one query plus one film', () => {
    expect(run(query('heat', 0), view(THIEF, 1000), start(1, 3500))).toMatchObject({ status: 'collecting' });
  });

  it('stays collecting on one AI-curated query', () => {
    expect(run(query('men who are good at their jobs and lose anyway', 0, 'ai-curated'), start(1, 2500))).toMatchObject({
      status: 'collecting',
    });
  });

  it('one plain query stays collecting no matter how long it waits', () => {
    expect(run(query('heat', 0), start(1, 60_000))).toEqual({
      status: 'collecting',
      signals: [querySignal('heat', 0)],
      lastActiveAt: 0,
      failedFingerprint: null,
    });
  });

  it('waits 2500 ms after the last new unique signal', () => {
    const collectingState = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000));
    expect(inferDue(collectingState, 4499)).toBe(false);
    expect(inferDue(collectingState, 4500)).toBe(true);
    expect(theaterReducer(collectingState, start(1, 4499))).toBe(collectingState);
  });
});

describe('evidence uniqueness', () => {
  it('keeps a duplicate film landing idempotent', () => {
    const once = run(view(HEAT, 0));
    const twice = theaterReducer(once, view({ ...HEAT, title: 'HEAT' }, 900));
    expect(twice).toBe(once);
    expect(twice).toEqual({ status: 'collecting', signals: [{ kind: 'detail_view', film: HEAT, at: 0 }], lastActiveAt: 0, failedFingerprint: null });
  });

  it('keeps "heat" then "heat night" as one committed query and restarts the wait', () => {
    const session = run(query('heat', 0), query('heat night', 800));
    expect(session).toEqual({
      status: 'collecting',
      signals: [{ kind: 'query', text: 'heat night', mode: 'standard', at: 800 }],
      lastActiveAt: 800,
      failedFingerprint: null,
    });
  });

  it('ignores a dwell before any film opened', () => {
    expect(run(dwell(949, 3000, false))).toBe(IDLE_SESSION);
  });

  it('records a dwell without moving the wait clock', () => {
    const session = run(view(HEAT, 0), dwell(949, 15000, true));
    expect(session).toMatchObject({ status: 'collecting', lastActiveAt: 0 });
    expect(session.status === 'collecting' && session.signals).toEqual([
      { kind: 'detail_view', film: HEAT, at: 0 },
      { kind: 'dwell', filmId: 949, ms: 15000, engaged: true },
    ]);
  });
});

describe('inference results', () => {
  const TRAIL = [
    { kind: 'detail_view', film: HEAT, at: 0 } satisfies TheaterSignal,
    { kind: 'detail_view', film: THIEF, at: 1000 } satisfies TheaterSignal,
    { kind: 'detail_view', film: COLLATERAL, at: 2000 } satisfies TheaterSignal,
  ];
  const inferring = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000), start(1, 4500));

  it('publishes the theater for the matching revision', () => {
    expect(theaterReducer(inferring, succeed(1, THEATER))).toEqual({
      status: 'showing',
      theater: THEATER,
      signals: TRAIL,
      fingerprint: inferring.status === 'inferring' ? inferring.fingerprint : '',
      lastActiveAt: 2000,
    });
  });

  it('rejects stale revision 1 once revision 2 has published', () => {
    const afterNewEvidence = theaterReducer(inferring, query('night', 4000));
    expect(afterNewEvidence).toMatchObject({ status: 'collecting', lastActiveAt: 4000 });
    const showingLater = theaterReducer(theaterReducer(afterNewEvidence, start(2, 6500)), succeed(2, LATER_THEATER));
    expect(showingLater).toMatchObject({ status: 'showing', theater: { title: LATER_THEATER.title } });
    const afterStale = theaterReducer(showingLater, succeed(1, THEATER));
    expect(afterStale).toBe(showingLater);
    expect(afterStale.status === 'showing' && afterStale.theater.title).toBe('Night shifts and the men who cannot clock out');
  });

  it('rejects stale revision 1 while revision 2 is still in flight', () => {
    const inFlight = theaterReducer(theaterReducer(inferring, query('night', 4000)), start(2, 6500));
    expect(inFlight).toMatchObject({ status: 'inferring', revision: 2 });
    expect(theaterReducer(inFlight, succeed(1, THEATER))).toBe(inFlight);
    expect(theaterReducer(inFlight, fail(1))).toBe(inFlight);
  });

  it('keeps inferring when a dwell arrives, since the fingerprint is unchanged', () => {
    const withDwell = theaterReducer(inferring, dwell(949, 12000, true));
    expect(withDwell).toMatchObject({ status: 'inferring', revision: 1 });
    expect(inferring.status === 'inferring' && withDwell.status === 'inferring' && withDwell.fingerprint === inferring.fingerprint).toBe(true);
    expect(withDwell.status === 'inferring' && withDwell.signals).toHaveLength(4);
  });

  it('returns a failure to collecting and blocks retry until the evidence changes', () => {
    const failed = theaterReducer(inferring, fail(1));
    expect(failed).toEqual({
      status: 'collecting',
      signals: TRAIL,
      lastActiveAt: 2000,
      failedFingerprint: inferring.status === 'inferring' ? inferring.fingerprint : '',
    });
    expect(inferDue(failed, 90_000)).toBe(false);
    expect(theaterReducer(failed, start(2, 90_000))).toBe(failed);

    const withNewFilm = theaterReducer(failed, query('night', 91_000));
    expect(withNewFilm).toMatchObject({ status: 'collecting', failedFingerprint: inferring.status === 'inferring' ? inferring.fingerprint : '' });
    expect(inferDue(withNewFilm, 93_500)).toBe(true);
    expect(theaterReducer(withNewFilm, start(2, 93_500))).toMatchObject({ status: 'inferring', revision: 2 });
  });

  it('ignores results that arrive while collecting', () => {
    const collectingState = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000));
    expect(theaterReducer(collectingState, succeed(1, THEATER))).toBe(collectingState);
  });
});

describe('showing', () => {
  const showing = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000), start(1, 4500), succeed(1, THEATER));

  it('keeps the same theater when another film is opened', () => {
    const next = theaterReducer(
      showing,
      view(
        {
          id: 5511,
          title: 'Le Samouraï',
          year: '1967',
          posterPath: null,
          backdropPath: null,
          genres: [],
          director: null,
          mediaType: 'movie',
        },
        20_000,
      ),
    );
    expect(next).toMatchObject({ status: 'showing', theater: THEATER, lastActiveAt: 20_000 });
  });

  it('keeps under the fingerprint as the document id', () => {
    expect(theaterReducer(showing, { type: 'keep' })).toEqual({
      status: 'kept',
      theater: THEATER,
      keptId: showing.status === 'showing' ? showing.fingerprint : '',
    });
  });

  it('cannot keep before a theater exists', () => {
    const collectingState = run(query('heat', 0));
    expect(theaterReducer(collectingState, { type: 'keep' })).toBe(collectingState);
  });

  it('dismisses to an explicit closed reason', () => {
    expect(theaterReducer(showing, { type: 'dismiss' })).toEqual({ status: 'closed', reason: 'dismissed' });
    expect(theaterReducer(IDLE_SESSION, { type: 'dismiss' })).toBe(IDLE_SESSION);
  });

  it('starts a fresh trail after dismiss or keep', () => {
    const afterDismiss = theaterReducer(theaterReducer(showing, { type: 'dismiss' }), view(THIEF, 30_000));
    expect(afterDismiss).toEqual({ status: 'collecting', signals: [{ kind: 'detail_view', film: THIEF, at: 30_000 }], lastActiveAt: 30_000, failedFingerprint: null });
    const afterKeep = theaterReducer(theaterReducer(showing, { type: 'keep' }), query('sorcerer', 31_000));
    expect(afterKeep).toMatchObject({ status: 'collecting', lastActiveAt: 31_000 });
  });
});

describe('closing', () => {
  it('signs out from any state', () => {
    expect(theaterReducer(run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000), start(1, 4500)), { type: 'sign_out' })).toEqual({
      status: 'closed',
      reason: 'signed_out',
    });
    expect(theaterReducer(IDLE_SESSION, { type: 'sign_out' })).toEqual({ status: 'closed', reason: 'signed_out' });
  });

  it('expires after 30 minutes without a new signal, and not one millisecond sooner', () => {
    const showing = run(view(HEAT, 0), view(THIEF, 1000), view(COLLATERAL, 2000), start(1, 4500), succeed(1, THEATER));
    expect(theaterReducer(showing, { type: 'expire', now: 2000 + IDLE_CLOSE_MS - 1 })).toBe(showing);
    expect(theaterReducer(showing, { type: 'expire', now: 2000 + IDLE_CLOSE_MS })).toEqual({ status: 'closed', reason: 'idle' });
    expect(theaterReducer(IDLE_SESSION, { type: 'expire', now: 10 * IDLE_CLOSE_MS })).toBe(IDLE_SESSION);
  });
});
