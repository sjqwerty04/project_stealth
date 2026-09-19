import { describe, expect, it } from 'vitest';
import { applyTasteEvent, shouldRebuildDiary } from './applyEvent';
import { buildRecommendContext, emptySnapshot } from './buildRecommendContext';
import type { DiaryEvidence, TasteEvent, TheaterTasteEvent } from './types';

const INSIGHT = 'You keep opening films where the plan is perfect and the ending is not.';
const OLDER = 'Someone has a thing for rain-slick city nights.';

const KEPT: TheaterTasteEvent = { type: 'theater', insight: INSIGHT, movieIds: [10858, 949] };
const LEGACY_PATTERN: TasteEvent = { type: 'pattern', insight: INSIGHT, movieIds: [10858, 949] };

function evidence(patterns: string[]): DiaryEvidence {
  return {
    identity: { personaLine: null, axis: null },
    favorites: [],
    disliked: [],
    rated: [],
    watchlist: [],
    skipped: [],
    searches: [],
    patterns,
  };
}

describe('theater taste events', () => {
  it('prepends the kept insight to the pattern list and records the event id', () => {
    const next = applyTasteEvent(emptySnapshot(), KEPT, 'event-1');

    expect(next.generated.patterns).toEqual([INSIGHT]);
    expect(next.pointers.lastEventId).toBe('event-1');
  });

  it('gives a legacy pattern event the same literal output', () => {
    const fromTheater = applyTasteEvent(emptySnapshot(), KEPT, 'event-1');
    const fromPattern = applyTasteEvent(emptySnapshot(), LEGACY_PATTERN, 'event-1');

    expect(fromPattern.generated.patterns).toEqual([INSIGHT]);
    expect(fromPattern.generated.patterns).toEqual(fromTheater.generated.patterns);
  });

  it('keeps the newest insight first and never repeats one', () => {
    const withOlder = applyTasteEvent(emptySnapshot(), { type: 'pattern', insight: OLDER, movieIds: [] }, 'event-1');
    const withNewer = applyTasteEvent(withOlder, KEPT, 'event-2');

    expect(withNewer.generated.patterns).toEqual([INSIGHT, OLDER]);
    expect(applyTasteEvent(withNewer, KEPT, 'event-3').generated.patterns).toEqual([INSIGHT, OLDER]);
  });

  it('holds eight insights at most', () => {
    let snapshot = emptySnapshot();
    for (let i = 1; i <= 9; i += 1) {
      snapshot = applyTasteEvent(snapshot, { type: 'theater', insight: `insight ${i}`, movieIds: [] }, `event-${i}`);
    }
    expect(snapshot.generated.patterns).toHaveLength(8);
    expect(snapshot.generated.patterns[0]).toBe('insight 9');
    expect(snapshot.generated.patterns).not.toContain('insight 1');
  });

  it('rebuilds the diary for a kept Theater and leaves legacy patterns alone', () => {
    expect(shouldRebuildDiary(KEPT)).toBe(true);
    expect(shouldRebuildDiary(LEGACY_PATTERN)).toBe(false);
  });

  it('leaves history and preferences untouched on the snapshot itself', () => {
    const next = applyTasteEvent(emptySnapshot(), KEPT, 'event-1');
    expect(next.context.history).toEqual([]);
    expect(next.context.preferences).toEqual([]);
  });
});

describe('buildRecommendContext with a kept Theater', () => {
  it('feeds the newest insight into preferences', () => {
    const context = buildRecommendContext(evidence([INSIGHT, OLDER]));
    expect(context.preferences).toEqual([`theater: ${INSIGHT}`]);
  });

  it('places the insight after the axis preference and before the favourites', () => {
    const context = buildRecommendContext({
      ...evidence([INSIGHT]),
      identity: { personaLine: null, axis: 'story' },
      favorites: [{ title: 'Heat', movieId: 949 }],
    });
    expect(context.preferences).toEqual(['story-driven films', `theater: ${INSIGHT}`, 'Heat']);
  });

  it('adds nothing when no Theater has been kept', () => {
    expect(buildRecommendContext(evidence([])).preferences).toEqual([]);
  });

  it('reaches the chat summary through the rebuilt context', () => {
    const rebuilt = applyTasteEvent(emptySnapshot(), KEPT, 'event-1');
    const context = buildRecommendContext(evidence(rebuilt.generated.patterns));
    expect(context.preferences).toEqual([`theater: ${INSIGHT}`]);
  });
});
