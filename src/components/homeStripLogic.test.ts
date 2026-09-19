import { describe, expect, it } from 'vitest';
import { addDays, format, startOfDay } from 'date-fns';
import { dayStageKey, parseAppDateParam } from './homeStripLogic';

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

describe('day stage key', () => {
  it('changes when the date changes even if the movie stays', () => {
    const day = startOfDay(new Date('2026-09-19T12:00:00'));
    expect(dayStageKey(day, 155)).toBe('2026-09-19:155');
    expect(dayStageKey(addDays(day, 1), 155)).toBe('2026-09-20:155');
  });
});
