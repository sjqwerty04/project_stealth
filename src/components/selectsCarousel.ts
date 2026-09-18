export function loopingSlides<T>(slides: T[]): T[] {
  if (slides.length < 2) return slides;
  return [slides[slides.length - 1], ...slides, slides[0]];
}

/** After a wrap animation lands on a clone, jump to the matching real slide. */
export function snapLoopIndex(index: number, count: number): number | null {
  if (count < 2) return null;
  if (index === 0) return count;
  if (index === count + 1) return 1;
  return null;
}

export const SELECTS_AUTOPLAY_MS = 6200;
export const SELECTS_TRANSITION_MS = 900;
export const SELECTS_TRANSITION_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
