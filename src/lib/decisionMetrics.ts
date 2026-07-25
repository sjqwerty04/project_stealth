/**
 * Decision-path instrumentation.
 *
 * The product claim is a number — "ten seconds instead of twenty minutes" — and
 * right now nothing in the app measures it. These events exist so that claim can
 * be checked against reality on day one rather than argued about.
 *
 * The one metric that matters is time from app open to a committed decision.
 * Everything else here is diagnostic: if that number is bad, these say why.
 */

export type CommitAction = 'play' | 'tonight' | 'log';

export type AnalyticsEvent =
  /** App opened. queueHit tells us whether the warm queue did its job. */
  | { name: 'session_start'; queueHit: boolean; queueSize: number }
  | { name: 'constraints_set'; constraints: string; msSinceOpen: number }
  /** Picks rendered. This is the moment the user can actually decide. */
  | { name: 'picks_shown'; count: number; relaxedRuntime: boolean; msSinceOpen: number }
  /** The event the product is judged on. */
  | { name: 'pick_committed'; movieId: number; action: CommitAction; position: number; msSinceOpen: number }
  /** All picks rejected — the failure mode that sends people back to scrolling. */
  | { name: 'picks_rejected'; msSinceOpen: number }
  | { name: 'queue_refilled'; size: number; durationMs: number }
  | { name: 'queue_refill_failed'; reason: string };

export type LoggedEvent = AnalyticsEvent & { at: number };

export type AnalyticsSink = (event: LoggedEvent) => void | Promise<void>;

/**
 * Wall-clock from app open. Session-scoped rather than screen-scoped: the user's
 * twenty minutes was never spent on one screen, so measuring one screen would
 * flatter us.
 */
export class DecisionTimer {
  private startedAt: number;

  constructor(now: number = Date.now()) {
    this.startedAt = now;
  }

  reset(now: number = Date.now()): void {
    this.startedAt = now;
  }

  elapsed(now: number = Date.now()): number {
    return Math.max(0, now - this.startedAt);
  }
}

export type Analytics = {
  track: (event: AnalyticsEvent) => void;
  /** Events recorded so far this session, oldest first. */
  history: () => LoggedEvent[];
};

/**
 * Instrumentation must never be able to break the thing it measures, so the sink
 * is fire-and-forget and every failure is swallowed after logging.
 */
export function createAnalytics(sink: AnalyticsSink, clock: () => number = Date.now): Analytics {
  const history: LoggedEvent[] = [];

  return {
    track(event) {
      const logged: LoggedEvent = { ...event, at: clock() };
      history.push(logged);
      try {
        void Promise.resolve(sink(logged)).catch((error) => {
          console.error('Analytics sink rejected:', error);
        });
      } catch (error) {
        console.error('Analytics sink threw:', error);
      }
    },
    history: () => [...history],
  };
}

/**
 * Time from open to commit for each decision in a session.
 *
 * Reported as a list rather than an average because the distribution is the
 * interesting part: a median of eight seconds with a long tail is a different
 * product from a consistent twelve.
 */
export function decisionTimes(events: LoggedEvent[]): number[] {
  return events
    .filter((e): e is LoggedEvent & { name: 'pick_committed' } => e.name === 'pick_committed')
    .map((e) => e.msSinceOpen);
}

/**
 * Share of sessions that ended in a commit.
 *
 * The counter-metric to speed: a fast app nobody decides in is not fast, it is
 * just quick to abandon.
 */
export function commitRate(events: LoggedEvent[]): number {
  const sessions = events.filter((e) => e.name === 'session_start').length;
  if (!sessions) return 0;
  const commits = events.filter((e) => e.name === 'pick_committed').length;
  return Math.min(1, commits / sessions);
}
