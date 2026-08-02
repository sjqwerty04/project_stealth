import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

export type MovieSnippet = { text: string; score: number; url: string };

export type MovieInsights = {
  knownForTags: string[];
  suggestedQuestions: string[];
  snippets: MovieSnippet[];
  blocked: boolean;
};

const EMPTY: MovieInsights = { knownForTags: [], suggestedQuestions: [], snippets: [], blocked: false };

// Fetches Reddit-grounded "known for" tags + most-asked questions for a movie.
// Snippets are returned so the chat can reuse them as grounding.
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
    apiFetch(`/api/reddit-context?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data) => {
        if (cancelled) return;
        setInsights({
          knownForTags: data.knownForTags || [],
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
