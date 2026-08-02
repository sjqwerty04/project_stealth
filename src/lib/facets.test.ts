import { describe, expect, it } from 'vitest';
import {
  axisOf,
  explainOverlap,
  facetCount,
  facetSimilarity,
  facetTerms,
  facetWeights,
  isValidTerm,
  MAX_FACETS_PER_FILM,
  sanitizeFacets,
  sharedFacets,
  vocabularyPrompt,
  type FacetSet,
} from './facets';

// The worked example from DIRECTION.md §7. If the taxonomy ever stops producing
// a sensible edge between these two, the vocabulary has drifted.
const HEAT: FacetSet = {
  look: ['sodium-and-cyan night', 'available light'],
  camera: ['locked-off', 'dolly-in on faces'],
  tempo: ['procedural', 'slow burn'],
  weather: ['competence porn', 'nobody wins'],
  world: ['rain-slick city night'],
  format: ['2.39 anamorphic'],
};

const DARK_KNIGHT: FacetSet = {
  look: ['sodium-and-cyan night', 'high-contrast monochrome'],
  camera: ['handheld verité', "god's-eye overhead"],
  tempo: ['procedural', 'breathless'],
  weather: ['competence porn', 'complicity'],
  world: ['rain-slick city night'],
  format: ['IMAX 70mm'],
};

const ONE_APARTMENT_DRAMA: FacetSet = {
  look: ['available light'],
  tempo: ['elliptical'],
  world: ['one apartment'],
  shape: ['two-hander'],
};

describe('vocabulary lookups', () => {
  it('accepts a term on its own axis', () => {
    expect(isValidTerm('tempo', 'slow burn')).toBe(true);
  });

  it('rejects a real term filed under the wrong axis', () => {
    expect(isValidTerm('tempo', 'IMAX 70mm')).toBe(false);
  });

  it('is case and whitespace insensitive', () => {
    expect(isValidTerm('tempo', '  SLOW BURN ')).toBe(true);
  });

  it('resolves a term back to its axis', () => {
    expect(axisOf('IMAX 70mm')).toBe('format');
    expect(axisOf('neon-drenched')).toBeNull();
  });
});

describe('sanitizeFacets', () => {
  it('keeps valid terms and canonicalises their casing', () => {
    expect(sanitizeFacets({ tempo: ['SLOW BURN'] })).toEqual({ tempo: ['slow burn'] });
  });

  it('drops plausible terms the model invented rather than coercing them', () => {
    // 'neon-drenched' is the kind of thing a model offers for the real term
    // 'sodium-and-cyan night'. Keeping it would create a term that can never match.
    expect(sanitizeFacets({ look: ['neon-drenched', 'sodium-and-cyan night'] })).toEqual({
      look: ['sodium-and-cyan night'],
    });
  });

  it('drops unknown axes', () => {
    expect(sanitizeFacets({ mood: ['slow burn'] })).toEqual({});
  });

  it('caps the total number of facets', () => {
    const result = sanitizeFacets({
      look: [
        '35mm grain',
        'anamorphic flare',
        'available light',
        'sodium-and-cyan night',
        'video-tape texture',
      ],
      tempo: ['slow burn', 'procedural', 'breathless', 'elliptical'],
    });
    expect(facetCount(result)).toBeLessThanOrEqual(MAX_FACETS_PER_FILM);
  });

  it('de-duplicates repeated terms', () => {
    expect(sanitizeFacets({ tempo: ['slow burn', 'Slow Burn'] })).toEqual({ tempo: ['slow burn'] });
  });

  it('survives junk without throwing', () => {
    expect(sanitizeFacets(null)).toEqual({});
    expect(sanitizeFacets('slow burn')).toEqual({});
    expect(sanitizeFacets({ tempo: [42, null, 'slow burn'] })).toEqual({ tempo: ['slow burn'] });
  });

  it('accepts a bare string where the model forgot the array', () => {
    expect(sanitizeFacets({ tempo: 'procedural' })).toEqual({ tempo: ['procedural'] });
  });
});

describe('facetSimilarity', () => {
  it('scores an unrelated film below a related one', () => {
    expect(facetSimilarity(HEAT, DARK_KNIGHT)).toBeGreaterThan(
      facetSimilarity(HEAT, ONE_APARTMENT_DRAMA)
    );
  });

  it('is 1 for identical facets and 0 for disjoint ones', () => {
    expect(facetSimilarity(HEAT, HEAT)).toBe(1);
    expect(facetSimilarity({ tempo: ['slow burn'] }, { tempo: ['breathless'] })).toBe(0);
  });

  it('is symmetric', () => {
    expect(facetSimilarity(HEAT, DARK_KNIGHT)).toBeCloseTo(facetSimilarity(DARK_KNIGHT, HEAT));
  });

  it('returns 0 when either side has no facets', () => {
    expect(facetSimilarity({}, HEAT)).toBe(0);
    expect(facetSimilarity(HEAT, {})).toBe(0);
  });
});

describe('facetWeights', () => {
  it('weights a rare term above a ubiquitous one', () => {
    const corpus: FacetSet[] = [
      { tempo: ['procedural'], format: ['IMAX 70mm'] },
      { tempo: ['procedural'] },
      { tempo: ['procedural'] },
      { tempo: ['procedural'] },
    ];
    const weights = facetWeights(corpus);
    expect(weights.get('IMAX 70mm')!).toBeGreaterThan(weights.get('procedural')!);
  });

  it('lets a rare shared term outrank a common one when ranking neighbours', () => {
    const corpus = [HEAT, DARK_KNIGHT, ONE_APARTMENT_DRAMA];
    const weights = facetWeights(corpus);
    const ranked = sharedFacets(HEAT, DARK_KNIGHT, weights);
    // 'available light' is shared with the drama too, so it must not lead.
    expect(ranked[0]).not.toBe('available light');
  });

  it('does not divide by zero on an empty corpus', () => {
    expect(facetWeights([]).size).toBe(0);
  });
});

describe('explainOverlap', () => {
  it('answers the Heat / Dark Knight case with a phrase, not a score', () => {
    const explanation = explainOverlap(HEAT, DARK_KNIGHT);
    expect(explanation).toContain('sodium-and-cyan night');
    expect(explanation).toContain('rain-slick city night');
    expect(explanation).not.toMatch(/\d/);
  });

  it('shows at most four terms so the heading stays readable', () => {
    expect(explainOverlap(HEAT, HEAT)!.split(' · ')).toHaveLength(4);
  });

  it('returns null when nothing is shared, so no empty heading renders', () => {
    expect(explainOverlap({ tempo: ['slow burn'] }, { tempo: ['breathless'] })).toBeNull();
  });
});

describe('facetTerms', () => {
  it('flattens across axes in a stable order', () => {
    expect(facetTerms({ tempo: ['procedural'], look: ['35mm grain'] })).toEqual([
      '35mm grain',
      'procedural',
    ]);
  });
});

describe('vocabularyPrompt', () => {
  it('lists every axis with its purpose so the model picks rather than invents', () => {
    const prompt = vocabularyPrompt();
    expect(prompt).toContain('tempo (how time moves)');
    expect(prompt).toContain('sodium-and-cyan night');
    expect(prompt.split('\n')).toHaveLength(8);
  });
});
