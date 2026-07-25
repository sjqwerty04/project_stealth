import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '../lib/firebase';
import { callClaude, extractJSON } from '../lib/claude';
import { buildSeenKeys, isSeen } from '../lib/titleMatch';
import { directorOf, getMovie, searchMovie } from '../lib/tmdb';
import { sanitizeFacets, vocabularyPrompt } from '../lib/facets';
import {
  DEFAULT_CONSTRAINTS,
  constraintKey,
  selectPicks,
  type Candidate,
  type Constraints,
} from '../lib/constraints';
import {
  needsRefill,
  pruneQueue,
  readQueue,
  TARGET_QUEUE_SIZE,
  writeQueue,
  type StoredQueue,
} from '../lib/tonightQueue';
import {
  createAnalytics,
  DecisionTimer,
  type AnalyticsEvent,
  type CommitAction,
  type LoggedEvent,
} from '../lib/decisionMetrics';
import { useCalendarLogs } from './useCalendarLogs';

/**
 * The decision path.
 *
 * Reads the warm queue on mount, narrows it with tonight's constraints in
 * memory, and refills in the background. Generation never blocks what the user
 * is looking at — that was the whole problem.
 */

const SYSTEM_PROMPT = `You are a film programmer who has seen everything and does not need anyone to know it. You pick films for one specific person and say why in one dry, specific sentence. You never spoil anything and you never flatter.`;

const buildPrompt = (count: number, seen: string[], liked: string[], recent: string[]) => `<task>
Pick ${count} films this person has not seen. For each, give the reason it fits them and its facets.
</task>

<already_seen>
${seen.join('\n') || 'nothing recorded'}
</already_seen>

<they_liked>
${liked.join('\n') || 'nothing recorded'}
</they_liked>

<recently_watched>
${recent.join('\n') || 'nothing recorded'}
</recently_watched>

<facet_vocabulary>
Use ONLY these terms, exactly as written. Do not invent terms.
${vocabularyPrompt()}
</facet_vocabulary>

<rules>
1. Never pick anything in <already_seen>.
2. Vary runtime deliberately: at least a third under 100 minutes. The list is
   filtered by available time later, so a list of three-hour films is useless.
3. Vary demand deliberately: some films for a tired viewer, some for an alert one.
4. Give each film 4 to 7 facets drawn from the vocabulary above.
5. The reason is one or two sentences. Specific nouns, not adjectives. No spoilers,
   no plot description, no praise of the user.
</rules>

<output_format>
A JSON array of ${count} objects and nothing else:
[{"title":"Title","year":"1995","reason":"One dry sentence.","facets":{"tempo":["procedural"],"world":["rain-slick city night"]}}]
</output_format>`;

type ModelPick = { title?: string; year?: string; reason?: string; facets?: unknown };

export type TonightState = {
  constraints: Constraints;
  setConstraints: (next: Constraints) => void;
  picks: Candidate[];
  relaxedRuntime: boolean;
  /** True only when there is nothing to show and we are generating. */
  isColdStart: boolean;
  isRefilling: boolean;
  error: string | null;
  queueSize: number;
  commit: (candidate: Candidate, action: CommitAction) => void;
  rejectAll: () => void;
  history: LoggedEvent[];
};

