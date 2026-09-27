import { format, isValid, parseISO, startOfDay } from 'date-fns';

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

export function parseAppDateParam(value: string | null | undefined, now = new Date()): Date | null {
  if (!value || !DATE_PARAM.test(value)) return null;
  const parsed = parseISO(`${value}T12:00:00`);
  if (!isValid(parsed)) return null;
  const day = startOfDay(parsed);
  const floor = startOfDay(now);
  floor.setFullYear(floor.getFullYear() - 6);
  const ceiling = startOfDay(now);
  ceiling.setFullYear(ceiling.getFullYear() + 2);
  if (day < floor || day > ceiling) return null;
  return day;
}

export function dayStageKey(date: Date, movieId: number): string {
  return `${format(date, 'yyyy-MM-dd')}:${movieId}`;
}

/** Firestore timestamps, epoch millis, or ISO strings. Missing stamps sort last. */
export function nightStamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    const stamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof stamp.toDate === 'function') {
      const time = stamp.toDate().getTime();
      return Number.isNaN(time) ? 0 : time;
    }
    const seconds = stamp.seconds ?? stamp._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds * 1000;
  }
  return 0;
}

/** Newest log first, so the film just added to a day is the one on the stage. */
export function nightOrder<T extends { id: string; createdAt?: unknown }>(logs: T[]): T[] {
  return [...logs].sort((a, b) => {
    const delta = nightStamp(b.createdAt) - nightStamp(a.createdAt);
    if (delta !== 0) return delta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Move one film along a day. Stays put at either end. */
export function dayBillStep(index: number, direction: number, count: number): number {
  if (count <= 1) return 0;
  const next = index + Math.sign(direction);
  return Math.min(count - 1, Math.max(0, next));
}

export function showSelectsSkeleton(status: string, slideCount: number): boolean {
  return status === 'loading' && slideCount === 0;
}

export function isSelectsDismissTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-testid="strip-dock"]')) return false;
  if (target.closest('[data-testid="ticket-slot"]')) return false;
  if (target.closest('[data-carousel-control]')) return false;
  if (target.closest('header')) return false;
  return Boolean(
    target.closest('[data-testid="selects-dismiss"]') ||
      (target.closest('[data-testid="selects-scroll"]') && !target.closest('button')),
  );
}
