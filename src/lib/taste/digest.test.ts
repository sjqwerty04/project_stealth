import { describe, expect, it } from 'vitest';
import { emptyFilm, mergeFilm } from '../library/ledger';
import type { LibraryFilm } from '../library/types';
import { applyTasteEvent } from './applyEvent';
import { buildRecommendContext, compactTaste, emptySnapshot, libraryLine, meaningfulTags, selectHistory } from './buildRecommendContext';
import { libraryStats, ratedFromLibrary } from './generateSnapshot';
import { HISTORY_LIMIT, type RatedFilm } from './types';

function day(i: number): string {
  const d = new Date(Date.UTC(2020, 0, 1) + i * 86400000);
  return d.toISOString().slice(0, 10);
}

/** 900 films: 30 canon, 60 rejects, the rest spread across okay and liked with a few rewatches. */
function bigLibrary(): LibraryFilm[] {
  const films: LibraryFilm[] = [];
  for (let i = 0; i < 900; i++) {
    const canon = i < 30;
    const reject = i >= 30 && i < 90;
    const stars = canon ? 5 : reject ? 1.5 : 2.5 + (i % 3) * 0.5;
    films.push(
      mergeFilm(
        emptyFilm(1000 + i, `Film ${i}`),
        {
          watched: true,
          stars,
          verdict: canon ? 'liked' : reject ? 'nope' : stars >= 3.5 ? 'liked' : 'okay',
          hearted: canon && i % 2 === 0,
          watchCount: i % 100 === 0 ? 3 : 1,
          firstWatchedAt: day(i),
          lastWatchedAt: day(i),
          tags: i % 7 === 0 ? ['plex', 'criterion'] : i % 11 === 0 ? ['horror'] : [],
          reviewExcerpt: canon && i < 3 ? `Review ${i} that runs on for a while and says something specific about the film.` : null,
        },
        i,
      ),
    );
  }
  return films;
}

describe('selectHistory', () => {
  it('caps at HISTORY_LIMIT and mixes canon, recent, and rejects', () => {
    const rated: RatedFilm[] = ratedFromLibrary(bigLibrary());
    const history = selectHistory(rated);
    expect(history.length).toBe(HISTORY_LIMIT);
    const titles = new Set(history.map((h) => h.item));
    expect(titles.size).toBe(HISTORY_LIMIT);
    const canonHits = history.filter((h) => h.rating === 5 && Number(h.id) < 1030).length;
    const rejectHits = history.filter((h) => h.rating === 1 || h.rating === 2).length;
    const recentHits = history.filter((h) => Number(h.id) >= 1880).length;
    expect(canonHits).toBeGreaterThanOrEqual(8);
    expect(rejectHits).toBeGreaterThanOrEqual(5);
    expect(recentHits).toBeGreaterThanOrEqual(15);
  });

  it('dedupes titles case-insensitively and keeps unrated as 3', () => {
    const history = selectHistory([
      { title: 'Heat', verdict: 'liked', at: 2 },
      { title: 'heat', verdict: 'nope', at: 1 },
      { title: 'Drive', verdict: null, at: 3 },
    ]);
    expect(history).toEqual([
      { item: 'Drive', rating: 3 },
      { item: 'Heat', rating: 5 },
    ]);
  });
});

