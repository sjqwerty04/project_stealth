import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../lib/activityLogger';
import { recordTasteEvent } from '../lib/taste';
import {
  copyForwardLegacyTheaters,
  createTheaterEngine,
  dwellSignal,
  IDLE_SESSION,
  keepShowingTheater,
  loadTheaterSession,
  readLegacyTheaters,
  saveTheaterSession,
  sessionFilms,
  sessionOnSignIn,
  theaterDocWriter,
  theaterInference,
  theaterRuntimeReducer,
  type QueryMode,
  type TheaterEngine,
  type TheaterFilm,
} from '../lib/theater';
import { TheaterContext, type TheaterApi } from './useTheater';

const SIGNED_OUT = { status: 'closed', reason: 'signed_out' } as const;

const infer = theaterInference(import.meta.env.VITE_TMDB_API_KEY || '');

export function TheaterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email ?? null;
  const [session, dispatch] = useReducer(theaterRuntimeReducer, IDLE_SESSION);
  const [isKeeping, setIsKeeping] = useState(false);
  const sessionRef = useRef(session);
  const engagedRef = useRef(new Set<number>());
  const engineRef = useRef<TheaterEngine | null>(null);
  const restoredUidRef = useRef<string | null>(null);
  const copiedUidRef = useRef<string | null>(null);
  const keepingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!uid) {
      const previous = restoredUidRef.current;
      if (!previous) return;
      restoredUidRef.current = null;
      engagedRef.current.clear();
      saveTheaterSession(sessionStorage, previous, SIGNED_OUT);
      dispatch({ type: 'sign_out' });
      return;
    }
    if (restoredUidRef.current === uid) return;
    restoredUidRef.current = uid;
    const live = sessionRef.current;
    const next = sessionOnSignIn(live, loadTheaterSession(sessionStorage, uid));
    if (next !== live) dispatch({ type: 'restore', session: next });
    else saveTheaterSession(sessionStorage, uid, live);
  }, [uid]);

  useEffect(() => {
    const owner = restoredUidRef.current;
    if (owner && session.status !== 'idle') saveTheaterSession(sessionStorage, owner, session);
    if (session.status === 'closed' || session.status === 'kept') engagedRef.current.clear();
  }, [session]);

  useEffect(() => {
    engineRef.current ??= createTheaterEngine({
      infer,
      dispatch,
      now: () => Date.now(),
      schedule: (run, delayMs) => {
        const timer = setTimeout(run, delayMs);
        return () => clearTimeout(timer);
      },
    });
    engineRef.current.syncSession(session);
  }, [session]);

  useEffect(
    () => () => {
      engineRef.current?.stop();
      engineRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!uid || copiedUidRef.current === uid) return;
    copiedUidRef.current = uid;
    void readLegacyTheaters(uid)
      .then((legacy) => copyForwardLegacyTheaters(legacy, theaterDocWriter(uid)))
      .catch((error) => console.warn('Legacy Theater copy-forward failed:', error));
  }, [uid]);

  const commitSettledQuery = useCallback((text: string, mode: QueryMode) => {
    dispatch({ type: 'signal', signal: { kind: 'query', text, mode, at: Date.now() } });
  }, []);

  const recordFilmView = useCallback((film: TheaterFilm) => {
    dispatch({ type: 'signal', signal: { kind: 'detail_view', film, at: Date.now() } });
  }, []);

  const recordDetailExit = useCallback((filmId: number, ms: number) => {
    if (!sessionFilms(sessionRef.current).some((film) => film.id === filmId)) return;
    const signal = dwellSignal(filmId, ms, engagedRef.current.has(filmId));
    if (signal) dispatch({ type: 'signal', signal });
  }, []);

  const markTheaterEngaged = useCallback((filmId: number) => {
    engagedRef.current.add(filmId);
  }, []);

  const dismissTheater = useCallback(() => {
    dispatch({ type: 'dismiss' });
  }, []);

  const keepTheater = useCallback(async (): Promise<boolean> => {
    if (!uid || keepingRef.current) return false;
    keepingRef.current = true;
    setIsKeeping(true);
    try {
      const keptId = await keepShowingTheater(sessionRef.current, {
        now: () => Date.now(),
        write: theaterDocWriter(uid),
        recordTaste: (event) => recordTasteEvent(uid, event, { email }),
        logKept: (entry) => logActivity(uid, email ?? '', 'theater_kept', entry),
      });
      if (keptId) dispatch({ type: 'keep' });
      return keptId !== null;
    } catch (error) {
      console.error('Failed to keep Theater:', error);
      return false;
    } finally {
      keepingRef.current = false;
      setIsKeeping(false);
    }
  }, [uid, email]);

  const api: TheaterApi = {
    session,
    commitSettledQuery,
    recordFilmView,
    recordDetailExit,
    markTheaterEngaged,
    keepTheater,
    dismissTheater,
    isKeeping,
  };

  return <TheaterContext.Provider value={api}>{children}</TheaterContext.Provider>;
}
