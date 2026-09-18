export type OrbitTimingPhase =
  | 'gesture-to-card'
  | 'recommendation'
  | 'llm'
  | 'tmdb-search'
  | 'tmdb-details';

export interface OrbitTiming {
  phase: OrbitTimingPhase;
  durationMs: number;
  sourceMovieId?: number;
  direction?: string;
  cacheState?: 'ready' | 'loading' | 'miss';
}

declare global {
  interface Window {
    __ORBIT_TIMINGS__?: OrbitTiming[];
  }
}

export function recordOrbitTiming(timing: OrbitTiming): void {
  if (typeof window === 'undefined') return;
  const timings = window.__ORBIT_TIMINGS__ ?? [];
  timings.push(timing);
  window.__ORBIT_TIMINGS__ = timings.slice(-100);
}
