import { describe, expect, it } from 'vitest';
import { applyTasteEvent } from './applyEvent';
import {
  buildRecommendContext,
  compactTaste,
  emptySnapshot,
  hasMeaningfulContext,
  ratingToHistoryScore,
} from './buildRecommendContext';
import { selectConfidentPicks } from './buildRecommendContext';
import { parseSnapshot, selectsHydrateKey } from './getTaste';
import type { TasteEvent } from './types';

describe('ratingToHistoryScore', () => {
  it('maps thumbs to 5 and 1', () => {
    expect(ratingToHistoryScore('up')).toBe(5);
    expect(ratingToHistoryScore('down')).toBe(1);
  });

  it('omits unrated watches', () => {
    expect(ratingToHistoryScore(null)).toBeNull();
    expect(ratingToHistoryScore(undefined)).toBeNull();
  });

  it('scales letterboxd and imdb numbers onto 1-5', () => {
    expect(ratingToHistoryScore(4)).toBe(4);
    expect(ratingToHistoryScore(8)).toBe(4);
    expect(ratingToHistoryScore(0.5)).toBe(1);
  });
});

describe('buildRecommendContext', () => {
  it('fills the four TasteRay buckets from diary evidence', () => {
    const context = buildRecommendContext({
      identity: { personaLine: 'Slow burns and moral ambiguity. Every time.', axis: 'story' },
      favorites: [{ title: 'Heat', movieId: 949 }],
      disliked: [{ title: 'Transformers' }],
      rated: [
        { title: 'Heat', movieId: 949, rating: 'up', at: 200 },
        { title: 'Transformers', rating: 'down', at: 100 },
        { title: 'Unrated', rating: 'up' },
      ],
      watchlist: [{ title: 'Sicario' }],
      skipped: [{ title: 'A Fast One' }],
      searches: ['neon crime'],
      patterns: [],
    });

    expect(context.preferences).toContain('story-driven films');
    expect(context.preferences).toContain('Heat');
    expect(context.preferences).toContain('dislikes: Transformers');
    expect(context.preferences).toContain('dislikes: A Fast One');
    expect(context.preferences).toContain('something like Sicario');
    expect(context.preferences).toContain('something like neon crime');
    expect(context.profile).toBe('Slow burns and moral ambiguity. Every time.');
    expect(context.history[0]).toEqual({ item: 'Heat', rating: 5, id: '949' });
    expect(context.history.some((h) => h.item === 'Transformers' && h.rating === 1)).toBe(true);
    expect(hasMeaningfulContext(context)).toBe(true);
  });

  it('is meaningful from an onboarding axis alone', () => {
    const context = buildRecommendContext({
      identity: { personaLine: null, axis: 'visual' },
      favorites: [],
      disliked: [],
      rated: [],
      watchlist: [],
      skipped: [],
      searches: [],
      patterns: [],
    });
    expect(context.preferences).toContain('visually driven films');
    expect(hasMeaningfulContext(context)).toBe(true);
  });

  it('puts unrated watches in history as 3', () => {
    const context = buildRecommendContext({
      identity: { personaLine: null, axis: null },
      favorites: [],
      disliked: [],
      rated: [{ title: 'Heat', movieId: 949, rating: 3, at: 1 }],
      watchlist: [],
      skipped: [],
      searches: [],
      patterns: [],
    });
    expect(context.history[0]).toEqual({ item: 'Heat', rating: 3, id: '949' });
    expect(hasMeaningfulContext(context)).toBe(true);
  });

  it('is empty when the diary is empty', () => {
    expect(hasMeaningfulContext(buildRecommendContext({
      identity: { personaLine: null, axis: null },
      favorites: [],
      disliked: [],
      rated: [],
      watchlist: [],
      skipped: [],
      searches: [],
      patterns: [],
    }))).toBe(false);
  });
});

describe('applyTasteEvent', () => {
  it('keeps a growing history and points at the event', () => {
    const events: TasteEvent[] = [
      {
        type: 'onboarding',
        favoriteFilms: [{ title: 'Heat' }],
        dislikedFilms: [{ title: 'Transformers' }],
        axis: 'story',
        personaLine: 'Night drives and moral math.',
      },
      { type: 'rate', movieId: 500, title: 'Drive', rating: 'up', source: 'rec' },
      { type: 'skip', movieId: 12, title: 'A Fast One' },
      { type: 'search', query: 'neon crime', openedMovieId: 949, openedTitle: 'Heat' },
    ];

    let snap = emptySnapshot();
    events.forEach((event, i) => {
      snap = applyTasteEvent(snap, event, `e${i}`);
    });

    expect(snap.pointers.lastEventId).toBe('e3');
    expect(snap.identity.axis).toBe('story');
    expect(snap.identity.personaLine).toBe('Night drives and moral math.');
    expect(snap.context.history[0].item).toBe('Drive');
    expect(snap.context.preferences.some((p) => p.includes('A Fast One'))).toBe(true);
    expect(snap.generated.compactForChat).toContain('Night drives');
    expect(compactTaste(snap.context, snap.identity).length).toBeGreaterThan(10);
  });

  it('writes last picks without wiping identity', () => {
    const seeded = applyTasteEvent(
      emptySnapshot(),
      {
        type: 'onboarding',
        favoriteFilms: [{ title: 'Heat' }],
        dislikedFilms: [],
        axis: 'mood',
        personaLine: 'Mood first.',
      },
      'e0'
    );
    const next = applyTasteEvent(
      seeded,
      {
        type: 'last_picks',
        picks: [
          {
            movieId: 1,
            title: 'Sicario',
            year: 2015,
            poster: 'x',
            whyMatch: 'Night-drive tension.',
            confidence: 0.9,
          },
        ],
      },
      'e1'
    );
    expect(next.identity.personaLine).toBe('Mood first.');
    expect(next.generated.lastPicks[0].title).toBe('Sicario');
  });
});

describe('parseSnapshot lastPicks', () => {
  it('keeps lastPicks when movieId is a numeric string', () => {
    const snap = parseSnapshot({
      generated: {
        lastPicks: [{ movieId: '157336', title: 'Interstellar', year: '2014', poster: 'x', whyMatch: 'y', confidence: 0.9 }],
        lastPicksAt: 1,
      },
    });
    expect(snap.generated.lastPicks).toEqual([
      {
        movieId: 157336,
        title: 'Interstellar',
        year: '2014',
        poster: 'x',
        whyMatch: 'y',
        confidence: 0.9,
      },
    ]);
  });
});

describe('selectsHydrateKey', () => {
  it('changes when diary history arrives on an otherwise empty snapshot', () => {
    const empty = emptySnapshot();
    const withHistory = {
      ...empty,
      context: {
        ...empty.context,
        history: [{ item: 'Heat', rating: 5, id: '949' }],
      },
    };
    expect(selectsHydrateKey(withHistory)).not.toBe(selectsHydrateKey(empty));
  });
});

describe('selectConfidentPicks', () => {
  it('drops matches under 0.5', () => {
    const kept = selectConfidentPicks([
      { title: 'A', confidence: 0.9 },
      { title: 'B', confidence: 0.4 },
      { title: 'C', confidence: 0.5 },
    ]);
    expect(kept.map((p) => p.title)).toEqual(['A', 'C']);
  });
});
