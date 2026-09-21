import { appendSignal } from './gate';
import { IDLE_SESSION } from './session';
import { isRecord, parseTheater, parseTheaterSignal, type TheaterSession, type TheaterSignal } from './types';

export const THEATER_SESSION_VERSION = 2;

export function theaterSessionKey(uid: string): string {
  return `theater-session:v${THEATER_SESSION_VERSION}:${uid}`;
}

function sessionForStorage(session: TheaterSession): TheaterSession | null {
  switch (session.status) {
    case 'collecting':
    case 'showing':
      return session;
    case 'inferring':
      return { status: 'collecting', signals: session.signals, lastActiveAt: session.lastActiveAt, failedFingerprint: null };
    case 'idle':
    case 'kept':
    case 'closed':
      return null;
  }
}

export function saveTheaterSession(storage: Storage, uid: string, session: TheaterSession): void {
  const key = theaterSessionKey(uid);
  const stored = sessionForStorage(session);
  if (stored) storage.setItem(key, JSON.stringify(stored));
  else storage.removeItem(key);
}

export function loadTheaterSession(storage: Storage, uid: string): TheaterSession {
  const key = theaterSessionKey(uid);
  const raw = storage.getItem(key);
  if (raw === null) return IDLE_SESSION;
  const session = parseStoredSession(raw);
  if (!session) storage.removeItem(key);
  return session ?? IDLE_SESSION;
}

function parseSignals(raw: unknown): TheaterSignal[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: TheaterSignal[] = [];
  for (const item of raw) {
    const signal = parseTheaterSignal(item);
    if (!signal) return null;
    parsed.push(signal);
  }
  return parsed.reduce<TheaterSignal[]>((signals, signal) => appendSignal(signals, signal) ?? signals, []);
}

function parseStoredSession(raw: string): TheaterSession | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(json)) return null;
  const signals = parseSignals(json.signals);
  const lastActiveAt = json.lastActiveAt;
  if (!signals || typeof lastActiveAt !== 'number' || !Number.isFinite(lastActiveAt)) return null;
  switch (json.status) {
    case 'collecting': {
      const failed = json.failedFingerprint;
      if (typeof failed !== 'string' && failed !== null) return null;
      return { status: 'collecting', signals, lastActiveAt, failedFingerprint: failed };
    }
    case 'showing': {
      const theater = parseTheater(json.theater);
      if (!theater || typeof json.fingerprint !== 'string') return null;
      return { status: 'showing', theater, signals, fingerprint: json.fingerprint, lastActiveAt };
    }
    default:
      return null;
  }
}
