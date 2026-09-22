import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { setVerdict as setLedgerVerdict, useLibrary, type Verdict } from '../lib/library';
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
import { getTaste } from '../lib/taste/getTaste';
import { hydratedTitleMatchesPick, whyMatchNamesRecommended } from '../lib/taste/selectPickCoherence';
import { prefetchScholarAdjacency } from '../lib/similar/prefetch';
import {
  executeSelectReplacement,
  replacePickAtSlot,
  replacingBlocksGenerate,
  type SelectExclusion,
  type SelectSlotId,
} from './selectReplacement';
import {
  buildSelectExclusions,
  buildYourSelectsBody,
  canGenerateSelects,
  dropExcludedPicks,
  hydrateUniqueSelectPicks,
} from './selectExclusions';

export type { SelectSlotId };

export type SelectReplacement =
  | { slotId: SelectSlotId; phase: 'saving'; feedbackSaved: false }
  | { slotId: SelectSlotId; phase: 'replacing'; feedbackSaved: true }
  | { slotId: SelectSlotId; phase: 'failed'; feedbackSaved: true; message: string }
  | null;

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

type ApiSelectPick = {
  title: string;
  year?: string;
  whyMatch?: string;
  confidence?: number;
  id?: string;
};

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

async function hydrateSelectPick(pick: ApiSelectPick): Promise<RecommendationResult | null> {
  if (pick.whyMatch && !whyMatchNamesRecommended(pick.whyMatch, pick.title)) return null;
  const film = await hydrateTitle(pick.title, pick.year, pick.id);
  if (!film) return null;
  if (!hydratedTitleMatchesPick(pick.title, film.title)) return null;
  return {
    ...film,
    reason: pick.whyMatch || '',
    confidence: typeof pick.confidence === 'number' ? pick.confidence : 1,
  };
}

