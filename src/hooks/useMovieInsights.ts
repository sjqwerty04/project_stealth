import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/apiUrl';

export type MovieSnippet = { text: string; score: number; url: string };

export type MovieInsights = {
  suggestedQuestions: string[];
  snippets: MovieSnippet[];
  blocked: boolean;
};

const EMPTY: MovieInsights = { suggestedQuestions: [], snippets: [], blocked: false };

export function useMovieInsights(
  title: string | undefined,
  year: string | undefined,
  genres: string[] = []
) {
  const [insights, setInsights] = useState<MovieInsights>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!title) return;
    let cancelled = false;
    setIsLoading(true);
    setInsights(EMPTY);

    const params = new URLSearchParams({ title, year: year || '', genres: genres.join(', ') });
    fetch(apiUrl(`/api/reddit-context?${params.toString()}`))
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data) => {
        if (cancelled) return;
        setInsights({
          suggestedQuestions: data.suggestedQuestions || [],
          snippets: data.snippets || [],
          blocked: !!data.blocked,
        });
      })
      .catch(() => !cancelled && setInsights(EMPTY))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, year]);

  return { insights, isLoading };
}
