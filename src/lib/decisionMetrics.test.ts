import { describe, expect, it, vi } from 'vitest';
import {
  commitRate,
  createAnalytics,
  decisionTimes,
  DecisionTimer,
  type LoggedEvent,
} from './decisionMetrics';

describe('DecisionTimer', () => {
  it('measures from construction', () => {
    const timer = new DecisionTimer(1000);
    expect(timer.elapsed(9000)).toBe(8000);
  });

  it('restarts on reset', () => {
    const timer = new DecisionTimer(1000);
    timer.reset(5000);
    expect(timer.elapsed(9000)).toBe(4000);
  });

  it('never reports negative time if the clock goes backwards', () => {
    expect(new DecisionTimer(9000).elapsed(1000)).toBe(0);
  });
});

describe('createAnalytics', () => {
  it('stamps events and keeps them in order', () => {
    let now = 100;
    const analytics = createAnalytics(() => {}, () => now);

    analytics.track({ name: 'session_start', queueHit: true, queueSize: 12 });
    now = 250;
    analytics.track({ name: 'picks_rejected', msSinceOpen: 150 });

    expect(analytics.history().map((e) => [e.name, e.at])).toEqual([
      ['session_start', 100],
      ['picks_rejected', 250],
    ]);
  });

  it('forwards every event to the sink', () => {
    const sink = vi.fn();
    createAnalytics(sink).track({ name: 'session_start', queueHit: false, queueSize: 0 });
    expect(sink).toHaveBeenCalledOnce();
  });

  it('survives a sink that throws, because telemetry must not break the app', () => {
    const analytics = createAnalytics(() => {
      throw new Error('firestore offline');
    });

    expect(() => analytics.track({ name: 'picks_rejected', msSinceOpen: 1 })).not.toThrow();
    expect(analytics.history()).toHaveLength(1);
  });

  it('survives a sink that rejects asynchronously', async () => {
    const analytics = createAnalytics(() => Promise.reject(new Error('permission denied')));

    expect(() => analytics.track({ name: 'picks_rejected', msSinceOpen: 1 })).not.toThrow();
    await Promise.resolve();
    expect(analytics.history()).toHaveLength(1);
  });

  it('hands back a copy so callers cannot mutate the log', () => {
    const analytics = createAnalytics(() => {});
    analytics.track({ name: 'picks_rejected', msSinceOpen: 1 });
    analytics.history().length = 0;
    expect(analytics.history()).toHaveLength(1);
  });
});

const event = (e: Partial<LoggedEvent> & { name: LoggedEvent['name'] }) =>
  ({ at: 0, ...e }) as LoggedEvent;

describe('decisionTimes', () => {
  it('reports each commit rather than averaging them away', () => {
    const events = [
      event({ name: 'session_start', queueHit: true, queueSize: 12 }),
      event({ name: 'pick_committed', movieId: 1, action: 'play', position: 0, msSinceOpen: 8200 }),
      event({ name: 'pick_committed', movieId: 2, action: 'log', position: 2, msSinceOpen: 31000 }),
    ];

    expect(decisionTimes(events)).toEqual([8200, 31000]);
  });

  it('is empty when nothing was committed', () => {
    expect(decisionTimes([event({ name: 'picks_rejected', msSinceOpen: 5000 })])).toEqual([]);
  });
});

describe('commitRate', () => {
  it('measures commits against sessions', () => {
    const events = [
      event({ name: 'session_start', queueHit: true, queueSize: 12 }),
      event({ name: 'session_start', queueHit: true, queueSize: 12 }),
      event({ name: 'pick_committed', movieId: 1, action: 'play', position: 0, msSinceOpen: 9000 }),
    ];

    expect(commitRate(events)).toBe(0.5);
  });

  it('is 0 with no sessions rather than dividing by zero', () => {
    expect(commitRate([])).toBe(0);
  });

  it('caps at 1 when a session produces several commits', () => {
    const events = [
      event({ name: 'session_start', queueHit: true, queueSize: 12 }),
      event({ name: 'pick_committed', movieId: 1, action: 'play', position: 0, msSinceOpen: 9000 }),
      event({ name: 'pick_committed', movieId: 2, action: 'log', position: 1, msSinceOpen: 12000 }),
    ];

    expect(commitRate(events)).toBe(1);
  });
});
