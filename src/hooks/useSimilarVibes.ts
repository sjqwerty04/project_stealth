import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTaste } from '../lib/taste';
import { loadLineageNeighbors } from '../lib/similar/loadLineage';
import { mergeNeighborPools, rankNeighbors } from '../lib/similar/rankNeighbors';
import { readAdjacency, writeAdjacency } from '../lib/similar/adjacencyStore';
import { fetchScholarNeighbors } from '../lib/similar/prefetch';
import { SIMILAR_GRID_INITIAL, SIMILAR_GRID_MORE, type FilmNeighbor } from '../lib/similar/types';

export type SimilarMovieInput = {
  id: number;
  title: string;
  year: string;
  genres: string[];
  lineagePersonIds: number[];
};

export function useSimilarVibes(movie: SimilarMovieInput) {
  const { snapshot } = useTaste();
  const [lineage, setLineage] = useState<FilmNeighbor[]>([]);
  const [scholar, setScholar] = useState<FilmNeighbor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshed, setRefreshed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SIMILAR_GRID_INITIAL);
  const personKey = movie.lineagePersonIds.join(',');
  const genreKey = movie.genres.join(',');

  useEffect(() => {
    let cancelled = false;

    const lineagePromise = loadLineageNeighbors(movie.id, movie.lineagePersonIds)
      .then((rows) => {
        if (!cancelled) setLineage(rows);
      })
      .catch(() => {
        if (!cancelled) setLineage([]);
      });

    const scholarPromise = (async () => {
      const cached = await readAdjacency(movie.id).catch(() => null);
      if (cancelled) return;
      if (cached?.neighbors.length) {
        setScholar(cached.neighbors);
        setRefreshed(true);
        return;
      }
      const rows = await fetchScholarNeighbors({
        movieId: movie.id,
        title: movie.title,
        year: movie.year,
        genres: movie.genres,
      });
      if (cancelled) return;
      if (rows.length) {
        setScholar(rows);
        setRefreshed(true);
        await writeAdjacency(movie.id, rows).catch(() => {});
      }
    })();

    void Promise.allSettled([lineagePromise, scholarPromise]).then(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [movie.id, movie.title, movie.year, movie.genres, movie.lineagePersonIds, personKey, genreKey]);

  const ranked = useMemo(
    () =>
      rankNeighbors({
        currentMovieId: movie.id,
        neighbors: mergeNeighborPools(lineage, scholar),
        snapshot,
      }),
    [movie.id, lineage, scholar, snapshot],
  );

  const similarMovies = ranked.slice(0, visibleCount);
  const hasMore = ranked.length > visibleCount;

  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + SIMILAR_GRID_MORE);
  }, []);

  return {
    similarMovies,
    isLoading: isLoading && similarMovies.length === 0,
    hasMore,
    loadMore,
    refreshed: refreshed && scholar.length > 0,
  };
}
