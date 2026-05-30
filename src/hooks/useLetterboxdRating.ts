import { useState, useEffect } from 'react';

export function useLetterboxdRating(tmdbId: number | undefined, title?: string, year?: string) {
  const [rating, setRating] = useState<string | null>(null);
  const [filmUrl, setFilmUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId) return;
    let cancelled = false;

    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      title: title || '',
      year: year || '',
    });

    fetch(`/api/letterboxd-rating?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { rating: null, filmUrl: null }))
      .then((data) => {
        if (cancelled) return;
        setRating(data.rating || null);
        setFilmUrl(data.filmUrl || null);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [tmdbId, title, year]);

  return { rating, filmUrl };
}
