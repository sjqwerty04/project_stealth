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

    const persist = async (stats: TasteStats, profile: SelectsProfile, source: 'grok' | 'template') => {
      try {
        await setDoc(
          doc(db, 'users', uid, 'profile_data', 'selects_profile'),
          { stats, profile, source, createdAt: serverTimestamp(), version: 1 },
          { merge: true },
        );
      } catch (e) {
        console.error('Failed to persist selects profile:', e);
      }
    };

    const settle = (stats: TasteStats, profile: SelectsProfile, source: 'grok' | 'template') => {
      if (settled || cancelled) return;
      settled = true;
      dispatch({ type: 'statsReady', stats });
      dispatch({ type: 'profileReady', profile });
      void persist(stats, profile, source);
      const wait = Math.max(0, READING_MIN_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (!cancelled) dispatch({ type: 'goto', step: 'negativeProfile' });
      }, wait);
    };

    const emptyInput = { films: [], nights: [], positive: state.positive, negative: state.negative, axes: state.axes, sources, uid };

    (async () => {
      let input = emptyInput as Awaited<ReturnType<typeof loadStatsInput>>;
      try {
        input = await loadStatsInput(uid, { positive: state.positive, negative: state.negative, axes: state.axes, sources });
      } catch (e) {
        console.error('Reading could not load the library:', e);
      }
      if (cancelled) return;

      // Grok gets the numbers now. The colour arrives later and is rendered by the client, never quoted by the model.
      const early = computeTasteStats(input, '', 0);
      const profilePromise = fetchProfile(early, picks, controller.signal).catch(() => null);

      const posters = input.films.map((f) => f.poster).filter((p): p is string => !!p);
      const total = Math.min(posters.length, 60);
      setProgress({ count: input.films.filter((f) => f.watched).length, sampled: 0, total, colours: [] });
      let colours: string[] = [];
      try {
        colours = await samplePosterColours(posters, {
          onProgress: (done) => {
            if (!cancelled) setProgress((p) => ({ ...p, sampled: done }));
          },
        });
      } catch (e) {
        console.error('Poster sampling failed:', e);
      }
      if (cancelled) return;
      setProgress((p) => ({ ...p, colours }));
      const stats: TasteStats = computeTasteStats(input, oklabCentroid(colours), colours.length);
      const fallback = templateProfile(stats);

      const remaining = Math.max(0, READING_MAX_MS - (Date.now() - startedAt));
      const profile = await Promise.race([
        profilePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
      ]);
      if (profile) {
        settle(stats, profile, 'grok');
        return;
      }
      // The deadline passed. Show the template now and let the model's read replace it when it lands.
      settle(stats, fallback, 'template');
      const late = await profilePromise;
      if (late && !cancelled) {
        dispatch({ type: 'profileReady', profile: late });
        void persist(stats, late, 'grok');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [step, uid, positive, negative, axes, imports, dispatch]);

  return progress;
}
