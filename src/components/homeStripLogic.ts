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
