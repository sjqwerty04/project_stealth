import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  buildStarters,
  resolveVisibleStarters,
  STARTER_GRACE_MS,
  type Starter,
  type StarterInput,
} from '../lib/askAi/starters';

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

type QuickMeta = Pick<StarterInput, 'related' | 'collection' | 'keywords'>;

function toRef(r: {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
}) {
  const title = r.title || r.name;
  if (!r.id || !title) return null;
  const year = (r.release_date || r.first_air_date || '').slice(0, 4) || undefined;
  return { id: r.id, title, year, posterPath: r.poster_path ?? null };
}

/** Recommendations and keywords for the template row. Bounded so it cannot stall the chips. */
async function fetchQuickMeta(id: number, type: 'movie' | 'tv', signal: AbortSignal): Promise<QuickMeta> {
  const key = import.meta.env.VITE_TMDB_API_KEY || '';
  if (!key) return {};
  const base = 'https://api.themoviedb.org/3';
  const res = await fetch(`${base}/${type}/${id}?api_key=${key}&append_to_response=keywords,recommendations`, { signal });
  if (!res.ok) return {};
  const data = await res.json();
  let collection: QuickMeta['collection'];
  if (data.belongs_to_collection?.id) {
    try {
      const c = await fetch(`${base}/collection/${data.belongs_to_collection.id}?api_key=${key}`, { signal });
      if (c.ok) {
        const parts = ((await c.json()).parts || []) as Parameters<typeof toRef>[0][];
        collection = parts
          .filter((p) => p.release_date)
          .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
          .map(toRef)
          .filter((f): f is NonNullable<typeof f> => !!f);
      }
    } catch {
      collection = undefined;
    }
  }
  return {
    collection,
    related: ((data.recommendations?.results || []) as Parameters<typeof toRef>[0][])
      .slice(0, 8)
      .map(toRef)
      .filter((f): f is NonNullable<typeof f> => !!f),
    keywords: ((data.keywords?.keywords || data.keywords?.results || []) as { name: string }[]).map((k) => k.name),
  };
}

/** Fetches (and warms the CDN cache for) a film's starters without rendering them. */
export function prefetchStarters(id: number, type: 'movie' | 'tv' = 'movie') {
  if (readLocal(type, id)?.source === 'llm') return;
  void fetch(`/api/movie-starters?id=${id}&type=${type}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => fresh(p) && writeLocal(type, id, p))
    .catch(() => {});
}

/**
 * Starters for one film. A fresh local or shared cache paints immediately. Otherwise
 * templates (with compare posters, once TMDB answers) paint inside STARTER_GRACE_MS.
 * Whichever set paints first is kept for the visit, so chips never reorder.
 * The spoiler is included only when the library says the film is logged.
 */
export function useAskAiStarters(
  id: number | undefined,
  type: 'movie' | 'tv',
  hasLogged: boolean,
  logKnown: boolean,
  instant: StarterInput | null,
) {
  const { user } = useAuth();
  const key = id ? `${type}.${id}` : '';
  const local = useMemo(() => (id ? readLocal(type, id) : null), [id, type]);
  const [server, setServer] = useState<{ key: string; payload: StartersPayload } | null>(null);
  const [meta, setMeta] = useState<{ key: string; value: QuickMeta } | null>(null);
  const [metaReadyKey, setMetaReadyKey] = useState('');
  const [graceKey, setGraceKey] = useState('');
  const lock = useRef<{ key: string; starters: Starter[] } | null>(null);
  const metaReady = !id || metaReadyKey === key || local?.source === 'llm';
  const graceElapsed = !!id && graceKey === key;

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => setGraceKey(key), STARTER_GRACE_MS);
    return () => clearTimeout(timer);
  }, [id, key]);

  useEffect(() => {
    if (!id || local?.source === 'llm') return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), STARTER_GRACE_MS);
    fetchQuickMeta(id, type, ctrl.signal)
      .then((value) => {
        if (!cancelled) setMeta({ key, value });
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setMetaReadyKey(key);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [id, type, key, local]);

  useEffect(() => {
    if (!id || local?.source === 'llm') return;
    let cancelled = false;
    const ref = doc(db, 'askAiStarters', starterDocId(type, id));
    const accept = (p: StartersPayload | null) => {
      if (cancelled || !fresh(p)) return;
      writeLocal(type, id, p);
      if (lock.current?.key === key) return;
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

    fetch(`/api/movie-starters?id=${id}&type=${type}`)
      .then((r) => (r.ok ? (r.json() as Promise<StartersPayload>) : null))
      .then(async (p) => {
        if (!fresh(p)) return;
        accept(p);
        const existing = await shared;
        if (user && p.source === 'llm' && !fresh(existing)) {
          const body = JSON.parse(JSON.stringify({ version: p.version, source: p.source, generatedAt: p.generatedAt, starters: p.starters }));
          void setDoc(ref, body).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, type, key, local, user]);

  const serverPayload = server?.key === key ? server.payload : null;
  const quick = meta?.key === key ? meta.value : null;
  const templates = useMemo(() => {
    if (!instant || instant.film.id !== id) return null;
    return buildStarters({ ...instant, ...quick, film: instant.film });
  }, [instant, quick, id]);

  if (lock.current && lock.current.key !== key) lock.current = null;
  const resolved = resolveVisibleStarters({
    shown: lock.current?.key === key ? lock.current.starters : null,
    local: local?.starters || null,
    server: serverPayload?.starters || null,
    templates,
    metaReady,
    graceElapsed,
    hasLogged,
    logKnown,
  });
  if (key && resolved && lock.current?.key !== key) lock.current = { key, starters: resolved };

  const starters = lock.current?.key === key ? lock.current.starters : [];
  return { starters, loading: !!id && lock.current?.key !== key, source: serverPayload?.source || local?.source };
}
