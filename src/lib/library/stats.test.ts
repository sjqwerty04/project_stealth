import { describe, expect, it } from 'vitest';
import { emptyFilm } from './ledger';
import { distinctWatchedInYear, savedCount, walletCount, watchedCount, watchedFilmIds } from './stats';
import type { LibraryFilm } from './types';

function film(movieId: number, patch: Partial<LibraryFilm>): LibraryFilm {
  return { ...emptyFilm(movieId, `Film ${movieId}`), ...patch };
}

const LEDGER: LibraryFilm[] = [
  film(949, { watched: true, verdict: 'liked', firstWatchedAt: '2026-02-01', lastWatchedAt: '2026-02-01' }),
  film(10858, { watched: true, verdict: 'okay', firstWatchedAt: '2025-11-20', lastWatchedAt: '2026-01-04' }),
  film(5511, { watched: true, verdict: 'liked', firstWatchedAt: '2024-06-09', lastWatchedAt: '2024-06-09' }),
  film(1538, { watched: true, verdict: null, firstWatchedAt: null, lastWatchedAt: null }),
  film(64690, { watched: false, onWatchlist: true }),
  film(152601, { watched: false, onWatchlist: true }),
];

describe('library counts', () => {
  it('counts watched films, wallet films, and saved films from one ledger', () => {
    expect(watchedCount(LEDGER)).toBe(4);
    expect(walletCount(LEDGER)).toBe(2);
    expect(savedCount(LEDGER)).toBe(2);
  });

  it('counts a film in every year it was logged and ignores films with no date', () => {
    expect(distinctWatchedInYear(LEDGER, '2026')).toBe(2);
    expect(distinctWatchedInYear(LEDGER, '2025')).toBe(1);
    expect(distinctWatchedInYear(LEDGER, '2024')).toBe(1);
    expect(distinctWatchedInYear(LEDGER, '2023')).toBe(0);
  });

  it('reads zero from an empty ledger', () => {
    expect(watchedCount([])).toBe(0);
    expect(walletCount([])).toBe(0);
    expect(savedCount([])).toBe(0);
    expect(distinctWatchedInYear([], '2026')).toBe(0);
  });

  it('lists the ids of watched films so the archive can derive unseen', () => {
    expect([...watchedFilmIds(LEDGER)]).toEqual([949, 10858, 5511, 1538]);
  });
});
