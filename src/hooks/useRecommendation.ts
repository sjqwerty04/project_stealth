import { useState, useCallback, useRef } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useCalendarLogs } from './useCalendarLogs';
import { callClaudeForJSON } from '../lib/claude';
import { buildSeenKeys, isSeen, stripYearSuffix, titleKey } from '../lib/titleMatch';

type RatingValue = 'up' | 'down' | null;

export type WatchedRecommendation = {
  id: string;
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
  mediaType?: 'movie' | 'tv';
  rating: RatingValue;
  ratedAt: any;
  llmReason: string;
};

export type RecommendationResult = {
  movieId: number;
  title: string;
  year: string | number;
  poster: string;
  backdrop?: string;
  runtime?: string;
  mediaType?: 'movie' | 'tv';
  reason: string;
  director?: string;
  genres?: string[];
};

// One generation produces a batch of picks so that "skip" and "refresh" can be
// served from memory instead of re-running the whole LLM + TMDB pipeline.
const CANDIDATE_COUNT = 5;

// Refill in the background once the queue drops to this size.
const QUEUE_REFILL_THRESHOLD = 1;

// The prompt only needs enough history to steer the model. Exhaustive exclusion
// is enforced in code (see filterUnseen), so sending every watched title just
// inflates latency and cost.
const PROMPT_EXCLUDE_LIMIT = 400;

const RECOMMENDATION_SYSTEM_PROMPT = `You are an expert film curator with deep knowledge of cinema across all genres, eras, and cultures. Your specialty is analyzing viewing patterns and recommending films that perfectly match viewer preferences while introducing them to new experiences. You also write the one-line rationale for each pick in the voice of a witty, slightly roast-y Letterboxd critic who never spoils a film.`;

const RECOMMENDATION_PROMPT_TEMPLATE = `<task>
Recommend {count} movies, ranked best-first, that the user has NOT already watched. For each one, also write the reason it fits them.
</task>

<context>
<already_watched>
{excludeList}
</already_watched>

<watchlist>
{watchlist}
</watchlist>

<liked_movies>
{likedMovies}
</liked_movies>

<disliked_movies>
{dislikedMovies}
</disliked_movies>

<recent_watches>
{recentWatches}
</recent_watches>
</context>

<selection_rules>
1. NEVER recommend any movie from the <already_watched> list
2. Strongly prefer movies from <watchlist> if they align with the user's taste
3. Analyze patterns in <liked_movies>: consider genres, directors, narrative styles, themes, and mood
4. Avoid recommending anything similar to <disliked_movies>
5. Prioritize critically acclaimed films or cult classics when appropriate
6. Consider both obvious matches and hidden gems
7. Return {count} DISTINCT films, ordered with the strongest match first
</selection_rules>

<reason_rules>
- ABSOLUTELY NO SPOILERS: do not reveal plot points, twists, character fates, or story details
- Do not describe what happens in the movie
- Only reference the movie's vibe, genre, director's style, or general themes
- Focus on WHY it matches their taste, not WHAT happens in the film
- Be witty and slightly roast-y but ultimately helpful
- Reference specific movies they've watched to draw comparisons (without spoiling those either)
- Keep each reason to 1-2 punchy sentences
</reason_rules>

<output_format>
Respond with ONLY a JSON array of {count} objects, no markdown, no explanations:
[{"title": "Movie Title", "year": "2024", "fromWatchlist": false, "reason": "Why it fits them."}]
</output_format>

<example>
[{"title": "The Grand Budapest Hotel", "year": "2014", "fromWatchlist": false, "reason": "You clearly have a thing for meticulous framing and melancholy dressed up as whimsy. This is the thesis statement."}]
</example>`;

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

const TMDB_BASE = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.error('TMDB API key is missing! Check VITE_TMDB_API_KEY in Vercel env vars.');
}

type Candidate = {
  title: string;
  year?: string | number;
  fromWatchlist?: boolean;
  reason?: string;
};

const searchTMDB = async (title: string, year?: string | number): Promise<any | null> => {
  if (!TMDB_API_KEY) {
    console.error('TMDB search failed: No API key configured');
    return null;
  }

  try {
    const url = new URL(`${TMDB_BASE}/search/movie`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('query', title);
    if (year) url.searchParams.set('year', String(year));
    url.searchParams.set('language', 'en-US');

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('TMDB search failed:', response.status, response.statusText, 'for:', title);
      if (year && (response.status === 401 || response.status === 404)) {
        url.searchParams.delete('year');
        const retryResponse = await fetch(url.toString());
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          return data.results?.[0] || null;
        }
      }
      return null;
    }

    const data = await response.json();
    return data.results?.[0] || null;
  } catch (error) {
    console.error('TMDB search failed:', error);
    return null;
  }
};

