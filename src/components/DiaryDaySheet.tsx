import { format } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { eventVerdict, type CalendarEvent } from '../hooks/useCalendarLogs';
import type { LibraryFilm } from '../lib/library';
import { VerdictBadge } from './VerdictPicker';

/** Every film logged on one day, the way the Letterboxd diary lists a date. */
export default function DiaryDaySheet({
  date,
  logs,
  library,
  onClose,
  onOpenMovie,
  onAddMovie,
}: {
  date: Date | null;
  logs: CalendarEvent[];
  library: Map<number, LibraryFilm>;
  onClose: () => void;
  onOpenMovie: (id: number, mediaType?: string) => void;
  onAddMovie: (date: Date) => void;
}) {
  if (!date) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="diary-day-sheet">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-base border-t border-line p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Diary</p>
            <h3 className="font-display text-xl text-fg">{format(date, 'EEEE, MMM d yyyy')}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 min-h-11 min-w-11 text-fg-3 hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-2">
          {logs.map((log) => {
            const film = library.get(log.movieId);
            const verdict = film?.verdict ?? eventVerdict(log);
            const count = film?.watchCount ?? 0;
            return (
              <li key={log.id}>
                <button
                  type="button"
                  data-testid="diary-day-film"
                  onClick={() => onOpenMovie(log.movieId, log.mediaType)}
                  className="w-full flex items-center gap-3 p-2 border border-line bg-base-2 text-left min-h-11"
                >
                  <img src={log.poster} alt="" className="w-10 aspect-[2/3] object-cover bg-base-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{log.title}</p>
                    <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">
                      {log.year ?? ''}
                      {log.rewatch || count > 1 ? ` · ${log.rewatch ? 'Rewatch' : `x${count}`}` : ''}
                      {typeof log.stars === 'number' ? ` · ${log.stars}★` : ''}
                    </p>
                  </div>
                  {verdict && <VerdictBadge verdict={verdict} size={22} />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => onAddMovie(date)}
          className="w-full min-h-11 border border-line text-fg text-sm flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Log another film this day
        </button>
      </div>
    </div>
  );
}
