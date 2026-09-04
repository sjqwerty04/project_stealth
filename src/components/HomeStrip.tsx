import { useMemo, useRef, useState } from 'react';
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns';
import type { CalendarEvent } from '../hooks/useCalendarLogs';
import { Mark } from './ui';
import PosterPlate from './ui/PosterPlate';

export type StripMovie = {
  id: number;
  title: string;
  poster: string;
  mediaType?: 'movie' | 'tv';
  accentStart?: string;
};

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export default function HomeStrip({
  events,
  featured,
  insightsLabel,
  onYearZoom,
  onOpenMovie,
  onPickEmptyRec,
}: {
  events: CalendarEvent[];
  featured: StripMovie[];
  insightsLabel?: string | null;
  onYearZoom: () => void;
  onOpenMovie: (id: number, mediaType?: string) => void;
  onPickEmptyRec: (movie: StripMovie, date: Date) => void;
}) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const startX = useRef<number | null>(null);

  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(subDays(anchor, 13), i));
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.date));
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    return map;
  }, [events]);

  const selectedEvents = byDay.get(dayKey(selected)) ?? [];
  const empty = selectedEvents.length === 0;

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 40) return;
    setAnchor((d) => (dx < 0 ? addDays(d, 7) : subDays(d, 7)));
  };

  return (
    <div className="min-h-screen bg-base text-fg" data-testid="home-strip">
      <header className="px-7 pt-6 pb-4 flex items-start justify-between">
        <Mark variant="lockup" size={36} />
        <button
          type="button"
          data-testid="year-zoom"
          onClick={onYearZoom}
          className="min-h-11 min-w-11 px-3 font-spec text-[10px] uppercase tracking-widest text-fg-2 border border-line"
        >
          Year
        </button>
      </header>

      {insightsLabel && (
        <p className="px-7 font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-4" data-testid="insights-label">
          {insightsLabel}
        </p>
      )}

      <div
        className="px-7 overflow-x-auto no-scrollbar"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        data-testid="strip-track"
      >
        <div className="flex gap-2 pb-2" style={{ minWidth: 328 }}>
          {days.map((d) => {
            const logs = byDay.get(dayKey(d)) ?? [];
            const film = logs[0];
            const active = isSameDay(d, selected);
            const color = film?.accentStart || (logs.length ? 'var(--film)' : 'var(--line)');
            return (
              <button
                key={dayKey(d)}
                data-testid={`strip-day-${format(d, 'd')}`}
                aria-label={format(d, 'EEEE MMM d')}
                aria-pressed={active}
                onClick={() => {
                  setSelected(d);
                  if (film) onOpenMovie(film.movieId, film.mediaType);
                }}
                className="flex flex-col items-center gap-2 min-w-11 min-h-11"
              >
                <span
                  className="block"
                  style={{
                    width: 16,
                    height: 44,
                    transform: 'skewX(-13.5deg)',
                    background: color,
                    outline: active ? '1px solid var(--fg)' : 'none',
                    outlineOffset: 2,
                  }}
                />
                <span className="font-spec text-[10px] text-fg-3">{format(d, 'd')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-7 mt-4 font-spec text-[10px] uppercase tracking-widest text-fg-3">
        {format(selected, 'EEEE d')}
        {'  ·  '}
        {events.filter((e) => new Date(e.date).getFullYear() === selected.getFullYear()).length} this year
      </p>

      {empty ? (
        <div className="px-7 mt-6" data-testid="empty-day-recs">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">Nothing logged · picks</p>
          <div className="grid grid-cols-3 gap-2">
            {featured.slice(0, 6).map((m) => (
              <PosterPlate
                key={m.id}
                src={m.poster}
                title={m.title}
                onClick={() => onPickEmptyRec(m, selected)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="px-7 mt-6 grid grid-cols-3 gap-2" data-testid="logged-day">
          {selectedEvents.map((e) => (
            <PosterPlate
              key={e.id}
              src={e.poster}
              title={e.title}
              onClick={() => onOpenMovie(e.movieId, e.mediaType)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
