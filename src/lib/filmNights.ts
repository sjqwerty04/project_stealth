import type { CalendarEvent } from '../hooks/useCalendarLogs';
import { watchDaysOf } from './library/ledger';
import type { LibraryFilm } from './library/types';
import { eventDayKey } from './stripDays';

/**
 * Calendar rows win. Film watch days fill any day the import saved on the ledger
 * but never wrote into calendar_logs, so the strip, year view, and watched list agree.
 */
export function eventsWithWatchDates(events: CalendarEvent[], films: LibraryFilm[]): CalendarEvent[] {
  const covered = new Set(events.map((event) => `${event.movieId}|${eventDayKey(event.date)}`));
  const extra: CalendarEvent[] = [];
  for (const film of films) {
    if (!film.watched) continue;
    for (const day of watchDaysOf(film)) {
      const key = `${film.movieId}|${day}`;
      if (covered.has(key)) continue;
      covered.add(key);
      extra.push({
        id: `film-${film.movieId}-${day}`,
        movieId: film.movieId,
        title: film.title,
        poster: film.poster,
        date: `${day}T12:00:00`,
        inviteFriend: false,
        status: 'watched',
        verdict: film.verdict,
        stars: film.stars,
        backdrop: film.backdrop,
        mediaType: film.mediaType,
        year: film.year,
        source: film.sources.find((s) => s === 'letterboxd' || s === 'imdb') ?? film.sources[0],
      });
    }
  }
  return extra.length ? [...events, ...extra] : events;
}

export function isFilmNight(id: string): boolean {
  return id.startsWith('film-');
}
