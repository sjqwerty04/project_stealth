import { describe, expect, it } from 'vitest';
import { addDays, format, startOfDay } from 'date-fns';
import { dayBillStep, dayStageKey, nightOrder, parseAppDateParam, showSelectsSkeleton } from './homeStripLogic';

describe('home strip date param', () => {
  const now = startOfDay(new Date('2026-09-19T12:00:00'));

  it('parses a YYYY-MM-DD query into that local day', () => {
    const parsed = parseAppDateParam('2026-09-21', now);
    expect(parsed).not.toBeNull();
    expect(format(parsed as Date, 'yyyy-MM-dd')).toBe('2026-09-21');
  });

  it('rejects missing, malformed, and out-of-range dates', () => {
    expect(parseAppDateParam(null, now)).toBeNull();
    expect(parseAppDateParam('nope', now)).toBeNull();
    expect(parseAppDateParam('2026-13-40', now)).toBeNull();
    expect(parseAppDateParam('2010-01-01', now)).toBeNull();
  });
});

describe('selects loading chrome', () => {
  it('hides the page skeleton once any select is on screen', () => {
    expect(showSelectsSkeleton('loading', 3)).toBe(false);
    expect(showSelectsSkeleton('loading', 1)).toBe(false);
  });

  it('shows the page skeleton only for an empty loading strip', () => {
    expect(showSelectsSkeleton('loading', 0)).toBe(true);
    expect(showSelectsSkeleton('ready', 0)).toBe(false);
    expect(showSelectsSkeleton('ready', 3)).toBe(false);
  });
});

describe('night order', () => {
  it('puts the film just added in front of the other film that night', () => {
    const ordered = nightOrder([
      { id: 'older', createdAt: { seconds: 10 } },
      { id: 'newer', createdAt: { seconds: 20 } },
    ]);
    expect(ordered.map((film) => film.id)).toEqual(['newer', 'older']);
  });

  it('keeps a single film as the only slide', () => {
    expect(dayBillStep(0, 1, 1)).toBe(0);
    expect(dayBillStep(0, -1, 2)).toBe(0);
    expect(dayBillStep(0, 1, 2)).toBe(1);
    expect(dayBillStep(1, 1, 2)).toBe(1);
  });
});

describe('day stage key', () => {
  it('changes when the date changes even if the movie stays', () => {
    const day = startOfDay(new Date('2026-09-19T12:00:00'));
    expect(dayStageKey(day, 155)).toBe('2026-09-19:155');
    expect(dayStageKey(addDays(day, 1), 155)).toBe('2026-09-20:155');
  });
});
