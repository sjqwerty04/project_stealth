import { useEffect, useMemo, useState } from 'react';
import { buildStarters, readTapHistory, type StarterFilm } from '../lib/askAi/starters';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_PREFIX = 'selects.askAi.meta.v1.';

type StarterMeta = { collection: StarterFilm[]; related: StarterFilm[]; keywords: string[] };
const EMPTY_META: StarterMeta = { collection: [], related: [], keywords: [] };

type Film = {
  id: number;
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  cast?: { name: string; character?: string }[];
  mediaType?: 'movie' | 'tv';
};

const toFilm = (r: { title?: string; name?: string; release_date?: string }): StarterFilm | null => {
  const title = r.title || r.name;
  return title ? { title, year: r.release_date?.slice(0, 4) } : null;
};

async function fetchMeta(id: number, mediaType: 'movie' | 'tv'): Promise<StarterMeta> {
  const cached = sessionStorage.getItem(`${CACHE_PREFIX}${mediaType}.${id}`);
  if (cached) return JSON.parse(cached);

  const res = await fetch(
    `${TMDB_BASE}/${mediaType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=keywords,recommendations`,
  );
  if (!res.ok) return EMPTY_META;
  const data = await res.json();

  let collection: StarterFilm[] = [];
  if (data.belongs_to_collection?.id) {
    const c = await fetch(`${TMDB_BASE}/collection/${data.belongs_to_collection.id}?api_key=${TMDB_API_KEY}`);
    if (c.ok) {
      const parts = ((await c.json()).parts || []) as { title?: string; release_date?: string }[];
      collection = parts
        .filter((p) => p.release_date)
        .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
        .map(toFilm)
        .filter((f): f is StarterFilm => !!f);
    }
  }
  const meta: StarterMeta = {
    collection,
    related: ((data.recommendations?.results || []) as { title?: string; name?: string; release_date?: string }[])
      .slice(0, 6)
      .map(toFilm)
      .filter((f): f is StarterFilm => !!f),
    keywords: ((data.keywords?.keywords || data.keywords?.results || []) as { name: string }[]).map((k) => k.name),
  };
  sessionStorage.setItem(`${CACHE_PREFIX}${mediaType}.${id}`, JSON.stringify(meta));
  return meta;
}

/** Tailored Ask AI starters for one film: metadata templates now, FAQ merged in when it lands. */
export function useAskAiStarters(film: Film | null, faq: string[]) {
  const [meta, setMeta] = useState<StarterMeta>(EMPTY_META);
  const id = film?.id;
  const mediaType = film?.mediaType || 'movie';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMeta(EMPTY_META);
    fetchMeta(id, mediaType)
      .then((m) => !cancelled && setMeta(m))
      .catch(() => !cancelled && setMeta(EMPTY_META));
    return () => {
      cancelled = true;
    };
  }, [id, mediaType]);

  const faqKey = faq.join('|');
  const castKey = film?.cast?.map((c) => c.name).join('|');
  return useMemo(
    () =>
      film
        ? buildStarters({
            title: film.title,
            year: film.year,
            genres: film.genres,
            director: film.director,
            cast: film.cast,
            ...meta,
            faq,
            tapHistory: readTapHistory(),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [film?.title, film?.director, castKey, meta, faqKey],
  );
}