const getMovieDetails = async (movieId: number): Promise<any | null> => {
  try {
    const url = `${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('TMDB details fetch failed:', error);
    return null;
  }
};

const formatRuntime = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return 'Feature';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

const buildImageUrl = (path: string | null | undefined, size: 'w200' | 'w500' | 'w780' = 'w200') => {
  if (!path) return 'https://placehold.co/200x300?text=Movie';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export function useRecommendation() {
  const { user } = useAuth();
  const { events } = useCalendarLogs();
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picks generated but not yet shown. Popping from here is what makes skip and
  // refresh feel instant instead of costing a full LLM round trip.
  const queueRef = useRef<RecommendationResult[]>([]);
  const inFlightRef = useRef<Promise<RecommendationResult[]> | null>(null);

  const fetchRatedRecommendations = useCallback(async (maxResults?: number): Promise<WatchedRecommendation[]> => {
    if (!user) return [];
    try {
      const watchedRef = collection(db, 'users', user.uid, 'watched_recommendations');
      // Fetch all documents without ordering to avoid index issues
      const snapshot = await getDocs(watchedRef);
      let results = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as WatchedRecommendation[];

      // Sort client-side by ratedAt (most recent first)
      results.sort((a, b) => {
        const aTime = a.ratedAt?.toMillis?.() || a.ratedAt?.seconds * 1000 || 0;
        const bTime = b.ratedAt?.toMillis?.() || b.ratedAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });

      if (maxResults && results.length > maxResults) {
        results = results.slice(0, maxResults);
      }

      return results;
    } catch (err) {
      console.error('Failed to fetch rated recommendations:', err);
      return [];
    }
  }, [user]);

  /**
   * Reads everything the prompt needs. The three collections are independent, so
   * they are fetched concurrently rather than chained.
   */
  const buildTasteContext = useCallback(async () => {
    if (!user) return null;

    const watchlistRef = collection(db, 'users', user.uid, 'watchlist');
    const skippedRef = collection(db, 'users', user.uid, 'skipped_recommendations');

    const [allWatchedRecs, watchlistSnapshot, skippedSnapshot] = await Promise.all([
      fetchRatedRecommendations(),
      getDocs(watchlistRef),
      getDocs(skippedRef),
    ]);

    const now = Date.now();
    const skippedInCooldown: string[] = [];
    const expiredSkipIds: string[] = [];

    for (const docSnap of skippedSnapshot.docs) {
      const data = docSnap.data();
      const skippedAt = data.skippedAt?.toMillis?.() || data.skippedAt?.seconds * 1000 || 0;
      const daysSinceSkip = (now - skippedAt) / (1000 * 60 * 60 * 24);
      const recsSinceSkip = data.recommendationsSinceSkip || 0;
      const cooldownDays = data.cooldownDays || 3;
      const cooldownRecs = data.cooldownRecommendations || 5;

      // A skip expires only once BOTH the time and the volume threshold are met.
      const daysComplete = daysSinceSkip >= cooldownDays;
      const recsComplete = recsSinceSkip >= cooldownRecs;

      if (!daysComplete || !recsComplete) {
        skippedInCooldown.push(`${data.title} (${data.year || ''})`);
      } else {
        expiredSkipIds.push(docSnap.id);
      }
    }

    const calendarTitles = events.map((e) => `${e.title} (${e.year || ''})`);
    const watchedRecTitles = allWatchedRecs.map((r) => `${r.title} (${r.year || ''})`);
    const watchlistTitles = watchlistSnapshot.docs
      .map((docSnap) => docSnap.data())
      .map((w) => `${w.title} (${w.year || ''})`);

    // Roughly recency-ordered: calendar first, then imports/ratings.
    const excludeOrdered = Array.from(new Set([...calendarTitles, ...watchedRecTitles, ...skippedInCooldown]));

    // Authoritative exclusion set, applied in code after generation.
    const seenKeys = buildSeenKeys(excludeOrdered);

    const excludeForPrompt = excludeOrdered.slice(0, PROMPT_EXCLUDE_LIMIT);

    const likedFromCalendar = events.filter((e) => e.rating === 'up').map((e) => e.title);
    const likedFromRecs = allWatchedRecs.filter((r) => r.rating === 'up').map((r) => r.title);
    const allLiked = [...new Set([...likedFromCalendar, ...likedFromRecs])];

    const dislikedFromCalendar = events.filter((e) => e.rating === 'down').map((e) => e.title);
    const dislikedFromRecs = allWatchedRecs.filter((r) => r.rating === 'down').map((r) => r.title);
    const allDisliked = [...new Set([...dislikedFromCalendar, ...dislikedFromRecs])];

    return {
      seenKeys,
      expiredSkipIds,
      activeSkipIds: skippedSnapshot.docs.filter((d) => !expiredSkipIds.includes(d.id)).map((d) => d.id),
      skipCounters: new Map(skippedSnapshot.docs.map((d) => [d.id, d.data().recommendationsSinceSkip || 0])),
      excludeList: excludeForPrompt.length > 0 ? excludeForPrompt.join('\n') : 'None',
      watchlistText:
        watchlistTitles.length > 0
          ? watchlistTitles.filter((t) => !isSeen(stripYearSuffix(t), seenKeys)).join('\n') ||
            'None (all watchlist items already watched)'
          : 'No watchlist',
      likedMovies: allLiked.length > 0 ? allLiked.slice(0, 40).join(', ') : 'None rated yet',
      dislikedMovies: allDisliked.length > 0 ? allDisliked.slice(0, 40).join(', ') : 'None',
      recentWatches: events.slice(0, 5).map((e) => e.title).join(', ') || 'nothing yet',
    };
  }, [user, events, fetchRatedRecommendations]);

  /**
   * Turns an LLM candidate into a fully rendered pick. Candidates are hydrated
   * concurrently by the caller, so the two TMDB hops here cost one round trip
   * of wall clock across the whole batch.
   */
  const hydrateCandidate = useCallback(
    async (candidate: Candidate, seenKeys: Set<string>): Promise<RecommendationResult | null> => {
      if (!candidate?.title) return null;
      if (isSeen(candidate.title, seenKeys)) return null;

      const tmdbResult = await searchTMDB(candidate.title, candidate.year);
      if (!tmdbResult) return null;

      // TMDB's canonical title can differ from what the model returned, so
      // re-check exclusion against the resolved title too.
      if (isSeen(tmdbResult.title, seenKeys)) return null;

      const movieDetails = await getMovieDetails(tmdbResult.id);

      return {
        movieId: tmdbResult.id,
        title: tmdbResult.title || candidate.title,
        year: tmdbResult.release_date?.slice(0, 4) || candidate.year || '----',
        poster: buildImageUrl(tmdbResult.poster_path),
        backdrop: buildImageUrl(tmdbResult.backdrop_path, 'w780'),
        runtime: formatRuntime(movieDetails?.runtime),
        mediaType: 'movie',
        reason: candidate.reason?.trim() || "This one's got your name written all over it.",
        director: movieDetails?.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
        genres: movieDetails?.genres?.slice(0, 2).map((g: any) => g.name) || [],
      };
    },
    []
  );

  /**
   * Advances skip cooldown counters and clears expired skips. Deliberately not
   * awaited by the render path: it is bookkeeping, not something the user waits on.
   */
  const reconcileSkips = useCallback(
    async (
      expiredSkipIds: string[],
      activeSkipIds: string[],
      counters: Map<string, number>,
      recommendationsProduced: number
    ) => {
      if (!user) return;
      if (expiredSkipIds.length === 0 && activeSkipIds.length === 0) return;

      try {
        const batch = writeBatch(db);
        for (const id of expiredSkipIds) {
          batch.delete(doc(db, 'users', user.uid, 'skipped_recommendations', id));
        }
        for (const id of activeSkipIds) {
          // Cooldown is measured in recommendations the user will actually see,
          // which is the whole batch, not one per generation.
          batch.update(doc(db, 'users', user.uid, 'skipped_recommendations', id), {
            recommendationsSinceSkip: (counters.get(id) || 0) + recommendationsProduced,
          });
        }
        await batch.commit();
      } catch (e) {
        console.warn('Failed to reconcile skip cooldowns:', e);
      }
    },
    [user]
  );

  /**
   * Runs the full pipeline once and returns a batch of hydrated picks.
   * Concurrent callers share a single in-flight generation.
   */
  const generateBatch = useCallback(async (): Promise<RecommendationResult[]> => {
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async (): Promise<RecommendationResult[]> => {
      const context = await buildTasteContext();
      if (!context) return [];

      const prompt = RECOMMENDATION_PROMPT_TEMPLATE
        .replaceAll('{count}', String(CANDIDATE_COUNT))
        .replace('{excludeList}', context.excludeList)
        .replace('{watchlist}', context.watchlistText)
        .replace('{likedMovies}', context.likedMovies)
        .replace('{dislikedMovies}', context.dislikedMovies)
        .replace('{recentWatches}', context.recentWatches);

      const parsed = await callClaudeForJSON<Candidate[] | Candidate>(
        prompt,
        RECOMMENDATION_SYSTEM_PROMPT,
        2
      );

      if (!parsed) {
        throw new Error('AI returned invalid response after multiple retries. Please try again.');
      }

      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      // The model is told not to repeat watched titles and does so anyway, so the
      // exclusion is enforced here rather than trusted to the prompt.
      const hydrated = (
        await Promise.all(candidates.map((c) => hydrateCandidate(c, context.seenKeys)))
      ).filter((r): r is RecommendationResult => r !== null);

      const deduped: RecommendationResult[] = [];
      const seenIds = new Set<number>();
      for (const pick of hydrated) {
        if (seenIds.has(pick.movieId)) continue;
        seenIds.add(pick.movieId);
        deduped.push(pick);
      }

      // Bookkeeping runs after the picks are ready, never before.
      void reconcileSkips(
        context.expiredSkipIds,
        context.activeSkipIds,
        context.skipCounters,
        deduped.length
      );

      return deduped;
    })();

    inFlightRef.current = run;
    try {
      return await run;
    } finally {
      inFlightRef.current = null;
    }
  }, [buildTasteContext, hydrateCandidate, reconcileSkips]);

  /**
   * Appends picks to the queue, dropping anything already queued. Concurrent
   * callers share one in-flight generation and therefore receive the same batch,
   * so enqueueing has to be idempotent.
   */
  const enqueue = useCallback((picks: RecommendationResult[]) => {
    const queued = new Set(queueRef.current.map((p) => p.movieId));
    for (const pick of picks) {
      if (queued.has(pick.movieId)) continue;
      queued.add(pick.movieId);
      queueRef.current.push(pick);
    }
  }, []);

  /**
   * Takes the next pick, discarding any that the user has logged as watched
   * elsewhere since the batch was generated.
   */
  const dequeue = useCallback((): RecommendationResult | undefined => {
    const loggedKeys = new Set(events.map((e) => titleKey(e.title)));
    while (queueRef.current.length > 0) {
      const candidate = queueRef.current.shift();
      if (candidate && !loggedKeys.has(titleKey(candidate.title))) return candidate;
    }
    return undefined;
  }, [events]);

  const generateRecommendation = useCallback(async (): Promise<RecommendationResult | null> => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }

    const next = dequeue();
    if (next) {
      setError(null);
      setRecommendation(next);
      if (queueRef.current.length <= QUEUE_REFILL_THRESHOLD) {
        // Warm the queue for the next skip without blocking this render.
        void generateBatch()
          .then(enqueue)
          .catch((e) => console.warn('Background recommendation refill failed:', e));
      }
      return next;
    }

    setIsLoading(true);
    setError(null);

    try {
      const batch = await generateBatch();
      if (batch.length === 0) {
        setError('Could not find a fresh recommendation. Please try again.');
        return null;
      }

      enqueue(batch);
      const first = dequeue();
      if (!first) {
        setError('Could not find a fresh recommendation. Please try again.');
        return null;
      }

      setRecommendation(first);
      return first;
    } catch (err: any) {
      console.error('Recommendation generation failed:', err);
      setError(err?.message || 'Failed to generate recommendation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, generateBatch, enqueue, dequeue]);

  const rateRecommendation = useCallback(
    async (rec: RecommendationResult, rating: 'up' | 'down'): Promise<void> => {
      if (!user) return;

      try {
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

        setRecommendation(null);
      } catch (err) {
        console.error('Failed to save rating:', err);
      }
    },
    [user]
  );

  const refreshRecommendation = useCallback(async () => {
    setRecommendation(null);
    return generateRecommendation();
  }, [generateRecommendation]);

  // Skips are temporary: the film returns once it has been out of rotation for
  // both 3 days and 5 recommendations.
  const skipRecommendation = useCallback(
    async (rec: RecommendationResult): Promise<void> => {
      if (!user) return;

      try {
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

        setRecommendation(null);
      } catch (err) {
        console.error('Failed to skip recommendation:', err);
      }
    },
    [user]
  );

  return {
    recommendation,
    isLoading,
    error,
    generateRecommendation,
    rateRecommendation,
    refreshRecommendation,
    skipRecommendation,
    fetchRatedRecommendations,
  };
}
