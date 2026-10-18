import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  resolveVisibleStarters,
  LIBRARY_WAIT_MS,
  type Starter,
} from '../lib/askAi/starters';

export type StartersPayload = {
  version: number;
  source: 'llm' | 'empty';
  generatedAt: string;
  starters: Starter[];
};

const VERSION = 3;
const LLM_TTL_MS = 7 * 24 * 3600_000;
const EMPTY_TTL_MS = 10 * 60_000;
const localKey = (type: string, id: number) => `selects.askAi.starters.v${VERSION}.${type}.${id}`;
export const starterDocId = (type: string, id: number) => `v${VERSION}_${type}_${id}`;

function fresh(p: StartersPayload | null | undefined): p is StartersPayload {
  if (!p || p.version !== VERSION || !Array.isArray(p.starters)) return false;
  const age = Date.now() - new Date(p.generatedAt).getTime();
  if (p.source === 'empty') return age < EMPTY_TTL_MS;
  return p.starters.length > 0 && age < LLM_TTL_MS;
}

function readLocal(type: string, id: number): StartersPayload | null {
  try {
    const p = JSON.parse(localStorage.getItem(localKey(type, id)) || 'null');
    return fresh(p) ? p : null;
  } catch {
    return null;
  }
}

function writeLocal(type: string, id: number, p: StartersPayload) {
  try {
    localStorage.setItem(localKey(type, id), JSON.stringify(p));
  } catch {
    // storage full or unavailable: the CDN and Firestore layers still cache
  }
}

/** Fetches (and warms the CDN cache for) a film's starters without rendering them. */
export function prefetchStarters(id: number, type: 'movie' | 'tv' = 'movie', hint?: { title?: string; year?: string }) {
  if (readLocal(type, id)?.source === 'llm') return;
  const title = hint?.title ? `&title=${encodeURIComponent(hint.title)}` : '';
  const year = hint?.year ? `&year=${encodeURIComponent(hint.year)}` : '';
  void fetch(`/api/movie-starters?id=${id}&type=${type}${title}${year}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => fresh(p) && writeLocal(type, id, p))
    .catch(() => {});
}

export function useAskAiStarters(
  id: number | undefined,
  type: 'movie' | 'tv',
  hasLogged: boolean,
  logKnown: boolean,
  hint?: { title?: string; year?: string } | null,
) {
  const { user } = useAuth();
  const key = id ? `${type}.${id}` : '';
  const local = useMemo(() => (id ? readLocal(type, id) : null), [id, type]);
  const [server, setServer] = useState<{ key: string; payload: StartersPayload } | null>(null);
  const [graceKey, setGraceKey] = useState('');
  const [doneKey, setDoneKey] = useState('');
  const [lock, setLock] = useState<{ key: string; starters: Starter[] } | null>(null);
  const graceElapsed = !!id && graceKey === key;
  const title = hint?.title || '';
  const year = hint?.year || '';

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => setGraceKey(key), LIBRARY_WAIT_MS);
    return () => clearTimeout(timer);
  }, [id, key]);

  useEffect(() => {
    if (!id || local) return;
    let cancelled = false;
    const ref = doc(db, 'askAiStarters', starterDocId(type, id));
    const accept = (p: StartersPayload | null) => {
      if (cancelled || !fresh(p)) return;
      writeLocal(type, id, p);
      setServer((prev) => {
        if (prev?.key === key && (prev.payload.source === 'llm' || p.source !== 'llm')) return prev;
        return { key, payload: p };
      });
    };

    const shared = user
      ? getDoc(ref)
          .then((snap) => (snap.exists() ? (snap.data() as StartersPayload) : null))
          .catch(() => null)
      : Promise.resolve(null);
    shared.then((p) => accept(p));

    const titleQ = title ? `&title=${encodeURIComponent(title)}` : '';
    const yearQ = year ? `&year=${encodeURIComponent(year)}` : '';
    fetch(`/api/movie-starters?id=${id}&type=${type}${titleQ}${yearQ}`)
      .then((r) => (r.ok ? (r.json() as Promise<StartersPayload>) : null))
      .then(async (p) => {
        if (fresh(p)) {
          accept(p);
          const existing = await shared;
          if (user && p.source === 'llm' && p.starters.length && !fresh(existing)) {
            const body = JSON.parse(JSON.stringify({ version: p.version, source: p.source, generatedAt: p.generatedAt, starters: p.starters }));
            void setDoc(ref, body).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDoneKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [id, type, key, local, user, title, year]);

  const serverPayload = server?.key === key ? server.payload : null;
  const shown = lock?.key === key ? lock.starters : null;
  const resolved = resolveVisibleStarters({
    shown,
    local: local ? local.starters : null,
    server: serverPayload ? serverPayload.starters : null,
    graceElapsed,
    hasLogged,
    logKnown,
  });
  if (lock && lock.key !== key) {
    setLock(key && resolved ? { key, starters: resolved } : null);
  } else if (key && resolved && !lock) {
    setLock({ key, starters: resolved });
  }

  const starters = shown ?? resolved ?? [];
  const waiting = !!id && resolved == null && doneKey !== key;
  return { starters, loading: waiting, source: serverPayload?.source || local?.source };
}
