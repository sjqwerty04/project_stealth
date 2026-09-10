import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  LAST_PICKS_FRESH_MS,
  contextFromCalendarLogs,
  hasMeaningfulContext,
  mergeRecommendContext,
  recordTasteEvent,
  useTaste,
  type CalendarLogLike,
  type RecommendContext,
  type TastePick,
} from '../lib/taste';

export type RecommendationResult = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
  mediaType?: 'movie' | 'tv';
  reason: string;
  confidence: number;
};

export type SelectsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const inflight = new Map<string, Promise<RecommendationResult[]>>();

function formatRuntime(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function buildImageUrl(path: string | null | undefined, size: 'w200' | 'w500' | 'w780' = 'w500') {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function fromStored(pick: TastePick): RecommendationResult {
  return {
    movieId: pick.movieId,
    title: pick.title,
    year: pick.year,
    poster: pick.poster,
    backdrop: pick.backdrop,
    runtime: pick.runtime,
    mediaType: pick.mediaType,
    reason: pick.whyMatch,
    confidence: pick.confidence,
  };
}

async function hydrateFromApi(title: string, year?: string, id?: string): Promise<RecommendationResult | null> {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (title) params.set('title', title);
  if (year) params.set('year', String(year));
  try {
    const res = await fetch(`/api/movie-lookup?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id) return null;
    return {
      movieId: data.id,
      title: data.title || title,
      year: data.year || year || '',
      poster: data.poster || '',
      backdrop: data.backdrop || data.still || '',
      runtime: data.runtime || '',
      mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
      reason: '',
      confidence: 1,
    };
  } catch {
    return null;
  }
}

async function hydrateTitle(title: string, year?: string, id?: string): Promise<RecommendationResult | null> {
  const fromApi = await hydrateFromApi(title, year, id);
  if (fromApi) return fromApi;
  if (!TMDB_API_KEY) return null;
  const url = new URL(`${TMDB_BASE}/search/movie`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('year', year);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) return null;
  const detailsUrl = `${TMDB_BASE}/movie/${hit.id}?api_key=${TMDB_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const details = detailsRes.ok ? await detailsRes.json() : hit;
  return {
    movieId: details.id,
    title: details.title,
    year: details.release_date?.slice(0, 4) || year || '',
    poster: buildImageUrl(details.poster_path),
    backdrop: buildImageUrl(details.backdrop_path, 'w780'),
    runtime: formatRuntime(details.runtime),
    mediaType: 'movie',
    reason: '',
    confidence: 1,
  };
}

export function useRecommendation(opts?: { events?: CalendarLogLike[] }) {
  const { user } = useAuth();
  const { snapshot } = useTaste();
  const [picks, setPicks] = useState<RecommendationResult[]>([]);
  const [status, setStatus] = useState<SelectsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const diaryKey = (opts?.events ?? [])
    .map((e) => `${e.movieId ?? ''}:${e.title}:${e.rating ?? ''}:${e.date ?? ''}`)
    .join('|');

  const context = useMemo((): RecommendContext => {
    return mergeRecommendContext(contextFromCalendarLogs(opts?.events ?? []), snapshot.context);
  }, [diaryKey, snapshot.context]);

  const generateRecommendation = useCallback(async (force = false): Promise<RecommendationResult[] | null> => {
    if (!user) {
      setError('Not authenticated');
      setStatus('error');
      return null;
    }

    const storedAt = snapshot.generated.lastPicksAt;
    const stored = snapshot.generated.lastPicks.map(fromStored);
    if (!force && stored.length && storedAt && Date.now() - storedAt < LAST_PICKS_FRESH_MS) {
      setPicks(stored);
      setStatus('ready');
      return stored;
    }

    if (!hasMeaningfulContext(context)) {
      setPicks([]);
      setStatus('empty');
      return [];
    }

    const existing = inflight.get(user.uid);
    if (existing) {
      const shared = await existing;
      setPicks(shared);
      setStatus(shared.length ? 'ready' : 'empty');
      return shared;
    }

    const run = (async () => {
      setStatus(stored.length ? 'ready' : 'loading');
      setError(null);
      try {
        const res = await fetch('/api/your-selects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });
        const data = res.ok ? await res.json() : { picks: [] };
        const raw = Array.isArray(data.picks) ? data.picks : [];
        const hydrated = (
          await Promise.all(
            raw.map(async (pick: { title: string; year?: string; whyMatch?: string; confidence?: number; id?: string }) => {
              const film = await hydrateTitle(pick.title, pick.year, pick.id);
              if (!film) return null;
              return {
                ...film,
                reason: pick.whyMatch || '',
                confidence: typeof pick.confidence === 'number' ? pick.confidence : 1,
              } satisfies RecommendationResult;
            })
          )
        ).filter((row): row is RecommendationResult => row != null);

        setPicks(hydrated);
        setStatus(hydrated.length ? 'ready' : 'empty');
        if (hydrated.length) {
          try {
            await recordTasteEvent(
              user.uid,
              {
                type: 'last_picks',
                picks: hydrated.map((p) => ({
                  movieId: p.movieId,
                  title: p.title,
                  year: p.year,
                  poster: p.poster,
                  backdrop: p.backdrop,
                  runtime: p.runtime,
                  mediaType: p.mediaType,
                  whyMatch: p.reason,
                  confidence: p.confidence,
                })),
              },
              { email: user.email }
            );
          } catch (err) {
            console.warn('Your Selects cache write failed:', err);
          }
        }
        return hydrated;
      } catch (err) {
        console.error('Your Selects failed:', err);
        setError('Could not load Your Selects');
        setStatus(stored.length ? 'ready' : 'error');
        return stored.length ? stored : [];
      } finally {
        inflight.delete(user.uid);
      }
    })();

    inflight.set(user.uid, run);
    return run;
  }, [user, snapshot, context]);

  useEffect(() => {
    const stored = snapshot.generated.lastPicks.map(fromStored);
    if (stored.length) {
      setPicks(stored);
      setStatus('ready');
    }
    if (!user) {
      if (!stored.length) setStatus('idle');
      return;
    }
    if (!stored.length && !hasMeaningfulContext(context)) {
      setPicks([]);
      setStatus('empty');
      return;
    }
    if (!stored.length || !snapshot.generated.lastPicksAt || Date.now() - snapshot.generated.lastPicksAt >= LAST_PICKS_FRESH_MS) {
      void generateRecommendation(false);
    }
  }, [user, snapshot, context, generateRecommendation]);

  const rateRecommendation = useCallback(
    async (rec: RecommendationResult, rating: 'up' | 'down') => {
      if (!user) return;
      const watchedRef = collection(db, 'users', user.uid, 'watched_recommendations');
      await addDoc(watchedRef, {
        movieId: rec.movieId,
        title: rec.title,
        year: rec.year,
        poster: rec.poster,
        backdrop: rec.backdrop,
        runtime: rec.runtime,
        mediaType: rec.mediaType,
        rating,
        ratedAt: serverTimestamp(),
        llmReason: rec.reason,
      });
      await recordTasteEvent(
        user.uid,
        { type: 'rate', movieId: rec.movieId, title: rec.title, year: rec.year, rating, source: 'rec' },
        { email: user.email }
      );
    },
    [user]
  );

  const skipRecommendation = useCallback(
    async (rec: RecommendationResult) => {
      if (!user) return;
      const skippedRef = collection(db, 'users', user.uid, 'skipped_recommendations');
      await addDoc(skippedRef, {
        movieId: rec.movieId,
        title: rec.title,
        year: rec.year,
        poster: rec.poster,
        backdrop: rec.backdrop,
        runtime: rec.runtime,
        mediaType: rec.mediaType,
        skippedAt: serverTimestamp(),
        cooldownDays: 3,
        recommendationsSinceSkip: 0,
        cooldownRecommendations: 5,
        llmReason: rec.reason,
      });
      await recordTasteEvent(
        user.uid,
        { type: 'skip', movieId: rec.movieId, title: rec.title, year: rec.year },
        { email: user.email }
      );
    },
    [user]
  );

  const refreshRecommendation = useCallback(() => generateRecommendation(true), [generateRecommendation]);

  return {
    picks,
    recommendation: picks[0] ?? null,
    status,
    isLoading: status === 'loading',
    error,
    generateRecommendation,
    rateRecommendation,
    refreshRecommendation,
    skipRecommendation,
  };
}
