import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, CalendarPlus, Loader2, RefreshCw, SkipForward } from 'lucide-react';
import { useRecommendation, type RecommendationResult } from '../hooks/useRecommendation';

type RecommendationCardProps = {
  onAddToCalendar: (movie: RecommendationResult) => void;
};

export default function RecommendationCard({ onAddToCalendar }: RecommendationCardProps) {
  const navigate = useNavigate();
  const {
    picks,
    isLoading,
    error,
    generateRecommendation,
    rateRecommendation,
    refreshRecommendation,
    skipRecommendation,
  } = useRecommendation();

  const [busyId, setBusyId] = useState<number | null>(null);

  const handleRate = async (rec: RecommendationResult, rating: 'up' | 'down') => {
    setBusyId(rec.movieId);
    await rateRecommendation(rec, rating);
    await refreshRecommendation();
    setBusyId(null);
  };

  const handleSkip = async (rec: RecommendationResult) => {
    setBusyId(rec.movieId);
    await skipRecommendation(rec);
    await refreshRecommendation();
    setBusyId(null);
  };

  if (isLoading && !picks.length) {
    return (
      <div className="mx-4 mb-4 p-3 border border-line">
        <div className="flex items-center gap-3">
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Your Selects</span>
          <Loader2 className="w-4 h-4 animate-spin ml-auto" />
        </div>
      </div>
    );
  }

  if (error && !picks.length) {
    return (
      <div className="mx-4 mb-4 p-3 border border-line">
        <div className="flex items-center gap-3">
          <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Your Selects</span>
          <button type="button" onClick={() => generateRecommendation(true)} className="ml-auto text-xs">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!picks.length) return null;

  return (
    <div className="mx-4 mb-4 border border-line">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Your Selects</span>
        <button type="button" onClick={() => refreshRecommendation()} disabled={isLoading} className="p-1">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      {picks.map((rec) => (
        <div key={rec.movieId} className="border-t border-line">
          <div
            className="flex gap-3 p-3 cursor-pointer"
            onClick={() => navigate(`/movie/${rec.movieId}?type=${rec.mediaType || 'movie'}`)}
          >
            <img src={rec.poster} alt={rec.title} className="w-16 h-24 object-cover shrink-0" />
            <div className="min-w-0">
              <h4 className="font-bold text-fg text-sm truncate">{rec.title}</h4>
              <p className="text-xs text-fg-3">{rec.year}{rec.runtime ? ` • ${rec.runtime}` : ''}</p>
              {rec.reason && (
                <p className="text-xs text-fg-2 mt-1" data-testid="why-match">{rec.reason}</p>
              )}
            </div>
          </div>
          <div className="flex border-t border-line">
            <button type="button" onClick={() => handleRate(rec, 'up')} disabled={busyId === rec.movieId} className="flex-1 py-2 text-xs">
              <ThumbsUp size={14} className="inline mr-1" />Like
            </button>
            <button type="button" onClick={() => handleRate(rec, 'down')} disabled={busyId === rec.movieId} className="flex-1 py-2 text-xs">
              <ThumbsDown size={14} className="inline mr-1" />Pass
            </button>
            <button type="button" onClick={() => handleSkip(rec)} disabled={busyId === rec.movieId} className="flex-1 py-2 text-xs">
              <SkipForward size={14} className="inline mr-1" />Skip
            </button>
            <button type="button" onClick={() => onAddToCalendar(rec)} className="flex-1 py-2 text-xs">
              <CalendarPlus size={14} className="inline mr-1" />Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
