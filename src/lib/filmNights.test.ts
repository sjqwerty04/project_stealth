import { describe, expect, it } from 'vitest';
import { eventsWithWatchDates } from './filmNights';
import { emptyFilm, mergeFilm } from './library/ledger';
import type { CalendarEvent } from '../hooks/useCalendarLogs';

function event(movieId: number, date: string): CalendarEvent {
  return {
    id: `log-${movieId}-${date}`,
    movieId,
    title: 'Heat',
    poster: 'p',
    date,
    inviteFriend: false,
    status: 'watched',
  };
}

describe('eventsWithWatchDates', () => {
  it('adds a strip day for a film date that has no calendar log', () => {
    const film = mergeFilm(emptyFilm(949, 'Heat'), {
      watched: true,
      firstWatchedAt: '2024-04-30',
      lastWatchedAt: '2025-01-02',
      watchDates: ['2024-04-30', '2025-01-02'],
      poster: 'heat.jpg',
      sources: ['letterboxd'],
    });
    const merged = eventsWithWatchDates([], [film]);
    expect(merged.map((e) => e.date.slice(0, 10))).toEqual(['2024-04-30', '2025-01-02']);
    expect(merged.every((e) => e.status === 'watched' && e.movieId === 949)).toBe(true);
  });

  it('does not duplicate a day that calendar_logs already has', () => {
    const film = mergeFilm(emptyFilm(949, 'Heat'), {
      watched: true,
      watchDates: ['2024-04-30'],
      firstWatchedAt: '2024-04-30',
      lastWatchedAt: '2024-04-30',
    });
    const merged = eventsWithWatchDates([event(949, '2024-04-30T12:00:00')], [film]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('log-949-2024-04-30T12:00:00');
  });

  it('uses first and last when an older import stored no watchDates list', () => {
    const film = mergeFilm(emptyFilm(1, 'Old'), { watched: true, firstWatchedAt: '2023-02-01', lastWatchedAt: '2023-02-01' });
    expect(eventsWithWatchDates([], [film]).map((e) => e.date.slice(0, 10))).toEqual(['2023-02-01']);
  });
});
