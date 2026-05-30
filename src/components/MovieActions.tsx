import { useState } from 'react';
import { Calendar, BookmarkPlus, Eye, ThumbsUp, ThumbsDown, Loader2, Check } from 'lucide-react';
import AddToListPicker, { type PickerMovie } from './AddToListPicker';

type MovieActionsProps = {
  movie: PickerMovie;
  onAddToCalendar: () => void;
  onMarkAsSeen: (rating: 'up' | 'down') => void;
  isInWatchlist: boolean;
  isMarkedSeen: boolean;
  isAddingToCalendar?: boolean;
  isMarkingSeen?: boolean;
  // Legacy passthrough — kept for compat but picker handles add now
  onAddToWatchlist?: () => void;
  isAddingToWatchlist?: boolean;
};

export default function MovieActions({
  movie,
  onAddToCalendar,
  onMarkAsSeen,
  isInWatchlist,
  isMarkedSeen,
  isAddingToCalendar = false,
  isMarkingSeen = false,
}: MovieActionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showRatingButtons, setShowRatingButtons] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'up' | 'down' | null>(null);

  const handleMarkAsSeenClick = () => {
    if (isMarkedSeen) return;
    setShowRatingButtons(true);
  };

  const handleRating = (rating: 'up' | 'down') => {
    setSelectedRating(rating);
    onMarkAsSeen(rating);
  };

  return (
    <>
      <div className="flex gap-3">
        {/* Add to Calendar */}
        <button
          onClick={onAddToCalendar}
          disabled={isAddingToCalendar}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white text-black font-semibold transition-all hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAddingToCalendar ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Calendar className="w-5 h-5" />
          )}
          <span>Add to Calendar</span>
        </button>

        {/* Add to List (Spotify-style picker) */}
        <button
          onClick={() => setShowPicker(true)}
          className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold transition-all ${
            isInWatchlist
              ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
              : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
          }`}
        >
          {isInWatchlist ? (
            <Check className="w-5 h-5" />
          ) : (
            <BookmarkPlus className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">{isInWatchlist ? 'Saved' : 'Save'}</span>
        </button>

        {/* Mark as Seen */}
        <div className="relative">
          {!showRatingButtons && !isMarkedSeen ? (
            <button
              onClick={handleMarkAsSeenClick}
              disabled={isMarkingSeen}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gray-800 text-white font-semibold transition-all hover:bg-gray-700 border border-gray-700 disabled:opacity-50"
            >
              {isMarkingSeen ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Seen</span>
            </button>
          ) : isMarkedSeen ? (
            <div className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold ${
              selectedRating === 'up' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {selectedRating === 'up' ? (
                <ThumbsUp className="w-5 h-5 fill-current" />
              ) : (
                <ThumbsDown className="w-5 h-5 fill-current" />
              )}
              <span className="hidden sm:inline">Rated</span>
            </div>
          ) : (
            <div className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
              <button
                onClick={() => handleRating('up')}
                disabled={isMarkingSeen}
                className="flex items-center justify-center gap-1.5 py-3.5 px-4 rounded-xl bg-green-600 text-white font-semibold transition-all hover:bg-green-500 disabled:opacity-50"
              >
                {isMarkingSeen && selectedRating === 'up' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ThumbsUp className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => handleRating('down')}
                disabled={isMarkingSeen}
                className="flex items-center justify-center gap-1.5 py-3.5 px-4 rounded-xl bg-red-600 text-white font-semibold transition-all hover:bg-red-500 disabled:opacity-50"
              >
                {isMarkingSeen && selectedRating === 'down' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ThumbsDown className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <AddToListPicker
        movie={movie}
        open={showPicker}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}
