import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ThumbsUp, ThumbsDown, CalendarPlus, Loader2, RefreshCw, SkipForward } from 'lucide-react';
import { useRecommendation, type RecommendationResult } from '../hooks/useRecommendation';

type RecommendationCardProps = {
  onAddToCalendar: (movie: RecommendationResult) => void;
};

export default function RecommendationCard({ onAddToCalendar }: RecommendationCardProps) {
  const navigate = useNavigate();
  const {
    recommendation,
    isLoading,
    error,
    generateRecommendation,
    rateRecommendation,
    refreshRecommendation,
    skipRecommendation,
  } = useRecommendation();

  const [isRating, setIsRating] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'up' | 'down' | null>(null);

  // Auto-generate recommendation on mount if none exists
  useEffect(() => {
    if (!recommendation && !isLoading && !error) {
      generateRecommendation();
    }
  }, []);

  const handleRate = async (rating: 'up' | 'down') => {
    if (!recommendation || isRating) return;
    
    setIsRating(true);
    setShowSuccess(rating);
    
    await rateRecommendation(recommendation, rating);
    
    // Brief delay to show success state
    setTimeout(() => {
      setShowSuccess(null);
      setIsRating(false);
      // Generate new recommendation after rating
      refreshRecommendation();
    }, 600);
  };

  const handleAddToCalendar = () => {
    if (recommendation) {
      onAddToCalendar(recommendation);
    }
  };

  const handleSkip = async () => {
    if (!recommendation || isSkipping) return;
    
    setIsSkipping(true);
    
    await skipRecommendation(recommendation);
    
    // Generate new recommendation
    setTimeout(() => {
      setIsSkipping(false);
      refreshRecommendation();
    }, 200);
  };

  if (isLoading && !recommendation) {
    return (
      <div className="mx-4 mb-4 p-3 rounded-xl bg-gray-900/80 border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-blue-500/10">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-white">Next Watch</span>
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin ml-auto" />
        </div>
      </div>
    );
  }

  if (error && !recommendation) {
    return (
      <div className="mx-4 mb-4 p-3 rounded-xl bg-gray-900/80 border border-gray-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-1.5 rounded-full bg-blue-500/10">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-white">Next Watch</span>
          <button
            onClick={() => generateRecommendation()}
            className="ml-auto text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
        <p className="text-xs text-red-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!recommendation) return null;

  return (
    <div className="mx-4 mb-4 rounded-xl bg-gray-900/80 border border-gray-800 overflow-hidden">
      {/* Compact Card Layout - Clickable to movie detail */}
      <div 
        className="flex gap-3 p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => navigate(`/movie/${recommendation.movieId}?type=${recommendation.mediaType || 'movie'}`)}
      >
        {/* Poster */}
        <img
          src={recommendation.poster}
          alt={recommendation.title}
          className="w-16 h-24 object-cover rounded-lg border border-gray-700 flex-shrink-0"
        />
        
        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wide">Next Watch</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                refreshRecommendation();
              }}
              disabled={isLoading}
              className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          {/* Title */}
          <h4 className="font-bold text-white text-sm leading-tight truncate mt-0.5">
            {recommendation.title}
          </h4>
          
          {/* Meta info */}
          <p className="text-xs text-gray-400 mt-0.5">
            {recommendation.year}
            {recommendation.runtime && ` • ${recommendation.runtime}`}
          </p>
          
          {/* Director */}
          {recommendation.director && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Dir. {recommendation.director}
            </p>
          )}
          
          {/* Genres */}
          {recommendation.genres && recommendation.genres.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {recommendation.genres.map((genre) => (
                <span
                  key={genre}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compact Action Buttons */}
      <div className="flex border-t border-gray-800">
        {/* Like */}
        <button
          onClick={() => handleRate('up')}
          disabled={isRating || isSkipping}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-all border-r border-gray-800 ${
            showSuccess === 'up'
              ? 'bg-green-500 text-white'
              : 'text-green-400 hover:bg-green-900/30'
          } disabled:opacity-50`}
        >
          <ThumbsUp size={14} className={showSuccess === 'up' ? 'fill-current' : ''} />
          {showSuccess === 'up' ? 'Liked!' : 'Like'}
        </button>
        
        {/* Pass */}
        <button
          onClick={() => handleRate('down')}
          disabled={isRating || isSkipping}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-all border-r border-gray-800 ${
            showSuccess === 'down'
              ? 'bg-red-500 text-white'
              : 'text-red-400 hover:bg-red-900/30'
          } disabled:opacity-50`}
        >
          <ThumbsDown size={14} className={showSuccess === 'down' ? 'fill-current' : ''} />
          {showSuccess === 'down' ? 'Noted!' : 'Pass'}
        </button>
        
        {/* Skip */}
        <button
          onClick={handleSkip}
          disabled={isRating || isSkipping}
          className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:bg-gray-800 transition-all border-r border-gray-800 disabled:opacity-50"
        >
          <SkipForward size={14} />
          Skip
        </button>
        
        {/* Add to Calendar */}
        <button
          onClick={handleAddToCalendar}
          disabled={isRating || isSkipping}
          className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50"
        >
          <CalendarPlus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}
