import { describe, expect, it } from 'vitest';
import { loopingSlides, snapLoopIndex } from './selectsCarouselLogic';

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
});
