import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { setVerdict as setLedgerVerdict, type Verdict } from '../lib/library';
import {
  contextFromCalendarLogs,
  hasMeaningfulContext,
  hitSelectsCache,
  mergeRecommendContext,
  readSelectsCache,
  recordTasteEvent,
  useTaste,
  writeSelectsCache,
  LAST_PICKS_FRESH_MS,
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

function toStored(p: RecommendationResult): TastePick {
  return {
    movieId: p.movieId,
    title: p.title,
    year: p.year,
    poster: p.poster,
    backdrop: p.backdrop,
    runtime: p.runtime,
    mediaType: p.mediaType,
    whyMatch: p.reason,
    confidence: p.confidence,
  };
}

function resolveHit(uid: string, snapshotPicks: TastePick[], snapshotAt: number | null): RecommendationResult[] | null {
  const hit = hitSelectsCache(uid, snapshotPicks, snapshotAt);
  if (!hit) return null;
  return hit.picks.map(fromStored);
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
  const { snapshot, loading: tasteLoading } = useTaste();
  const [picks, setPicks] = useState<RecommendationResult[]>(() => {
    if (user?.uid) {
      const hit = readSelectsCache(user.uid);
      if (hit?.picks.length) {
        return hit.picks.map(fromStored);
      }
    }
    return [];
  });
  const [status, setStatus] = useState<SelectsStatus>(() => {
    if (!user) return 'idle';
    const hit = readSelectsCache(user.uid);
    if (hit?.picks.length) return 'ready';
    return 'loading';
  });
  const [error, setError] = useState<string | null>(null);

  const diaryKey = (opts?.events ?? [])
    .map((e) => `${e.movieId ?? ''}:${e.title}:${e.verdict ?? e.rating ?? ''}:${e.date ?? ''}`)
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

    const stored = snapshot.generated.lastPicks.map(fromStored);
    if (!force) {
      const hit = resolveHit(user.uid, snapshot.generated.lastPicks, snapshot.generated.lastPicksAt);
      if (hit?.length) {
        setPicks(hit);
        setStatus('ready');
        return hit;
      }
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
      const havePicks = stored.length > 0 || (readSelectsCache(user.uid)?.picks.length ?? 0) > 0;
      setStatus(havePicks ? 'ready' : 'loading');
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
          writeSelectsCache(user.uid, hydrated.map(toStored));
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
    if (!user) {
      setStatus('idle');
      return;
    }
    const hit = resolveHit(user.uid, snapshot.generated.lastPicks, snapshot.generated.lastPicksAt);
    if (hit?.length) {
      setPicks(hit);
      setStatus('ready');
      return;
    }
    const stale = readSelectsCache(user.uid);
    if (stale?.picks.length) {
      setPicks(stale.picks.map(fromStored));
      setStatus('ready');
    }
    if (tasteLoading) {
      if (!stale?.picks.length) setStatus('loading');
      return;
    }
    if (!hasMeaningfulContext(context)) {
      setPicks([]);
      setStatus('empty');
      return;
    }
    void generateRecommendation(false);
  }, [user, tasteLoading, snapshot, context, generateRecommendation]);

  useEffect(() => {
    if (!user) return;
    const cached = readSelectsCache(user.uid);
    if (!cached?.at || !cached.picks.length) return;
    const remaining = LAST_PICKS_FRESH_MS - (Date.now() - cached.at);
    if (remaining <= 0) return;
    const t = window.setTimeout(() => {
      void generateRecommendation(true);
    }, remaining);
    return () => window.clearTimeout(t);
  }, [user, picks, generateRecommendation]);

  const rateRecommendation = useCallback(
    async (rec: RecommendationResult, verdict: Verdict) => {
      if (!user) return;
      await setLedgerVerdict(
        user.uid,
        { movieId: rec.movieId, title: rec.title, year: rec.year, poster: rec.poster, backdrop: rec.backdrop, mediaType: rec.mediaType },
        verdict,
        'rec',
      );
      await recordTasteEvent(
        user.uid,
        { type: 'verdict', movieId: rec.movieId, title: rec.title, year: rec.year, verdict, source: 'rec' },
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
