import type { MovieRatings } from '../hooks/useMovieDetails';

interface RatingBadgesProps {
  ratings: MovieRatings;
}

// Rotten Tomatoes: >= 60% is Fresh (red), < 60% is Rotten (green)
const getRTColor = (value: string): string => {
  const num = parseInt(value);
  if (isNaN(num)) return 'text-red-500';
  return num >= 60 ? 'text-red-500' : 'text-green-500';
};

// Metacritic: 61-100 green, 40-60 yellow, 0-39 red
const getMetacriticColor = (value: string): string => {
  const num = parseInt(value);
  if (isNaN(num)) return 'text-yellow-400';
  if (num >= 61) return 'text-green-500';
  if (num >= 40) return 'text-yellow-400';
  return 'text-red-500';
};

export default function RatingBadges({ ratings }: RatingBadgesProps) {
  const badges = [];

  // IMDb rating — always yellow
  if (ratings.imdb) {
    badges.push({
      id: 'imdb',
      logo: '/imdb-logo.png',
      value: ratings.imdb,
      color: 'text-yellow-400',
    });
  }

  // Rotten Tomatoes — red/green by 60% threshold
  if (ratings.rottenTomatoes) {
    badges.push({
      id: 'rt',
      logo: '/rt-logo.png',
      value: ratings.rottenTomatoes,
      color: getRTColor(ratings.rottenTomatoes),
    });
  }

  // Metacritic — green/yellow/red by score range
  if (ratings.metacritic) {
    badges.push({
      id: 'metacritic',
      logo: '/metacritic-logo.png',
      value: ratings.metacritic,
      color: getMetacriticColor(ratings.metacritic),
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex items-center gap-1.5"
        >
          <img 
            src={badge.logo} 
            alt={badge.id} 
            className="h-4 w-auto"
          />
          <span className={`text-xs font-bold ${badge.color}`}>
            {badge.value}
          </span>
        </div>
      ))}
    </div>
  );
}
