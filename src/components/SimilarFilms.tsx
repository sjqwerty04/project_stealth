import SelectsChaseLoader from './ui/SelectsChaseLoader';
import { useSimilarVibes, type SimilarMovieInput } from '../hooks/useSimilarVibes';

const buildImageUrl = (path: string | null, size: 'w200' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export default function SimilarFilms({
  movie,
  onOpen,
}: {
  movie: SimilarMovieInput;
  onOpen: (movieId: number) => void;
}) {
  const { similarMovies, isLoading, loadMore, hasMore, refreshed, scholarLoading, scholarElapsed } =
    useSimilarVibes(movie);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Similar Films</h3>
      {scholarLoading && (
        <div
          data-testid="similar-scholar-loading"
          className="flex items-center gap-2 mb-3 text-xs text-purple-300"
        >
          <SelectsChaseLoader size="xs" />
          <span>Finding cinephile matches · {scholarElapsed}s</span>
        </div>
      )}
      {refreshed && (
        <p data-testid="similar-refreshed" className="text-xs text-purple-300 mb-3">
          Updated with cinephile matches
        </p>
      )}
      {isLoading && similarMovies.length === 0 ? (
        <div className="flex justify-center py-10">
          <SelectsChaseLoader size="md" />
        </div>
      ) : similarMovies.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5" data-testid="similar-grid">
          {similarMovies.map((row) => (
            <button
              key={row.movieId}
              onClick={() => onOpen(row.movieId)}
              className="text-left group"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#18181b] group-hover:ring-2 ring-purple-500/60 transition-all relative">
                {row.posterPath ? (
                  <img
                    src={buildImageUrl(row.posterPath, 'w200')!}
                    alt={row.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <span className="text-[10px] text-gray-500 text-center leading-tight">{row.title}</span>
                  </div>
                )}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                  {row.source === 'lineage' && (
                    <span
                      data-testid="similar-source-lineage"
                      className="px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] uppercase tracking-wide text-gray-200"
                    >
                      Lineage
                    </span>
                  )}
                  {row.source === 'scholar' && (
                    <span
                      data-testid="similar-source-for-you"
                      className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-[9px] uppercase tracking-wide text-white"
                    >
                      For you
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-gray-300 mt-1 line-clamp-1 leading-tight">{row.title}</p>
              {row.year && <p className="text-[10px] text-gray-600">{row.year}</p>}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center py-8 text-sm">Finding similar vibes…</p>
      )}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoading}
          className="w-full mt-3 py-3 rounded-2xl bg-[#18181b] text-gray-400 hover:text-white hover:bg-[#27272a] border border-white/5 text-sm transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
