import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimits, checkRateLimit } from './rateLimit';

const OPTS = { limit: 3, windowMs: 1000 };

beforeEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows up to the limit and reports the remaining budget', () => {
    expect(checkRateLimit('a', OPTS)).toMatchObject({ allowed: true, remaining: 2 });
    expect(checkRateLimit('a', OPTS)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkRateLimit('a', OPTS)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks the request past the limit', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('b', OPTS);
    const result = checkRateLimit('b', OPTS);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps callers isolated from each other', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('user-1', OPTS);
    expect(checkRateLimit('user-1', OPTS).allowed).toBe(false);
    expect(checkRateLimit('user-2', OPTS).allowed).toBe(true);
  });

  it('refills once the window has elapsed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    for (let i = 0; i < 3; i++) checkRateLimit('c', OPTS);
    expect(checkRateLimit('c', OPTS).allowed).toBe(false);

    vi.setSystemTime(new Date('2026-01-01T00:00:01.001Z'));
    expect(checkRateLimit('c', OPTS)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it('stays blocked for the remainder of the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    for (let i = 0; i < 3; i++) checkRateLimit('d', OPTS);
    vi.setSystemTime(new Date('2026-01-01T00:00:00.900Z'));
    expect(checkRateLimit('d', OPTS).allowed).toBe(false);
  });
});