export function useTonight(): TonightState {
  const { user } = useAuth();
  const { events: calendarEvents } = useCalendarLogs();

  const [constraints, setConstraintsState] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [queue, setQueue] = useState<StoredQueue | null>(null);
  const [isColdStart, setIsColdStart] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef(new DecisionTimer());
  const refillInFlight = useRef<Promise<void> | null>(null);
  const sessionLogged = useRef(false);

  const analytics = useMemo(() => {
    const uid = user?.uid;
    return createAnalytics((event: LoggedEvent) => {
      if (!uid) return;
      // Fire-and-forget: a failed write must not affect the decision path.
      void addDoc(collection(db, 'users', uid, 'events'), {
        ...event,
        createdAt: serverTimestamp(),
      });
    });
  }, [user?.uid]);

  const track = useCallback(
    (event: AnalyticsEvent) => analytics.track(event),
    [analytics]
  );

  /** Titles already logged, used to keep the queue honest between refills. */
  const seenTitles = useMemo(
    () => Object.values(calendarEvents || {}).flatMap((day: any) => (day || []).map((e: any) => e?.title).filter(Boolean)),
    [calendarEvents]
  );

  const refill = useCallback(
    async (existing: StoredQueue | null) => {
      if (!user) return;
      if (refillInFlight.current) return refillInFlight.current;

      const startedAt = Date.now();
      setIsRefilling(true);

      const run = (async () => {
        try {
          const seenKeys = buildSeenKeys(seenTitles);
          const wanted = TARGET_QUEUE_SIZE - (existing?.candidates.length ?? 0);
          if (wanted <= 0) return;

          const raw = await callClaude(
            buildPrompt(wanted, seenTitles.slice(0, 300), [], seenTitles.slice(0, 20)),
            SYSTEM_PROMPT
          );
          if (!raw) throw new Error('Recommender returned nothing');

          const parsed = extractJSON(raw);
          if (!Array.isArray(parsed)) throw new Error('Model did not return a list');

          const hydrated = await Promise.all(
            (parsed as ModelPick[])
              .filter((pick) => pick?.title && !isSeen(pick.title, seenKeys))
              .map(async (pick): Promise<Candidate | null> => {
                const match = await searchMovie(pick.title!, pick.year);
                if (!match?.id) return null;

                const details = await getMovie(match.id, { credits: true });

                return {
                  movieId: match.id,
                  title: match.title || pick.title!,
                  year: (match.release_date || '').slice(0, 4) || pick.year || '',
                  posterPath: match.poster_path ?? null,
                  runtimeMinutes: details?.runtime ?? null,
                  reason: pick.reason || `Directed by ${directorOf(details) ?? 'someone worth your time'}.`,
                  facets: sanitizeFacets(pick.facets),
                };
              })
          );

          const fresh = hydrated.filter((c): c is Candidate => c !== null);
          const existingIds = new Set((existing?.candidates ?? []).map((c) => c.movieId));
          const merged = [
            ...(existing?.candidates ?? []),
            ...fresh.filter((c) => !existingIds.has(c.movieId)),
          ];

          await writeQueue(user.uid, merged);
          setQueue({ candidates: merged, generatedAt: Date.now(), version: 1 });
          setError(null);
          track({ name: 'queue_refilled', size: merged.length, durationMs: Date.now() - startedAt });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown';
          console.error('Queue refill failed:', err);
          track({ name: 'queue_refill_failed', reason });
          // Only surface an error when there is nothing to fall back on.
          if (!existing?.candidates.length) setError('Could not reach the recommender. Try again.');
        } finally {
          setIsRefilling(false);
          setIsColdStart(false);
          refillInFlight.current = null;
        }
      })();

      refillInFlight.current = run;
      return run;
    },
    [user, seenTitles, track]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const stored = await readQueue(user.uid);
      if (cancelled) return;

      const pruned = stored ? pruneQueue(stored, []) : null;
      setQueue(pruned);

      if (!sessionLogged.current) {
        sessionLogged.current = true;
        timerRef.current.reset();
        track({
          name: 'session_start',
          queueHit: Boolean(pruned?.candidates.length),
          queueSize: pruned?.candidates.length ?? 0,
        });
      }

      // A usable queue means the user is never looking at a spinner.
      if (pruned?.candidates.length) setIsColdStart(false);
      if (needsRefill(pruned)) void refill(pruned);
      else setIsColdStart(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refill, track]);

  const selection = useMemo(
    () => selectPicks(queue?.candidates ?? [], constraints),
    [queue, constraints]
  );

  const shownRef = useRef('');
  useEffect(() => {
    if (!selection.picks.length) return;
    const signature = `${constraintKey(constraints)}|${selection.picks.map((p) => p.movieId).join(',')}`;
    if (shownRef.current === signature) return;
    shownRef.current = signature;
    track({
      name: 'picks_shown',
      count: selection.picks.length,
      relaxedRuntime: selection.relaxedRuntime,
      msSinceOpen: timerRef.current.elapsed(),
    });
  }, [selection, constraints, track]);

  const setConstraints = useCallback(
    (next: Constraints) => {
      setConstraintsState(next);
      track({
        name: 'constraints_set',
        constraints: constraintKey(next),
        msSinceOpen: timerRef.current.elapsed(),
      });
    },
    [track]
  );

  const commit = useCallback(
    (candidate: Candidate, action: CommitAction) => {
      const position = selection.picks.findIndex((p) => p.movieId === candidate.movieId);
      track({
        name: 'pick_committed',
        movieId: candidate.movieId,
        action,
        position: position < 0 ? 0 : position,
        msSinceOpen: timerRef.current.elapsed(),
      });

      // Consume the pick so the next open doesn't offer it again.
      setQueue((current) => (current ? pruneQueue(current, [candidate.movieId]) : current));
      if (user) {
        const remaining = (queue?.candidates ?? []).filter((c) => c.movieId !== candidate.movieId);
        void writeQueue(user.uid, remaining);
      }
    },
    [selection, track, user, queue]
  );

  const rejectAll = useCallback(() => {
    track({ name: 'picks_rejected', msSinceOpen: timerRef.current.elapsed() });
    const shownIds = selection.picks.map((p) => p.movieId);
    setQueue((current) => {
      const next = current ? pruneQueue(current, shownIds) : current;
      if (user && next) void writeQueue(user.uid, next.candidates);
      if (next && needsRefill(next)) void refill(next);
      return next;
    });
  }, [selection, track, user, refill]);

  return {
    constraints,
    setConstraints,
    picks: selection.picks,
    relaxedRuntime: selection.relaxedRuntime,
    isColdStart: isColdStart && !selection.picks.length,
    isRefilling,
    error,
    queueSize: queue?.candidates.length ?? 0,
    commit,
    rejectAll,
    history: analytics.history(),
  };
}
