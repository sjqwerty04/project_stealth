import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Bookmark, BookmarkCheck, Info } from 'lucide-react';
import SelectScore from '../SelectScore';
import VerdictPicker from '../VerdictPicker';
import type { Verdict } from '../../lib/library';
import type { TasteSnapshot } from '../../lib/taste/types';
import type { OrbitMovie } from '../../stores/orbitStore';

const WATCHED_LABELS: Partial<Record<Verdict, string>> = {
  okay: 'Meh',
};

interface OrbitCardProps {
  movie: OrbitMovie;
  isSaved: boolean;
  snapshot: TasteSnapshot;
  connectionReason?: string;
  onInfoPress?: () => void;
  onVerdict?: (verdict: Verdict) => void;
  verdictDisabled?: boolean;
  isActive?: boolean;
}

const buildImageUrl = (path: string | null, size: 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export default function OrbitCard({
  movie,
  isSaved,
  snapshot,
  connectionReason,
  onInfoPress,
  onVerdict,
  verdictDisabled = false,
  isActive = true,
}: OrbitCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const posterUrl = buildImageUrl(movie.posterPath, 'w500');
  const backdropUrl = buildImageUrl(movie.backdropPath, 'w780');

  const stopGesture = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfoPress?.();
  };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center overflow-y-auto px-6 pb-24 pt-20"
      style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop gradient overlay */}
      {backdropUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />

      {/* Card content */}
      <div className="relative z-10 my-auto flex w-full max-w-sm flex-col items-center">
        {/* Connection reason badge */}
        {connectionReason && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20"
          >
            <p className="text-sm text-white/90 font-medium">{connectionReason}</p>
          </motion.div>
        )}

        {/* Poster */}
        <motion.div
          className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10"
          style={{ 
            boxShadow: `0 25px 50px -12px ${movie.dominantHex}66, 0 0 0 1px ${movie.dominantHex}33` 
          }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className="h-96 max-h-[40vh] w-64 object-cover"
              loading="eager"
            />
          ) : (
            <div 
              className="flex h-96 max-h-[40vh] w-64 items-center justify-center"
              style={{ backgroundColor: movie.dominantHex }}
            >
              <Star className="w-16 h-16 text-white/50" />
            </div>
          )}

          {onVerdict ? (
            <button
              type="button"
              data-testid="orbit-watched"
              onPointerDown={stopGesture}
              onClick={(event) => {
                stopGesture(event);
                setPickerOpen((open) => !open);
              }}
              disabled={verdictDisabled}
              className="absolute top-3 right-3 z-30 min-h-11 px-3 bg-black/75 border border-white/30 font-spec text-[10px] uppercase tracking-widest text-fg disabled:opacity-50"
            >
              Watched?
            </button>
          ) : null}

          {/* Save indicator overlay */}
          {isSaved && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-3 left-3 p-2 rounded-full bg-green-500 shadow-lg"
            >
              <BookmarkCheck className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </motion.div>

        {pickerOpen && onVerdict ? (
          <div
            data-testid="orbit-verdict-picker"
            className="mt-4 w-full border border-line bg-base-2 p-3"
            onPointerDown={stopGesture}
          >
            <VerdictPicker
              value={null}
              onChange={(verdict) => {
                setPickerOpen(false);
                onVerdict(verdict);
              }}
              disabled={verdictDisabled}
              size="sm"
              labels={WATCHED_LABELS}
            />
          </div>
        ) : null}

        {/* Movie info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-1">{movie.title}</h2>
          <div className="flex justify-center" onPointerDown={stopGesture}>
            <SelectScore
              movieId={movie.id}
              title={movie.title}
              year={movie.year}
              snapshot={snapshot}
            />
          </div>
          <p className="text-white/60 text-lg">{movie.year}</p>
          
          {movie.director && (
            <p className="text-white/40 text-sm mt-2">
              Directed by {movie.director}
            </p>
          )}

          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {movie.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info button */}
        {onInfoPress && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={handleInfoClick}
            className="mt-4 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <Info className="w-4 h-4 text-white" />
            <span className="text-sm text-white/90 font-medium">View Details</span>
          </motion.button>
        )}

        {/* Save button hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex items-center gap-2 text-white/40 text-sm"
        >
          <Bookmark className="w-4 h-4" />
          <span>Hold to save</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