export function useRecommendation(opts?: { events?: CalendarLogLike[] }) {
  const { user } = useAuth();
  const { snapshot, loading: tasteLoading } = useTaste();
  const { films: libraryFilms, loading: libraryLoading } = useLibrary();
  const events = opts?.events;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const libraryRef = useRef(libraryFilms);
  libraryRef.current = libraryFilms;
  const sessionExcludedRef = useRef<SelectExclusion[]>([]);
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
  const [replacements, setReplacements] = useState<Partial<Record<SelectSlotId, NonNullable<SelectReplacement>>>>({});
  const picksRef = useRef(picks);
  const replacementsRef = useRef(replacements);

  const patchReplacement = useCallback((slotId: SelectSlotId, next: SelectReplacement) => {
    const current = { ...replacementsRef.current };
    if (next) current[slotId] = next;
    else delete current[slotId];
    replacementsRef.current = current;
    setReplacements(current);
  }, []);

  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);

  const exclusionList = useCallback(() => {
    return buildSelectExclusions({
      lastPicks: picksRef.current,
      ledgerWatched: libraryRef.current.filter((film) => film.watched),
      sessionRated: sessionExcludedRef.current,
    });
  }, []);

  const rememberSessionExclusion = useCallback((rec: { movieId: number; title: string }) => {
    sessionExcludedRef.current = buildSelectExclusions({
      sessionRated: [...sessionExcludedRef.current, rec],
    });
  }, []);

  const context = useMemo((): RecommendContext => {
    return mergeRecommendContext(contextFromCalendarLogs(events ?? []), snapshot.context);
  }, [events, snapshot.context]);

  const generateRecommendation = useCallback(async (force = false): Promise<RecommendationResult[] | null> => {
    if (!user) {
      setError('Not authenticated');
      setStatus('error');
      return null;
    }

    const stored = snapshot.generated.lastPicks.map(fromStored);
    const replacing = replacingBlocksGenerate(replacementsRef.current);
    if (!canGenerateSelects({ libraryReady: !libraryLoading, replacing })) {
      const hit = resolveHit(user.uid, snapshot.generated.lastPicks, snapshot.generated.lastPicksAt);
      const source = hit?.length ? hit : stored.length ? stored : picksRef.current;
      const visible = dropExcludedPicks(source, exclusionList());
      if (visible.length) {
        setPicks(visible);
        setStatus('ready');
      }
      return visible;
    }

    if (!force) {
      const hit = resolveHit(user.uid, snapshot.generated.lastPicks, snapshot.generated.lastPicksAt);
      if (hit?.length) {
        const visible = dropExcludedPicks(hit, exclusionList());
        if (visible.length === hit.length) {
          setPicks(visible);
          setStatus('ready');
          return visible;
        }
      }
    }

    if (!hasMeaningfulContext(context)) {
      setPicks([]);
      setStatus('empty');
      return [];
    }

    const existing = inflight.get(user.uid);
    if (existing) {
      if (replacingBlocksGenerate(replacementsRef.current)) return picksRef.current;
      const shared = await existing;
      const visible = dropExcludedPicks(shared, exclusionList());
      setPicks(visible);
      setStatus(visible.length ? 'ready' : 'empty');
      return visible;
    }

    const run = (async () => {
      const havePicks = stored.length > 0 || (readSelectsCache(user.uid)?.picks.length ?? 0) > 0;
      setStatus(havePicks ? 'ready' : 'loading');
      setError(null);
      try {
        const excluded = exclusionList();
        const requestPicks = async (nextExcluded: SelectExclusion[], count: 1 | 3) => {
          const res = await fetch('/api/your-selects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildYourSelectsBody(context, nextExcluded, count)),
          });
          const data = res.ok ? await res.json() : { picks: [] };
          return Array.isArray(data.picks) ? (data.picks as ApiSelectPick[]) : [];
        };
        const raw = await requestPicks(excluded, 3);
        const hydrated = dropExcludedPicks(
          await hydrateUniqueSelectPicks({
            raw,
            hydrate: hydrateSelectPick,
            count: 3,
            excluded,
            requestMore: requestPicks,
          }),
          excluded,
        );

        setPicks(hydrated);
        setStatus(hydrated.length ? 'ready' : 'empty');
        if (hydrated.length) {
          writeSelectsCache(user.uid, hydrated.map(toStored));
          prefetchScholarAdjacency(
            hydrated.map((p) => ({
              movieId: p.movieId,
              title: p.title,
              year: p.year,
              mediaType: p.mediaType,
            })),
          );
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
  }, [user, snapshot, context, exclusionList, libraryLoading]);

  useEffect(() => {
    if (!user) {
      setStatus('idle');
      return;
    }
    const hit = resolveHit(user.uid, snapshot.generated.lastPicks, snapshot.generated.lastPicksAt);
    if (hit?.length) {
      const visible = dropExcludedPicks(hit, exclusionList());
      if (visible.length === hit.length || libraryLoading) {
        setPicks(visible.length ? visible : hit);
        setStatus('ready');
        if (visible.length === hit.length) return;
      } else {
        setPicks(visible);
        setStatus(visible.length ? 'ready' : 'loading');
      }
    }
    const stale = readSelectsCache(user.uid);
    if (stale?.picks.length) {
      const visible = dropExcludedPicks(stale.picks.map(fromStored), exclusionList());
      if (visible.length) {
        setPicks(visible);
        setStatus('ready');
      }
    }
    if (tasteLoading || libraryLoading || replacingBlocksGenerate(replacementsRef.current)) {
      if (!stale?.picks.length && !hit?.length) setStatus('loading');
      return;
    }
    if (!hasMeaningfulContext(context)) {
      setPicks([]);
      setStatus('empty');
      return;
    }
    void generateRecommendation(false);
  }, [user, tasteLoading, libraryLoading, snapshot, context, generateRecommendation, exclusionList]);

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
      rememberSessionExclusion(rec);
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
    [user, rememberSessionExclusion]
  );

  const skipRecommendation = useCallback(
    async (rec: RecommendationResult) => {
      if (!user) return;
      rememberSessionExclusion(rec);
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
    [user, rememberSessionExclusion]
  );

  const refreshRecommendation = useCallback(() => generateRecommendation(true), [generateRecommendation]);

  const runSlotReplacement = useCallback(
    async (slotId: SelectSlotId, verdict?: Verdict, feedbackSaved = false) => {
      const busy = replacementsRef.current[slotId];
      if (!user || (busy && (busy.phase === 'saving' || busy.phase === 'replacing'))) return;
      const rec = picksRef.current[slotId];
      if (!rec) return;

      let saved = feedbackSaved;
      patchReplacement(
        slotId,
        feedbackSaved
          ? { slotId, phase: 'replacing', feedbackSaved: true }
          : { slotId, phase: 'saving', feedbackSaved: false },
      );
      setError(null);

      try {
        const nextFromStart = await executeSelectReplacement<
          RecommendationResult,
          ApiSelectPick,
          RecommendContext
        >({
          slotId,
          picks: picksRef.current,
          extraExcluded: exclusionList(),
          feedbackSaved,
          saveFeedback: async () => {
            if (!verdict) throw new Error('Verdict is required');
            await rateRecommendation(rec, verdict);
          },
          onFeedbackSaved: () => {
            saved = true;
            patchReplacement(slotId, { slotId, phase: 'replacing', feedbackSaved: true });
          },
          readContext: async () => {
            const updated = await getTaste(user.uid);
            return mergeRecommendContext(
              contextFromCalendarLogs(eventsRef.current ?? []),
              updated.context,
            );
          },
          requestPicks: async (updatedContext, excluded: SelectExclusion[], count: 1 | 3) => {
            const res = await fetch('/api/your-selects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildYourSelectsBody(updatedContext, excluded, count)),
            });
            if (!res.ok) throw new Error('Could not find another select');
            const data = (await res.json()) as { picks?: unknown };
            return Array.isArray(data.picks) ? (data.picks as ApiSelectPick[]) : [];
          },
          hydratePick: hydrateSelectPick,
          persistPicks: async (updatedPicks) => {
            const incoming = updatedPicks[slotId];
            if (!incoming) return;
            const merged = replacePickAtSlot(picksRef.current, slotId, incoming);
            picksRef.current = merged;
            writeSelectsCache(user.uid, merged.map(toStored));
            await recordTasteEvent(
              user.uid,
              { type: 'last_picks', picks: merged.map(toStored) },
              { email: user.email },
            );
          },
        });
        const incoming = nextFromStart[slotId];
        const merged = incoming
          ? replacePickAtSlot(picksRef.current, slotId, incoming)
          : picksRef.current;
        picksRef.current = merged;
        setPicks(merged);
        setStatus('ready');
        patchReplacement(slotId, null);
      } catch (err) {
        const message =
          err instanceof Error && err.message !== 'No new select available'
            ? err.message
            : 'Could not find another select';
        if (saved) {
          patchReplacement(slotId, { slotId, phase: 'failed', feedbackSaved: true, message });
        } else {
          patchReplacement(slotId, null);
          setError('Could not save feedback');
        }
      }
    },
    [user, rateRecommendation, patchReplacement, exclusionList],
  );

  const replaceSelect = useCallback(
    (slotId: SelectSlotId, verdict: Verdict) => runSlotReplacement(slotId, verdict, false),
    [runSlotReplacement],
  );

  const retrySelectReplacement = useCallback(
    (slotId: SelectSlotId) => {
      const failed = replacementsRef.current[slotId];
      if (!failed || failed.phase !== 'failed') return Promise.resolve();
      return runSlotReplacement(slotId, undefined, true);
    },
    [runSlotReplacement],
  );

  const replacement = replacements[0] ?? replacements[1] ?? replacements[2] ?? null;

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
    replacement,
    replacements,
    replaceSelect,
    retrySelectReplacement,
  };
}
