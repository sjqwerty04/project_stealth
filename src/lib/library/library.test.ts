import { describe, expect, it } from 'vitest';
import { foldLegacy } from './backfill';
import { emptyFilm, mergeFilm, parseFilm } from './ledger';
import { historyScore, starsOf, verdictFromImdb, verdictFromLegacy, verdictFromStars, verdictOf } from './verdict';

describe('verdictFromStars', () => {
  it('splits at 3.5 and 2 with a heart overriding', () => {
    expect(verdictFromStars(3.5)).toBe('liked');
    expect(verdictFromStars(5)).toBe('liked');
    expect(verdictFromStars(3)).toBe('okay');
    expect(verdictFromStars(2.5)).toBe('okay');
    expect(verdictFromStars(2)).toBe('nope');
    expect(verdictFromStars(0.5)).toBe('nope');
    expect(verdictFromStars(1, true)).toBe('liked');
    expect(verdictFromStars(null, true)).toBe('liked');
    expect(verdictFromStars(null)).toBeNull();
    expect(verdictFromStars(undefined)).toBeNull();
  });
});

describe('verdictFromImdb', () => {
  it('splits at 7 and 4', () => {
    expect(verdictFromImdb(10)).toBe('liked');
    expect(verdictFromImdb(7)).toBe('liked');
    expect(verdictFromImdb(6)).toBe('okay');
    expect(verdictFromImdb(5)).toBe('okay');
    expect(verdictFromImdb(4)).toBe('nope');
    expect(verdictFromImdb(1)).toBe('nope');
    expect(verdictFromImdb(null)).toBeNull();
  });
});

describe('legacy readers', () => {
  it('reads thumbs as liked or nope', () => {
    expect(verdictFromLegacy('up')).toBe('liked');
    expect(verdictFromLegacy('down')).toBe('nope');
    expect(verdictFromLegacy(null)).toBeNull();
    expect(verdictOf({ rating: 'up' })).toBe('liked');
    expect(verdictOf({ verdict: 'okay', rating: 'up' })).toBe('okay');
    expect(verdictOf(null)).toBeNull();
  });

  it('halves imdb scores onto the star scale', () => {
    expect(starsOf({ imdbRating: 8 })).toBe(4);
    expect(starsOf({ letterboxdRating: 3.5 })).toBe(3.5);
    expect(starsOf({ stars: 2 })).toBe(2);
    expect(starsOf({})).toBeNull();
  });
});

describe('historyScore', () => {
  it('prefers stars and falls back to the verdict centre', () => {
    expect(historyScore('liked')).toBe(5);
    expect(historyScore('okay')).toBe(3);
    expect(historyScore('nope')).toBe(1);
    expect(historyScore(null)).toBeNull();
    expect(historyScore('liked', 3.5)).toBe(4);
    expect(historyScore('nope', 0.5)).toBe(1);
    expect(historyScore(null, 8)).toBe(4);
  });
});

describe('mergeFilm', () => {
  it('widens dates, maxes counts, unions lists, and clears the watchlist once watched', () => {
    const base = mergeFilm(emptyFilm(1, 'Heat'), { onWatchlist: true, tags: ['crime'] }, 10);
    expect(base.onWatchlist).toBe(true);
    const watched = mergeFilm(
      base,
      { watched: true, watchCount: 2, firstWatchedAt: '2024-05-01', lastWatchedAt: '2024-05-01', tags: ['crime', 'night'], stars: 4.5 },
      20,
    );
    expect(watched).toMatchObject({
      watched: true,
      watchCount: 2,
      firstWatchedAt: '2024-05-01',
      lastWatchedAt: '2024-05-01',
      onWatchlist: false,
      tags: ['crime', 'night'],
      stars: 4.5,
      updatedAt: 20,
    });
    const later = mergeFilm(watched, { watchCount: 1, firstWatchedAt: '2023-01-01', lastWatchedAt: '2025-01-01' }, 30);
    expect(later.watchCount).toBe(2);
    expect(later.firstWatchedAt).toBe('2023-01-01');
    expect(later.lastWatchedAt).toBe('2025-01-01');
  });

  it('counts a watched film at least once', () => {
    expect(mergeFilm(emptyFilm(1, 'Heat'), { watched: true }).watchCount).toBe(1);
  });
});

describe('parseFilm', () => {
  it('round-trips a ledger doc and drops junk', () => {
    const film = mergeFilm(emptyFilm(949, 'Heat'), { watched: true, verdict: 'liked', stars: 4.5, hearted: true }, 5);
    expect(parseFilm(film)).toEqual(film);
    expect(parseFilm({ movieId: 1 })).toBeNull();
    expect(parseFilm({ title: 'x' }, 7)?.movieId).toBe(7);
    expect(parseFilm({ movieId: 1, title: 'x', verdict: 'up' })?.verdict).toBeNull();
  });
});

describe('foldLegacy', () => {
  const now = Date.parse('2025-06-01T12:00:00Z');
  const input = {
    calendarLogs: [
      { movieId: 949, title: 'Heat', date: '2024-05-01T12:00:00', rating: 'up', status: 'watched', poster: 'p' },
      { movieId: 949, title: 'Heat', date: '2025-01-02T12:00:00', rating: 'up', status: 'watched' },
      { movieId: 12, title: 'Future', date: '2030-01-01T12:00:00', status: 'planned' },
      { movieId: 13, title: 'Unrated', date: '2024-02-02T12:00:00', status: 'watched' },
    ],
    watched: [
      { movieId: 949, title: 'Heat', rating: 'down' },
      { movieId: 500, title: 'Drive', letterboxdRating: 3, source: 'letterboxd' },
    ],
    watchlist: [
      { movieId: 500, title: 'Drive' },
      { movieId: 77, title: 'Sicario', poster: 's' },
    ],
    now,
  };

  it('folds three collections into one film per id', () => {
    const films = foldLegacy(input);
    const byId = new Map(films.map((f) => [f.movieId, f]));
    expect(byId.get(949)).toMatchObject({
      watched: true,
      verdict: 'liked',
      watchCount: 2,
      firstWatchedAt: '2024-05-01',
      lastWatchedAt: '2025-01-02',
      poster: 'p',
    });
    expect(byId.get(949)?.sources).toEqual(['calendar', 'discovery']);
    expect(byId.has(12)).toBe(false);
    expect(byId.get(13)).toMatchObject({ watched: true, verdict: null, watchCount: 1 });
    expect(byId.get(500)).toMatchObject({ watched: true, verdict: 'okay', stars: 3, onWatchlist: false });
    expect(byId.get(77)).toMatchObject({ watched: false, onWatchlist: true, poster: 's' });
  });

  it('is idempotent when rerun over its own output', () => {
    const once = foldLegacy(input);
    const twice = foldLegacy({ ...input, existing: once });
    expect(twice).toEqual(once);
  });
});
