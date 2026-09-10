import { describe, expect, it } from 'vitest';
import { eventDayKey, stripFill } from './stripDays';

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
