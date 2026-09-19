import { fingerprint } from './fingerprint';
import { appendSignal, gateOpen, IDLE_CLOSE_MS, waitRemaining } from './gate';
import type { TheaterEvent, TheaterSession, TheaterSignal } from './types';

export const IDLE_SESSION: TheaterSession = { status: 'idle' };

type LiveSession = Extract<TheaterSession, { lastActiveAt: number }>;

function isLive(session: TheaterSession): session is LiveSession {
  return 'lastActiveAt' in session;
}

function collecting(signals: TheaterSignal[], lastActiveAt: number, failedFingerprint: string | null = null): TheaterSession {
  return { status: 'collecting', signals, lastActiveAt, failedFingerprint };
}

function signalTime(signal: TheaterSignal): number | null {
  return signal.kind === 'dwell' ? null : signal.at;
}

function startSession(signal: TheaterSignal): TheaterSession | null {
  if (signal.kind === 'dwell') return null;
  const signals = appendSignal([], signal);
  return signals && collecting(signals, signal.at);
}

export function inferDue(session: TheaterSession, now: number): boolean {
  return (
    session.status === 'collecting' &&
    gateOpen(session.signals) &&
    waitRemaining(session.lastActiveAt, now) === 0 &&
    fingerprint(session.signals) !== session.failedFingerprint
  );
}

function withSignal(session: TheaterSession, signal: TheaterSignal): TheaterSession {
  switch (session.status) {
    case 'idle':
    case 'kept':
    case 'closed':
      return startSession(signal) ?? session;
    case 'collecting': {
      const signals = appendSignal(session.signals, signal);
      if (!signals) return session;
      return collecting(signals, signalTime(signal) ?? session.lastActiveAt, session.failedFingerprint);
    }
    case 'inferring': {
      const signals = appendSignal(session.signals, signal);
      if (!signals) return session;
      if (fingerprint(signals) === session.fingerprint) return { ...session, signals };
      return collecting(signals, signalTime(signal) ?? session.lastActiveAt);
    }
    case 'showing': {
      const signals = appendSignal(session.signals, signal);
      if (!signals) return session;
      return { ...session, signals, lastActiveAt: signalTime(signal) ?? session.lastActiveAt };
    }
  }
}

export function theaterReducer(session: TheaterSession, event: TheaterEvent): TheaterSession {
  switch (event.type) {
    case 'signal':
      return withSignal(session, event.signal);
    case 'infer_started':
      if (session.status !== 'collecting' || !inferDue(session, event.now)) return session;
      return {
        status: 'inferring',
        signals: session.signals,
        revision: event.revision,
        fingerprint: fingerprint(session.signals),
        lastActiveAt: session.lastActiveAt,
      };
    case 'infer_succeeded':
      if (session.status !== 'inferring' || session.revision !== event.revision) return session;
      return {
        status: 'showing',
        theater: event.theater,
        signals: session.signals,
        fingerprint: session.fingerprint,
        lastActiveAt: session.lastActiveAt,
      };
    case 'infer_failed':
      if (session.status !== 'inferring' || session.revision !== event.revision) return session;
      return collecting(session.signals, session.lastActiveAt, session.fingerprint);
    case 'keep':
      return session.status === 'showing' ? { status: 'kept', theater: session.theater, keptId: session.fingerprint } : session;
    case 'dismiss':
      return isLive(session) ? { status: 'closed', reason: 'dismissed' } : session;
    case 'expire':
      return isLive(session) && event.now - session.lastActiveAt >= IDLE_CLOSE_MS ? { status: 'closed', reason: 'idle' } : session;
    case 'sign_out':
      return { status: 'closed', reason: 'signed_out' };
  }
}
