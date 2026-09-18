import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Plus, X, Calendar, MoreHorizontal, Bookmark, Trash2, CalendarX } from 'lucide-react';
import { useCalendarLogs, eventVerdict, type CalendarEvent } from '../hooks/useCalendarLogs';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuth } from '../hooks/useAuth';
import LibraryHub from '../components/LibraryHub';
import Skeleton from '../components/ui/Skeleton';
import ImportSheet from '../components/ImportSheet';
import VerdictPicker, { VerdictBadge } from '../components/VerdictPicker';
import { clearWatched, setVerdict as setLedgerVerdict, useLibrary, VERDICT_LABEL, type LibraryFilm, type Verdict } from '../lib/library';
import { recordTasteEvent } from '../lib/taste';

type WeekGroup = { weekLabel: string; weekStart: Date; movies: CalendarEvent[] };
type MonthGroup = { monthLabel: string; monthKey: string; weeks: WeekGroup[] };
type Filter = 'all' | Verdict | 'unrated';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
  { id: 'okay', label: 'Okay' },
  { id: 'nope', label: 'Nope' },
  { id: 'unrated', label: 'Unrated' },
];

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const groupByTimeline = (events: CalendarEvent[]): MonthGroup[] => {
  const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const monthMap = new Map<string, { label: string; weekMap: Map<string, { weekStart: Date; movies: CalendarEvent[] }> }>();

  for (const event of sorted) {
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) continue;
    const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth()).padStart(2, '0')}`;
    const weekStart = getMonday(eventDate);
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { label: `${MONTHS_LONG[eventDate.getMonth()]} ${eventDate.getFullYear()}`, weekMap: new Map() });
    }
    const month = monthMap.get(monthKey)!;
    if (!month.weekMap.has(weekKey)) month.weekMap.set(weekKey, { weekStart, movies: [] });
    month.weekMap.get(weekKey)!.movies.push(event);
  }

  const result: MonthGroup[] = [];
  for (const [monthKey, { label, weekMap }] of monthMap) {
    const weeks = [...weekMap.entries()]
      .sort((a, b) => b[1].weekStart.getTime() - a[1].weekStart.getTime())
      .map(([, { weekStart, movies }]) => ({
        weekLabel: `Week of ${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`,
        weekStart,
        movies,
      }));
    result.push({ monthLabel: label, monthKey, weeks });
  }
  return result;
};

type Target = { film: LibraryFilm | null; event: CalendarEvent | null; movieId: number; title: string };

function matchesFilter(filter: Filter, verdict: Verdict | null): boolean {
  if (filter === 'all') return true;
  if (filter === 'unrated') return verdict == null;
  return verdict === filter;
}

export default function WatchedScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events, loading: eventsLoading, deleteEvent } = useCalendarLogs();
  const { films, byId, loading: filmsLoading } = useLibrary();
  const { addToWatchlist } = useWatchlist();

  const [filter, setFilter] = useState<Filter>('all');
  const [showImport, setShowImport] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);

  const verdictFor = (movieId: number, event?: CalendarEvent | null): Verdict | null =>
    byId.get(movieId)?.verdict ?? (event ? eventVerdict(event) : null);

  const watchedEvents = useMemo(
    () => events.filter((e) => e.status !== 'planned' && new Date(e.date).getTime() <= Date.now()),
    [events],
  );
  const filteredEvents = useMemo(
    () => watchedEvents.filter((e) => matchesFilter(filter, verdictFor(e.movieId, e))),
    [watchedEvents, filter, byId],
  );
  const timeline = useMemo(() => groupByTimeline(filteredEvents), [filteredEvents]);

  const datedIds = useMemo(() => new Set(watchedEvents.map((e) => e.movieId)), [watchedEvents]);
  const undated = useMemo(
    () =>
      films
        .filter((f) => f.watched && !datedIds.has(f.movieId) && matchesFilter(filter, f.verdict))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [films, datedIds, filter],
  );

  const watchedFilms = useMemo(() => films.filter((f) => f.watched), [films]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, liked: 0, okay: 0, nope: 0, unrated: 0 };
    const seen = new Set<number>();
    for (const f of watchedFilms) {
      seen.add(f.movieId);
      c.all++;
      if (f.verdict) c[f.verdict]++;
      else c.unrated++;
    }
    for (const e of watchedEvents) {
      if (seen.has(e.movieId)) continue;
      seen.add(e.movieId);
      c.all++;
      const v = eventVerdict(e);
      if (v) c[v]++;
      else c.unrated++;
    }
    return c;
  }, [watchedFilms, watchedEvents]);

  const open = (movieId: number, mediaType?: string) => navigate(`/movie/${movieId}?type=${mediaType || 'movie'}`);

  const changeVerdict = async (verdict: Verdict) => {
    if (!user || !target) return;
    setBusy(true);
    try {
      const film = target.film ?? byId.get(target.movieId) ?? null;
      const event = target.event;
      await setLedgerVerdict(
        user.uid,
        {
          movieId: target.movieId,
          title: target.title,
          year: film?.year ?? event?.year,
          poster: film?.poster ?? event?.poster,
          backdrop: film?.backdrop ?? event?.backdrop,
          mediaType: film?.mediaType ?? event?.mediaType,
        },
        verdict,
        'manual',
        film?.stars ?? null,
      );
      await recordTasteEvent(
        user.uid,
        { type: 'verdict', movieId: target.movieId, title: target.title, year: film?.year ?? event?.year, verdict, source: 'watched' },
        { email: user.email },
      );
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const removeNight = async () => {
    if (!target?.event) return;
    setBusy(true);
    try {
      await deleteEvent(target.event.id);
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const removeFromWatched = async (moveToWatchlist: boolean) => {
    if (!user || !target) return;
    setBusy(true);
    try {
      const film = target.film ?? byId.get(target.movieId) ?? null;
      const event = target.event;
      for (const e of events.filter((e) => e.movieId === target.movieId && e.status !== 'planned')) {
        await deleteEvent(e.id);
      }
      await clearWatched(user.uid, target.movieId);
      await recordTasteEvent(user.uid, { type: 'watched_remove', movieId: target.movieId, title: target.title }, { email: user.email });
      if (moveToWatchlist) {
        await addToWatchlist({
          movieId: target.movieId,
          title: target.title,
          year: film?.year ?? event?.year ?? '',
          poster: film?.poster ?? event?.poster ?? '',
          backdrop: film?.backdrop ?? event?.backdrop,
        });
      }
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const Poster = ({ movieId, title, poster, year, mediaType, event }: { movieId: number; title: string; poster: string; year?: string | number; mediaType?: string; event?: CalendarEvent | null }) => {
    const film = byId.get(movieId) ?? null;
    const verdict = verdictFor(movieId, event);
    const count = film?.watchCount ?? 0;
    return (
      <div className="relative overflow-hidden bg-gray-900 group" data-testid="watched-poster">
        <button type="button" onClick={() => open(movieId, mediaType)} className="block w-full text-left" aria-label={title}>
          <img src={poster} alt={title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
        </button>
        {verdict && (
          <div className="absolute top-1 right-1 pointer-events-none">
            <VerdictBadge verdict={verdict} size={20} />
          </div>
        )}
        {count > 1 && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 text-[10px] font-bold text-fg pointer-events-none" data-testid="watch-count-pill">
            x{count}
          </span>
        )}
        <button
          type="button"
          aria-label={`Edit ${title}`}
          data-testid="watched-edit"
          onClick={() => setTarget({ film, event: event ?? null, movieId, title })}
          className="absolute bottom-0 left-0 right-0 min-h-8 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-between px-1.5 pb-1"
        >
          <span className="text-[10px] font-bold text-white leading-tight truncate">{title}</span>
          <MoreHorizontal size={14} className="text-white shrink-0" />
        </button>
        {year ? <span className="sr-only">{year}</span> : null}
      </div>
    );
  };

  const loading = eventsLoading || filmsLoading;
  const empty = filteredEvents.length === 0 && undated.length === 0;

  return (
    <div className="min-h-screen bg-base font-display text-fg flex flex-col max-w-md mx-auto overflow-hidden border-x border-line">
      <LibraryHub />
      <div id="timeline" className="bg-base px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-line">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app')} className="p-2 min-h-11 min-w-11 text-fg-2 hover:text-fg" aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Watched</h1>
            <p className="text-xs text-gray-500" data-testid="watched-count">
              {counts.all} films · {watchedEvents.length} nights
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowImport(true)}
          data-testid="watched-import"
          className="flex items-center gap-2 px-3 min-h-11 bg-base-3 text-fg border border-line text-sm font-medium"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Import</span>
        </button>
      </div>

      <div className="px-4 py-3 flex gap-2 border-b border-line overflow-x-auto no-scrollbar" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            data-testid={`watched-filter-${f.id}`}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 min-h-11 text-xs font-medium border flex items-center gap-1.5 ${
              filter === f.id ? 'bg-fg text-base border-fg' : 'bg-base-2 text-fg-3 border-line'
            }`}
          >
            {f.id !== 'all' && f.id !== 'unrated' && <VerdictBadge verdict={f.id} size={14} />}
            {f.label} {counts[f.id]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Skeleton className="w-24 h-8" />
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-4">
              <Film className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              {filter === 'all' ? 'No watched movies yet' : `Nothing marked ${filter === 'unrated' ? 'unrated' : VERDICT_LABEL[filter]}`}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">Log films from the calendar or drop your Letterboxd export.</p>
          </div>
        ) : (
          <div className="pb-8">
            {timeline.map((monthGroup) => (
              <div key={monthGroup.monthKey}>
                <div className="sticky top-0 z-[5] bg-base/95 backdrop-blur-sm px-4 py-3 border-b border-line">
                  <h2 className="text-lg font-bold text-white">{monthGroup.monthLabel}</h2>
                </div>
                {monthGroup.weeks.map((weekGroup) => (
                  <div key={weekGroup.weekStart.toISOString()} className="px-4 pt-3 pb-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={13} className="text-gray-500" />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{weekGroup.weekLabel}</span>
                      <span className="text-[10px] text-gray-600">({weekGroup.movies.length})</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {weekGroup.movies.map((movie) => (
                        <Poster
                          key={movie.id}
                          movieId={movie.movieId}
                          title={movie.title}
                          poster={movie.poster}
                          year={movie.year}
                          mediaType={movie.mediaType}
                          event={movie}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {undated.length > 0 && (
              <div data-testid="watched-undated">
                <div className="sticky top-0 z-[5] bg-base/95 backdrop-blur-sm px-4 py-3 border-b border-line">
                  <h2 className="text-lg font-bold text-white">Also watched</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">No date on record</p>
                </div>
                <div className="px-4 pt-3 grid grid-cols-4 gap-2">
                  {undated.map((f) => (
                    <Poster key={f.movieId} movieId={f.movieId} title={f.title} poster={f.poster} year={f.year} mediaType={f.mediaType} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ImportSheet open={showImport} onClose={() => setShowImport(false)} title="Import watched films" />

      {target && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4" data-testid="watched-editor">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setTarget(null)} />
          <div className="relative z-10 w-full max-w-sm bg-base border border-line p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-fg">{target.title}</h3>
                <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">
                  {target.event ? new Date(target.event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                  {(target.film?.watchCount ?? 0) > 1 ? ` · x${target.film?.watchCount}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setTarget(null)} aria-label="Close" className="p-2 min-h-11 min-w-11 text-fg-3">
                <X size={18} />
              </button>
            </div>
            <VerdictPicker value={verdictFor(target.movieId, target.event)} onChange={changeVerdict} disabled={busy} size="sm" />
            <div className="grid grid-cols-1 gap-2">
              {target.event && (
                <button
                  type="button"
                  onClick={removeNight}
                  disabled={busy}
                  data-testid="watched-remove-night"
                  className="min-h-11 px-3 border border-line text-fg text-sm flex items-center gap-2 disabled:opacity-40"
                >
                  <CalendarX size={14} /> Remove this night
                </button>
              )}
              <button
                type="button"
                onClick={() => removeFromWatched(true)}
                disabled={busy}
                data-testid="watched-move-watchlist"
                className="min-h-11 px-3 border border-line text-fg text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Bookmark size={14} /> Move to watchlist
              </button>
              <button
                type="button"
                onClick={() => removeFromWatched(false)}
                disabled={busy}
                data-testid="watched-remove"
                className="min-h-11 px-3 border border-red-900 text-red-400 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Trash2 size={14} /> Remove from watched
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
