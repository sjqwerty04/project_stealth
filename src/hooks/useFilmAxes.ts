import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  FILM_AXES_COLLECTION,
  filmAxesDocId,
  filmAxesLlm,
  generateFilmAxes,
  loadFilmAxes,
  parseCachedFilmAxes,
  type FilmAxes,
  type FilmAxesDoc,
  type FilmAxesResult,
  type FilmAxesSource,
  type FilmAxesSubject,
} from '../lib/theater';

export type FilmAxesState = {
  axes: FilmAxes | null;
  loading: boolean;
  error: string | null;
};

const IDLE: FilmAxesState = { axes: null, loading: false, error: null };
const PENDING: FilmAxesState = { axes: null, loading: true, error: null };
const UNAVAILABLE: FilmAxesState = { axes: null, loading: false, error: 'Axes unavailable' };

const firestoreSource: FilmAxesSource = {
  readCache: async (filmKey: string): Promise<FilmAxes | null> => {
    try {
      const snapshot = await getDoc(doc(db, FILM_AXES_COLLECTION, filmKey));
      return snapshot.exists() ? parseCachedFilmAxes(filmKey, snapshot.data()) : null;
    } catch (error) {
      console.warn('Film axes cache read failed:', error);
      return null;
    }
  },
  generate: (subject: FilmAxesSubject) => generateFilmAxes(subject, filmAxesLlm),
  writeCache: async (filmKey: string, axesDoc: FilmAxesDoc) => {
    try {
      await setDoc(doc(db, FILM_AXES_COLLECTION, filmKey), axesDoc);
    } catch (error) {
      console.warn('Film axes cache write refused:', error);
    }
  },
  now: () => Date.now(),
};

/** One load per film while it runs, so a Strict Mode remount and a second reader share the one model call. */
const inFlight = new Map<string, Promise<FilmAxesResult>>();

function loadFilmAxesOnce(subject: FilmAxesSubject): Promise<FilmAxesResult> {
  const filmKey = filmAxesDocId(subject.mediaType, subject.id);
  const running = inFlight.get(filmKey);
  if (running) return running;
  const started = loadFilmAxes(subject, firestoreSource).finally(() => inFlight.delete(filmKey));
  inFlight.set(filmKey, started);
  return started;
}

export function useFilmAxes(subject: FilmAxesSubject | null): FilmAxesState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [result, setResult] = useState<FilmAxesResult | null>(null);

  useEffect(() => {
    if (!subject || !uid) return;
    const filmKey = filmAxesDocId(subject.mediaType, subject.id);
    let current = true;
    loadFilmAxesOnce(subject)
      .then((loaded) => {
        if (current) setResult(loaded);
      })
      .catch(() => {
        if (current) setResult({ filmKey, axes: null });
      });
    return () => {
      current = false;
    };
  }, [subject, uid]);

  if (!subject || !uid) return IDLE;
  if (result?.filmKey !== filmAxesDocId(subject.mediaType, subject.id)) return PENDING;
  return result.axes ? { axes: result.axes, loading: false, error: null } : UNAVAILABLE;
}
