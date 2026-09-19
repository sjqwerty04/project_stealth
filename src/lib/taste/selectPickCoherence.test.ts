import { describe, expect, it } from 'vitest';
import {
  hydratedTitleMatchesPick,
  mentionNeedles,
  whyMatchNamesRecommended,
} from './selectPickCoherence';

describe('select pick coherence', () => {
  it('accepts the same title and a leading The', () => {
    expect(hydratedTitleMatchesPick('The Departed', 'Departed')).toBe(true);
    expect(hydratedTitleMatchesPick('Heat', 'Heat')).toBe(true);
  });

  it('rejects a sequel pick that hydrated as the original', () => {
    expect(hydratedTitleMatchesPick('The Godfather Part II', 'The Godfather')).toBe(false);
    expect(hydratedTitleMatchesPick('Logan', 'The Wolverine')).toBe(false);
  });

  it('requires whyMatch to name the recommended film', () => {
    expect(
      whyMatchNamesRecommended(
        'Zodiac keeps the newspaper-room paranoia you liked in All the President\'s Men.',
        'Zodiac',
      ),
    ).toBe(true);
    expect(
      whyMatchNamesRecommended(
        'You rated Se7en a 5. Fincher patience is the same itch.',
        'Zodiac',
      ),
    ).toBe(false);
  });

  it('keeps a sequel prefix as a why-copy needle', () => {
    expect(mentionNeedles('X2: X-Men United')).toEqual(['X2: X-Men United', 'X2']);
    expect(mentionNeedles('X-Men: The Last Stand')).toEqual(['X-Men: The Last Stand', 'X-Men']);
    expect(mentionNeedles('Heat')).toEqual(['Heat']);
  });
});
