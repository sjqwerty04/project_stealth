import { filmIdentity, type TheaterFilm, type TheaterSignal } from './types';

export const INFER_WAIT_MS = 2500;
export const IDLE_CLOSE_MS = 30 * 60 * 1000;

type QuerySignal = Extract<TheaterSignal, { kind: 'query' }>;
type DetailSignal = Extract<TheaterSignal, { kind: 'detail_view' }>;

export function normalizeQuery(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function queriesOf(signals: readonly TheaterSignal[]): QuerySignal[] {
  return signals.filter((s): s is QuerySignal => s.kind === 'query');
}

export function filmsOf(signals: readonly TheaterSignal[]): TheaterFilm[] {
  return signals.filter((s): s is DetailSignal => s.kind === 'detail_view').map((s) => s.film);
}

export function appendSignal(signals: readonly TheaterSignal[], signal: TheaterSignal): TheaterSignal[] | null {
  switch (signal.kind) {
    case 'query': {
      const text = normalizeQuery(signal.text);
      if (!text) return null;
      const queries = queriesOf(signals);
      const last = queries.at(-1);
      if (last) {
        const lastText = normalizeQuery(last.text);
        if (lastText === text) return null;
        if (text.startsWith(lastText) || lastText.startsWith(text)) {
          return signals.map((s) => (s === last ? signal : s));
        }
      }
      if (queries.some((q) => normalizeQuery(q.text) === text)) return null;
      return [...signals, signal];
    }
    case 'detail_view': {
      const identity = filmIdentity(signal.film);
      return filmsOf(signals).some((film) => filmIdentity(film) === identity) ? null : [...signals, signal];
    }
    case 'dwell':
      return [...signals, signal];
  }
}

export function gateOpen(signals: readonly TheaterSignal[]): boolean {
  const queries = queriesOf(signals);
  const evidence = queries.length + filmsOf(signals).length;
  return evidence >= 2 || queries.some((q) => q.mode === 'ai-curated');
}

export function waitRemaining(lastActiveAt: number, now: number): number {
  return Math.max(0, lastActiveAt + INFER_WAIT_MS - now);
}
