import { useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { oklabCentroid, samplePosterColours } from '../../lib/onboarding/colour';
import { computeTasteStats, loadStatsInput } from '../../lib/onboarding/stats';
import { parseSelectsProfile, templateProfile, type SelectsProfile, type TasteStats } from '../../lib/onboarding/profile';
import type { OnboardingAction, OnboardingState } from '../../lib/onboarding/state';

export const READING_MIN_MS = 2500;
export const READING_MAX_MS = 12000;

export type ReadingProgress = { count: number; sampled: number; total: number; colours: string[] };

async function fetchProfile(stats: TasteStats, picks: { positive: string[]; negative: string[]; axes: string[] }, signal: AbortSignal) {
  const res = await fetch('/api/selects-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats, picks }),
    signal,
  });
  if (!res.ok) throw new Error(`selects-profile ${res.status}`);
  const data = (await res.json()) as { profile?: unknown };
  return parseSelectsProfile(data.profile);
}

/**
 * Drives the Reading screen. Samples poster colours, computes stats, asks Grok for the reads,
 * then advances once both the work and the minimum dwell are done. Never blocks past READING_MAX_MS.
 */
export function useReading(state: OnboardingState, dispatch: (a: OnboardingAction) => void, uid: string | null) {
  const [progress, setProgress] = useState<ReadingProgress>({ count: 0, sampled: 0, total: 0, colours: [] });
  const started = useRef(false);
  const { step, positive, negative, axes, imports } = state;

  useEffect(() => {
    if (step !== 'reading' || !uid || started.current) return;
    started.current = true;
    const state = { positive, negative, axes, imports };
    const controller = new AbortController();
    const startedAt = Date.now();
    let cancelled = false;
    let settled = false;

    const picks = {
      positive: state.positive.map((f) => f.title),
      negative: state.negative.map((f) => f.title),
      axes: state.axes,
    };
    const sources = (Object.keys(state.imports) as (keyof typeof state.imports)[]).filter(
      (k) => state.imports[k].status === 'done',
    );

    const settle = async (stats: TasteStats, profile: SelectsProfile) => {
      if (settled || cancelled) return;
      settled = true;
      dispatch({ type: 'statsReady', stats });
      dispatch({ type: 'profileReady', profile });
      try {
        await setDoc(
          doc(db, 'users', uid, 'profile_data', 'selects_profile'),
          { stats, profile, createdAt: serverTimestamp(), version: 1 },
          { merge: true },
        );
      } catch (e) {
        console.error('Failed to persist selects profile:', e);
      }
      const wait = Math.max(0, READING_MIN_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (!cancelled) dispatch({ type: 'goto', step: 'negativeProfile' });
      }, wait);
    };

    (async () => {
      let stats: TasteStats | null = null;
      try {
        const input = await loadStatsInput(uid, { positive: state.positive, negative: state.negative, axes: state.axes, sources });
        const posters = input.films.map((f) => f.poster).filter((p): p is string => !!p);
        const total = Math.min(posters.length, 60);
        setProgress({ count: input.films.filter((f) => f.watched).length, sampled: 0, total, colours: [] });
        const colours = await samplePosterColours(posters, {
          onProgress: (done) => {
            if (!cancelled) setProgress((p) => ({ ...p, sampled: done }));
          },
        });
        if (cancelled) return;
        setProgress((p) => ({ ...p, colours }));
        stats = computeTasteStats(input, oklabCentroid(colours), colours.length);
      } catch (e) {
        console.error('Reading failed:', e);
        stats = computeTasteStats(
          { films: [], nights: [], positive: state.positive, negative: state.negative, axes: state.axes, sources, uid },
          '#3A6E85',
          0,
        );
      }
      if (cancelled) return;
      const fallback = templateProfile(stats);
      const remaining = READING_MAX_MS - (Date.now() - startedAt);
      const timeout = setTimeout(() => {
        controller.abort();
        settle(stats!, fallback);
      }, Math.max(0, remaining));
      try {
        const profile = await fetchProfile(stats, picks, controller.signal);
        clearTimeout(timeout);
        settle(stats, profile ?? fallback);
      } catch {
        clearTimeout(timeout);
        settle(stats, fallback);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [step, uid, positive, negative, axes, imports, dispatch]);

  return progress;
}
