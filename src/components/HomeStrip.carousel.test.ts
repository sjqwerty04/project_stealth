import { describe, expect, it } from 'vitest';
import {
  loopingSlides,
  relatedFromWhy,
  SELECTS_AUTOPLAY_MS,
  SELECTS_TRANSITION_MS,
  snapLoopIndex,
} from './selectsCarousel';

describe('selects carousel loop', () => {
  const slides = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('clones last and first so wrap can animate sideways', () => {
    expect(loopingSlides(slides).map((s) => s.id)).toEqual([3, 1, 2, 3, 1]);
  });

  it('snaps clone of last (index 0) to the real last slide', () => {
    expect(snapLoopIndex(0, 3)).toBe(3);
  });

  it('snaps clone of first (index 4) to the real first slide', () => {
    expect(snapLoopIndex(4, 3)).toBe(1);
  });

  it('leaves in-range indices alone', () => {
    expect(snapLoopIndex(1, 3)).toBeNull();
    expect(snapLoopIndex(3, 3)).toBeNull();
  });

  it('holds 6.2s and eases 900ms', () => {
    expect(SELECTS_AUTOPLAY_MS).toBe(6200);
    expect(SELECTS_TRANSITION_MS).toBe(900);
  });
});

describe('relatedFromWhy', () => {
  const diary = [
    { title: 'Heat', poster: 'heat.jpg' },
    { title: "All the President's Men", poster: 'atpm.jpg' },
    { title: 'Se7en', poster: 'se7en.jpg' },
    { title: 'The', poster: 'the.jpg' },
  ];

  it('matches diary titles named in whyMatch, longer first, cap 2', () => {
    expect(
      relatedFromWhy(
        "You rated Se7en a 5 and logged All the President's Men last month.",
        diary,
        'Zodiac',
      ),
    ).toEqual([
      { title: "All the President's Men", poster: 'atpm.jpg' },
      { title: 'Se7en', poster: 'se7en.jpg' },
    ]);
  });

  it('excludes the current film title', () => {
    expect(
      relatedFromWhy('You logged Heat after Thief.', [...diary, { title: 'Thief', poster: 'thief.jpg' }], 'Heat'),
    ).toEqual([{ title: 'Thief', poster: 'thief.jpg' }]);
  });

  it('does not let a short title steal a longer match', () => {
    expect(
      relatedFromWhy("All the President's Men is the template.", diary, 'Zodiac'),
    ).toEqual([{ title: "All the President's Men", poster: 'atpm.jpg' }]);
  });
});
