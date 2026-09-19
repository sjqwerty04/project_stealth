import { useState } from 'react';
import { Calendar, BookmarkPlus, Eye, Check, RotateCcw } from 'lucide-react';
import SelectsChaseLoader from './ui/SelectsChaseLoader';
import AddToListPicker, { type PickerMovie } from './AddToListPicker';
import VerdictPicker, { VerdictBadge } from './VerdictPicker';
import { VERDICT_LABEL, type LibraryFilm, type Verdict } from '../lib/library';

type MovieActionsProps = {
  movie: PickerMovie;
  onAddToCalendar: () => void;
  onVerdict: (verdict: Verdict) => void;
  isInWatchlist: boolean;
  film: LibraryFilm | null;
  isAddingToCalendar?: boolean;
  isSavingVerdict?: boolean;
};

export function watchCountLabel(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return 'Watched once';
  if (count === 2) return 'Watched twice';
  return `Watched ${count} times`;
}

export default function MovieActions({
  movie,
  onAddToCalendar,
  onVerdict,
  isInWatchlist,
  film,
  isAddingToCalendar = false,
  isSavingVerdict = false,
}: MovieActionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showVerdict, setShowVerdict] = useState(false);
  const watched = film?.watched === true;
  const verdict = film?.verdict ?? null;

  return (
    <>
      {watched && (
        <div className="flex items-center justify-center gap-2 font-spec text-[10px] uppercase tracking-widest text-fg-3" data-testid="watch-status">
          {verdict && <VerdictBadge verdict={verdict} size={16} />}
          <span data-testid="watch-count">{watchCountLabel(film?.watchCount ?? 1)}</span>
          {verdict && <span>· {VERDICT_LABEL[verdict]}</span>}
          {film?.lastWatchedAt && <span>· Last {film.lastWatchedAt}</span>}
        </div>
      )}
      {!watched && film?.onWatchlist && (
        <p className="text-center font-spec text-[10px] uppercase tracking-widest text-fg-3" data-testid="watch-status">
          On your watchlist
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onAddToCalendar}
          disabled={isAddingToCalendar}
          aria-label={watched ? 'Log again' : 'Add to calendar'}
          data-testid="action-log"
          className="flex-1 flex items-center justify-center gap-2 min-h-11 py-3.5 px-4 bg-fg text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: 0 }}
        >
          {isAddingToCalendar ? (
            <SelectsChaseLoader size="xs" activeColor="#000000" idleColor="#666666" />
          ) : watched ? (
            <RotateCcw className="w-5 h-5" />
          ) : (
            <Calendar className="w-5 h-5" />
          )}
          <span>{watched ? 'Log again' : 'Add to Calendar'}</span>
        </button>

        <button
          onClick={() => setShowPicker(true)}
          aria-label={isInWatchlist ? 'Saved' : 'Save'}
          data-testid="action-watchlist"
          className={`flex items-center justify-center gap-2 min-h-11 py-3.5 px-4 font-semibold ${
            isInWatchlist
              ? 'bg-base-3 text-fg border border-fg'
              : 'bg-base-3 text-fg border border-line'
          }`}
          style={{ borderRadius: 0 }}
        >
          {isInWatchlist ? <Check className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
          <span className="hidden sm:inline">{isInWatchlist ? 'Saved' : 'Save'}</span>
        </button>

        <button
          onClick={() => setShowVerdict((v) => !v)}
          disabled={isSavingVerdict}
          aria-label={watched ? 'Change verdict' : 'Mark as seen'}
          aria-expanded={showVerdict}
          data-testid="action-like"
          className={`flex items-center justify-center gap-2 min-h-11 py-3.5 px-4 font-semibold border disabled:opacity-50 ${
            verdict ? 'bg-base-3 text-fg border-fg' : 'bg-base-3 text-fg border-line'
          }`}
          style={{ borderRadius: 0 }}
        >
          {isSavingVerdict ? (
            <SelectsChaseLoader size="xs" />
          ) : verdict ? (
            <VerdictBadge verdict={verdict} size={20} />
          ) : (
            <Eye className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">{verdict ? VERDICT_LABEL[verdict] : 'Seen'}</span>
        </button>
      </div>

      {showVerdict && (
        <VerdictPicker
          value={verdict}
          disabled={isSavingVerdict}
          onChange={(v) => {
            onVerdict(v);
            setShowVerdict(false);
          }}
        />
      )}

      <AddToListPicker movie={movie} open={showPicker} onClose={() => setShowPicker(false)} />
    </>
  );
}
