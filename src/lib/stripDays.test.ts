import { describe, expect, it } from 'vitest';
import {
  discoverSearchPath,
  eventDayKey,
  localDateKey,
  occupyDay,
  parseLocalDateKey,
  stripFill,
} from './stripDays';

describe('eventDayKey', () => {
  it('keeps the ISO calendar day', () => {
    expect(eventDayKey('2026-08-30T05:00:00.000Z')).toBe('2026-08-30');
  });

  it('reads Firestore timestamps', () => {
    expect(eventDayKey({ seconds: Date.parse('2026-08-30T12:00:00Z') / 1000 })).toBe('2026-08-30');
  });

  it('returns empty for junk', () => {
    expect(eventDayKey(null)).toBe('');
    expect(eventDayKey({})).toBe('');
  });
});

describe('localDateKey', () => {
  it('keeps the local civil day at 10pm', () => {
    expect(localDateKey(new Date(2026, 8, 10, 22, 0, 0))).toBe('2026-09-10');
  });
});

describe('discoverSearchPath', () => {
  it('prints the discover query for that civil day', () => {
    expect(discoverSearchPath(localDateKey(new Date(2026, 8, 10, 22, 0, 0)))).toBe(
      '/discover?date=2026-09-10',
    );
  });
});

describe('parseLocalDateKey', () => {
  it('accepts a civil day and rejects junk', () => {
    expect(parseLocalDateKey('2026-09-10')).toBe('2026-09-10');
    expect(parseLocalDateKey('nope')).toBeNull();
  });
});

describe('occupyDay', () => {
  it('is empty when missing or empty, occupied when the map holds a list', () => {
    const date = new Date(2026, 8, 10);
    const key = localDateKey(date);
    const events = [{ id: 1 }];
    expect(occupyDay(date, new Map()).occupancy).toBe('empty');
    expect(occupyDay(date, new Map([[key, []]])).occupancy).toBe('empty');
    expect(occupyDay(date, new Map([[key, events]]))).toEqual({
      occupancy: 'occupied',
      key,
      date,
      events,
    });
  });
});

describe('stripFill', () => {
  it('uses the line token for empty days', () => {
    expect(stripFill('#1D5B8A', false)).toBe('var(--line)');
  });

  it('replaces near-black accents so logged days stay visible', () => {
    expect(stripFill('#0A0A0B', true)).toBe('var(--film)');
    expect(stripFill('#000', true)).toBe('var(--film)');
  });

  it('keeps a bright film accent', () => {
    expect(stripFill('#1D5B8A', true)).toBe('#1D5B8A');
  });
});
