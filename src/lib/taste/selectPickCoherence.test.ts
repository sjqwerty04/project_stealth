import { describe, expect, it } from 'vitest';
import {
  hydratedTitleMatchesPick,
  whyMatchNamesRecommended,
} from './selectPickCoherence';

describe('select pick coherence', () => {
  it('accepts the same title and a leading The', () => {
    expect(hydratedTitleMatchesPick('The Departed', 'Departed')).toBe(true);
    expect(hydratedTitleMatchesPick('Heat', 'Heat')).toBe(true);
  });

  it('rejects a hydrated film that is not the recommended title', () => {
    expect(hydratedTitleMatchesPick('Zodiac', 'Se7en')).toBe(false);
    expect(hydratedTitleMatchesPick('Heat', 'The Godfather')).toBe(false);
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
    expect(whyMatchNamesRecommended('Two or three sentences about Film.', 'Film')).toBe(true);
    expect(
      whyMatchNamesRecommended('Two or three sentences. Name a history title.', 'Film'),
    ).toBe(false);
  });
});
