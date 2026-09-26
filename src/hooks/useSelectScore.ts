import { useQuery } from '@tanstack/react-query';
import { blendSelect, type BlendResult } from '../lib/selectScore/blend';
import { forYouScore } from '../lib/selectScore/forYou';
import { fillClientRatings, parsePublicScores } from '../lib/selectScore/public';
import { emptyPublicScores, SOURCE_KEYS, type PublicScores } from '../lib/selectScore/types';
import type { TasteSnapshot } from '../lib/taste/types';

export type SelectScoreQuery = {
  movieId: number;
  title: string;
  year: string;
  imdbId?: string | null;
  stars?: number | null;
  snapshot: TasteSnapshot;
  clientRatings?: { imdb?: string | null; rottenTomatoes?: string | null; metacritic?: string | null } | null;
};

async function fetchPublicScores(input: SelectScoreQuery): Promise<PublicScores> {
  const params = new URLSearchParams();
  if (input.imdbId) params.set('imdbId', input.imdbId);
  params.set('tmdbId', String(input.movieId));
  params.set('title', input.title);
  if (input.year) params.set('year', input.year);
  params.set('select', '1');
  const response = await fetch(`/api/letterboxd-rating?${params.toString()}`);
  if (!response.ok) throw new Error('select-score');
  return parsePublicScores(await response.json());
}

export function useSelectScore(input: SelectScoreQuery | null): BlendResult & { ready: boolean } {
  const query = useQuery({
    queryKey: ['select-score', input?.imdbId ?? '', input?.movieId ?? 0, input?.title ?? '', input?.year ?? ''],
    enabled: Boolean(input && (input.imdbId || input.title)),
    queryFn: () => fetchPublicScores(input as SelectScoreQuery),
    staleTime: 12 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const forYou = input
    ? forYouScore({
        movieId: input.movieId,
        title: input.title,
        stars: input.stars,
        history: input.snapshot.context.history,
        lastPicks: input.snapshot.generated.lastPicks,
        library: input.snapshot.generated.library ?? null,
      })
    : null;

  const ready = !input || query.isFetched || query.isError;
  if (!ready) return { score: null, weighted: null, rows: [], ready: false };

  const scores = fillClientRatings(query.data ?? emptyPublicScores(), input?.clientRatings);
  const sources = SOURCE_KEYS.map((key) => ({
    key,
    native: scores?.[key].value ?? null,
    count: scores?.[key].count ?? null,
  }));
  return { ...blendSelect(forYou, sources), ready: true };
}