describe('libraryStats and libraryLine', () => {
  const stats = libraryStats(bigLibrary())!;

  it('summarises the ledger', () => {
    expect(stats.watched).toBe(900);
    expect(stats.rated).toBe(900);
    expect(stats.avgStars).toBe(3);
    expect(stats.canon.length).toBe(8);
    expect(stats.canon.every((t) => t.startsWith('Film'))).toBe(true);
    expect(stats.rewatches).toEqual(['Film 0 x3', 'Film 100 x3', 'Film 200 x3', 'Film 300 x3', 'Film 400 x3']);
    expect(stats.recent[0]).toBe('Film 899');
    expect(stats.rejects.length).toBe(6);
    expect(stats.tags).toEqual(['criterion', 'horror']);
    expect(stats.quotes.length).toBe(2);
    expect(stats.quotes[0].length).toBeLessThanOrEqual(140);
  });

  it('renders the exact library line', () => {
    const line = libraryLine({
      watched: 842,
      rated: 610,
      avgStars: 3.4,
      canon: ['Heat', 'Zodiac', 'The Social Network'],
      rewatches: ['Heat x3'],
      recent: ['Conclave', 'Warfare'],
      rejects: ['Tron (1982)'],
      tags: ['cinema', 'criterion'],
      quotes: ['Night drives and moral math.'],
    });
    expect(line).toBe(
      'Library: 842 watched, 610 rated, avg 3.4. Canon: Heat, Zodiac, The Social Network. Rewatches: Heat x3. Recent: Conclave, Warfare. Avoid: Tron (1982). Often tags cinema / criterion. In their words: "Night drives and moral math."',
    );
    expect(libraryLine(null)).toBe('');
  });

  it('feeds canon, rejects, tags, and curiosity into preferences and compact text', () => {
    const context = buildRecommendContext({
      identity: { personaLine: 'Slow burns.', axis: 'story' },
      favorites: [],
      disliked: [],
      rated: [],
      watchlist: [],
      skipped: [],
      searches: [],
      patterns: [],
      curious: [{ title: 'Sicario' }],
      library: stats,
    });
    expect(context.preferences).toContain(stats.canon[0]);
    expect(context.preferences).toContain(`dislikes: ${stats.rejects[0]}`);
    expect(context.preferences).toContain('often tags criterion');
    expect(context.preferences).toContain('curious about Sicario');
    const compact = compactTaste(context, { personaLine: 'Slow burns.', axis: 'story' }, stats);
    expect(compact).toContain('Library: 900 watched');
    expect(compact.startsWith('Slow burns.')).toBe(true);
  });

  it('drops platform tags', () => {
    expect(meaningfulTags(['plex', 'Plex', 'netflix', 'criterion', 'horror', 'horror'])).toEqual(['horror', 'criterion']);
  });
});

describe('import digest seeding', () => {
  it('seeds history and preferences immediately from the digest', () => {
    const snap = applyTasteEvent(
      emptySnapshot(),
      {
        type: 'import',
        source: 'letterboxd',
        count: 3,
        digest: {
          canon: [{ movieId: 949, title: 'Heat' }],
          rejects: [{ movieId: 97, title: 'Tron' }],
          recent: [{ movieId: 974576, title: 'Conclave' }],
          avgStars: 3.4,
          counts: { watched: 3, rated: 3, diary: 3, watchlist: 0 },
        },
      },
      'e1',
    );
    expect(snap.context.history).toEqual([
      { item: 'Heat', rating: 5, id: '949' },
      { item: 'Tron', rating: 1, id: '97' },
      { item: 'Conclave', rating: 3, id: '974576' },
    ]);
    expect(snap.context.preferences).toContain('Heat');
    expect(snap.context.preferences).toContain('dislikes: Tron');
    expect(snap.generated.compactForChat).toContain('Heat (5/5)');
  });

  it('verdict replaces an earlier opinion and watched_remove forgets it', () => {
    let snap = applyTasteEvent(emptySnapshot(), { type: 'verdict', movieId: 949, title: 'Heat', verdict: 'liked', source: 'detail' }, 'e1');
    expect(snap.context.preferences).toEqual(['Heat']);
    snap = applyTasteEvent(snap, { type: 'verdict', movieId: 949, title: 'Heat', verdict: 'nope', stars: 1.5, source: 'watched' }, 'e2');
    expect(snap.context.preferences).toEqual(['dislikes: Heat']);
    expect(snap.context.history[0]).toEqual({ item: 'Heat', rating: 2, id: '949' });
    snap = applyTasteEvent(snap, { type: 'watched_remove', movieId: 949, title: 'Heat' }, 'e3');
    expect(snap.context.history).toEqual([]);
    expect(snap.context.preferences).toEqual([]);
  });
});
