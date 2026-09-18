import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { recordTasteEvent } from '../lib/taste';
import { recordWatch, removeWatchNight, setVerdict, verdictOf, type Verdict } from '../lib/library';

type EventStatus = 'planned' | 'watched' | null;

export type CalendarEvent = {
  id: string;
  movieId: number;
  title: string;
  poster: string;
  date: string;
  inviteFriend: boolean;
  verdict?: Verdict | null;
  stars?: number | null;
  /** Legacy thumbs. Read through verdictOf, never written. */
  rating?: 'up' | 'down' | null;
  status?: EventStatus;
  backdrop?: string;
  mediaType?: 'movie' | 'tv';
  year?: number | string;
  runtimeLabel?: string;
  accentStart?: string;
  accentEnd?: string;
  accentText?: string;
  source?: string;
  rewatch?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export function eventVerdict(event: { verdict?: unknown; rating?: unknown } | null | undefined): Verdict | null {
  return verdictOf(event);
}

export function useCalendarLogs() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const logsRef = collection(db, 'users', user.uid, 'calendar_logs');
    const logsQuery = query(logsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logs: CalendarEvent[] = snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, verdict: verdictOf(data) } as CalendarEvent;
        });
        setEvents(logs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching calendar logs:', err);
        setError('Failed to load your movie logs');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const addEvent = useCallback(
    async (eventData: CalendarEventInput): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      const { rating: _legacy, ...clean } = eventData;
      void _legacy;
      const logsRef = collection(db, 'users', user.uid, 'calendar_logs');
      const docRef = await addDoc(logsRef, {
        ...clean,
        verdict: clean.verdict ?? null,
        stars: clean.stars ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (clean.status !== 'planned') {
        await recordWatch(user.uid, {
          movieId: clean.movieId,
          title: clean.title,
          year: clean.year,
          poster: clean.poster,
          backdrop: clean.backdrop,
          mediaType: clean.mediaType,
          date: clean.date,
          ...(clean.verdict !== undefined ? { verdict: clean.verdict } : {}),
          ...(clean.stars !== undefined ? { stars: clean.stars } : {}),
          source: (clean.source as 'calendar') || 'calendar',
        }).catch((err) => console.warn('ledger recordWatch failed:', err));
      }

      if (user.email) {
        await recordTasteEvent(
          user.uid,
          {
            type: 'calendar_log',
            movieId: clean.movieId,
            title: clean.title,
            year: clean.year,
            date: clean.date,
            verdict: clean.verdict ?? null,
            stars: clean.stars ?? null,
          },
          { email: user.email }
        );
      }

      return docRef.id;
    },
    [user]
  );

  const updateEvent = useCallback(
    async (eventId: string, eventData: Partial<CalendarEventInput>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const { rating: _legacy, ...clean } = eventData;
      void _legacy;
      const eventRef = doc(db, 'users', user.uid, 'calendar_logs', eventId);
      await updateDoc(eventRef, {
        ...clean,
        updatedAt: serverTimestamp(),
      });

      const event = events.find((e) => e.id === eventId);
      if (event && clean.verdict) {
        await setVerdict(
          user.uid,
          { movieId: event.movieId, title: event.title, year: event.year, poster: event.poster, backdrop: event.backdrop, mediaType: event.mediaType },
          clean.verdict,
          'calendar',
          clean.stars ?? null,
        ).catch((err) => console.warn('ledger setVerdict failed:', err));
        if (user.email) {
          await recordTasteEvent(
            user.uid,
            {
              type: 'verdict',
              movieId: event.movieId,
              title: event.title,
              year: event.year,
              verdict: clean.verdict,
              stars: clean.stars ?? null,
              source: 'calendar',
            },
            { email: user.email }
          );
        }
      }
    },
    [user, events]
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const event = events.find((e) => e.id === eventId);
      const eventRef = doc(db, 'users', user.uid, 'calendar_logs', eventId);
      await deleteDoc(eventRef);
      if (event) {
        const remaining = events
          .filter((e) => e.id !== eventId && e.movieId === event.movieId && e.status !== 'planned')
          .map((e) => e.date);
        await removeWatchNight(user.uid, event.movieId, remaining).catch((err) =>
          console.warn('ledger removeWatchNight failed:', err),
        );
      }
    },
    [user, events]
  );

  const getEventsForDate = useCallback(
    (date: Date | null): CalendarEvent[] => {
      if (!date) return [];
      return events.filter((event) => {
        const eventDate = new Date(event.date);
        return (
          eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      });
    },
    [events]
  );

  // Planned events that are now in the past and still need a verdict
  const getPendingReviewEvents = useCallback((): CalendarEvent[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter((event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate <= today && event.status === 'planned' && !eventVerdict(event);
    });
  }, [events]);

  const deleteEventsBySource = useCallback(
    async (source: string): Promise<number> => {
      if (!user) throw new Error('Not authenticated');

      const eventsToDelete = events.filter((event) => event.source === source);
      let deleted = 0;

      for (const event of eventsToDelete) {
        try {
          const eventRef = doc(db, 'users', user.uid, 'calendar_logs', event.id);
          await deleteDoc(eventRef);
          deleted++;
        } catch (err) {
          console.error(`Failed to delete event ${event.id}:`, err);
        }
      }

      return deleted;
    },
    [user, events]
  );

  const deleteEventsByDateAndSource = useCallback(
    async (date: string, source: string): Promise<number> => {
      if (!user) throw new Error('Not authenticated');

      const eventsToDelete = events.filter((event) => event.date === date && event.source === source);
      let deleted = 0;

      for (const event of eventsToDelete) {
        try {
          const eventRef = doc(db, 'users', user.uid, 'calendar_logs', event.id);
          await deleteDoc(eventRef);
          deleted++;
        } catch (err) {
          console.error(`Failed to delete event ${event.id}:`, err);
        }
      }

      return deleted;
    },
    [user, events]
  );

  return {
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    getPendingReviewEvents,
    deleteEventsBySource,
    deleteEventsByDateAndSource,
  };
}
