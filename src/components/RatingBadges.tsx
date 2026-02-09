import type { MovieRatings } from '../hooks/useMovieDetails';

interface RatingBadgesProps {
  ratings: MovieRatings;
}

export default function RatingBadges({ ratings }: RatingBadgesProps) {
  const badges = [];

  // IMDb rating
  if (ratings.imdb) {
    badges.push({
      id: 'imdb',
      logo: '/imdb-logo.png',
      value: ratings.imdb,
      color: 'text-yellow-400',
    });
  }

  // Rotten Tomatoes
  if (ratings.rottenTomatoes) {
    badges.push({
      id: 'rt',
      logo: '/rt-logo.png',
      value: ratings.rottenTomatoes,
      color: 'text-red-400',
    });
  }

  // Metacritic
  if (ratings.metacritic) {
    badges.push({
      id: 'metacritic',
      logo: '/metacritic-logo.png',
      value: ratings.metacritic,
      color: 'text-green-400',
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
        >
          <img 
            src={badge.logo} 
            alt={badge.id} 
            className="h-5 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className={`text-sm font-bold ${badge.color}`}>
            {badge.value}
          </span>
        </div>
      ))}
    </div>
  );
}
