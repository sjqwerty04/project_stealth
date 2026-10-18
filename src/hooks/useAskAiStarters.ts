import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { visibleStarters, type Starter } from '../lib/askAi/starters';

export type StartersPayload = {
  version: number;
  source: 'llm' | 'template';
  generatedAt: string;
  starters: Starter[];
};

const VERSION = 2;
const LLM_TTL_MS = 7 * 24 * 3600_000;
const TEMPLATE_TTL_MS = 10 * 60_000;
const localKey = (type: string, id: number) => `selects.askAi.starters.v${VERSION}.${type}.${id}`;
export const starterDocId = (type: string, id: number) => `v${VERSION}_${type}_${id}`;

function fresh(p: StartersPayload | null | undefined): p is StartersPayload {
  if (!p || p.version !== VERSION || !Array.isArray(p.starters) || !p.starters.length) return false;
  const age = Date.now() - new Date(p.generatedAt).getTime();
  return age < (p.source === 'llm' ? LLM_TTL_MS : TEMPLATE_TTL_MS);
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
export function prefetchStarters(id: number, type: 'movie' | 'tv' = 'movie') {
  if (readLocal(type, id)) return;
  void fetch(`/api/movie-starters?id=${id}&type=${type}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => fresh(p) && writeLocal(type, id, p))
    .catch(() => {});
}

/**
 * Starters for one film. Order of preference: this device's cache, the shared
 * Firestore cache (askAiStarters/{v2_type_id}), then /api/movie-starters (CDN-cached).
 * The first set that arrives is kept for the whole visit, so chips never reorder.
 */
export function useAskAiStarters(id: number | undefined, type: 'movie' | 'tv', hasLogged: boolean) {
  const { user } = useAuth();
  const key = id ? `${type}.${id}` : '';
  const local = useMemo(() => (id ? readLocal(type, id) : null), [id, type]);
  const [fetched, setFetched] = useState<{ key: string; payload: StartersPayload | null } | null>(null);

  useEffect(() => {
    if (!id || local) return;
    let settled = false;
    let cancelled = false;
    const accept = (p: StartersPayload) => {
      if (cancelled || settled) return;
      settled = true;
      setFetched({ key, payload: p });
      writeLocal(type, id, p);
    };

    const ref = doc(db, 'askAiStarters', starterDocId(type, id));
    const shared = user
      ? getDoc(ref)
          .then((snap) => (snap.exists() ? (snap.data() as StartersPayload) : null))
          .catch(() => null)
      : Promise.resolve(null);
    shared.then((p) => fresh(p) && accept(p));

    fetch(`/api/movie-starters?id=${id}&type=${type}`)
      .then((r) => (r.ok ? (r.json() as Promise<StartersPayload>) : null))
      .then(async (p) => {
        if (!fresh(p)) return;
        accept(p);
        const existing = await shared;
        if (user && p.source === 'llm' && !fresh(existing)) {
          void setDoc(ref, { version: p.version, source: p.source, generatedAt: p.generatedAt, starters: p.starters }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && !settled) setFetched({ key, payload: null });
      });

    return () => {
      cancelled = true;
    };
  }, [id, type, key, local, user]);

  const payload = local || (fetched?.key === key ? fetched.payload : null);
  const loading = !!id && !local && fetched?.key !== key;
  const starters = useMemo(() => visibleStarters(payload?.starters || [], hasLogged), [payload, hasLogged]);
  return { starters, loading, source: payload?.source };
}
