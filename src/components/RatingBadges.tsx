import type { MovieRatings } from '../hooks/useMovieDetails';

interface RatingBadgesProps {
  ratings: MovieRatings;
  letterboxdRating?: string | null;
  letterboxdUrl?: string | null;
}

const rtColor = (v: string) => {
  const n = parseInt(v);
  return isNaN(n) || n >= 60 ? '#fa320a' : '#4b9c2f';
};

const mcBg = (v: string) => {
  const n = parseInt(v);
  if (isNaN(n)) return '#ffcc34';
  if (n >= 61) return '#6ac045';
  if (n >= 40) return '#ffcc34';
  return '#f00';
};

export default function RatingBadges({ ratings, letterboxdRating, letterboxdUrl }: RatingBadgesProps) {
  const hasAny = ratings.imdb || ratings.rottenTomatoes || ratings.metacritic || letterboxdRating;
  if (!hasAny) return null;

  return (
    <div className="flex items-center justify-center gap-5 flex-wrap">

      {/* IMDb — real logo + big score */}
      {ratings.imdb && (
        <div className="flex items-center gap-1.5">
          <img src="/imdb-logo.png" alt="IMDb" className="h-4 w-auto" />
          <span className="text-white text-xl font-black tabular-nums leading-none">
            {ratings.imdb}
          </span>
        </div>
      )}

      {/* Rotten Tomatoes — real logo + score in RT red/green */}
      {ratings.rottenTomatoes && (
        <div className="flex items-center gap-1.5">
          <img src="/rt-logo.png" alt="RT" className="h-5 w-auto" />
          <span
            className="text-xl font-black tabular-nums leading-none"
            style={{ color: rtColor(ratings.rottenTomatoes) }}
          >
            {ratings.rottenTomatoes}
          </span>
        </div>
      )}

      {/* Metacritic — real logo + score in MC color */}
      {ratings.metacritic && (
        <div className="flex items-center gap-1.5">
          <img src="/metacritic-logo.png" alt="Metacritic" className="h-4 w-auto" />
          <span
            className="text-xl font-black tabular-nums leading-none"
            style={{ color: mcBg(ratings.metacritic) }}
          >
            {ratings.metacritic}
          </span>
        </div>
      )}

      {/* Letterboxd — three overlapping circles + score */}
      {letterboxdRating && (
        <div className="flex items-center gap-1.5">
          {letterboxdUrl ? (
            <a href={letterboxdUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
              <svg width="22" height="13" viewBox="0 0 66 39" fill="none">
                <circle cx="13" cy="19.5" r="13" fill="#00b020" />
                <circle cx="33" cy="19.5" r="13" fill="#40bcf4" />
                <circle cx="53" cy="19.5" r="13" fill="#ff8000" />
              </svg>
              <span className="text-white text-xl font-black tabular-nums leading-none">{letterboxdRating}</span>
            </a>
          ) : (
            <>
              <svg width="22" height="13" viewBox="0 0 66 39" fill="none">
                <circle cx="13" cy="19.5" r="13" fill="#00b020" />
                <circle cx="33" cy="19.5" r="13" fill="#40bcf4" />
                <circle cx="53" cy="19.5" r="13" fill="#ff8000" />
              </svg>
              <span className="text-white text-xl font-black tabular-nums leading-none">{letterboxdRating}</span>
            </>
          )}
        </div>
      )}

    </div>
  );
}
