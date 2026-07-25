/**
 * The facet vocabulary.
 *
 * Implements the eight-axis taxonomy proposed in docs/design/DIRECTION.md §7.
 * Before this, the only vocabulary in the system was nineteen TMDB genre
 * strings, which every AI surface reasoned over — the reason recommendations
 * read like a streaming service. Genres describe a shelf; facets describe a
 * film.
 *
 * The terms are a *controlled* vocabulary on purpose. Letting the model emit
 * free text would make two films' facets incomparable, which defeats the whole
 * point: overlap is what produces both the ranking and the explanation.
 */

export const FACET_AXES = [
  'look',
  'camera',
  'tempo',
  'weather',
  'sound',
  'world',
  'shape',
  'format',
] as const;

export type FacetAxis = (typeof FACET_AXES)[number];

/** Human-readable purpose of each axis, used in prompts. */
export const AXIS_PURPOSE: Record<FacetAxis, string> = {
  look: 'how it was photographed',
  camera: 'how the camera behaves',
  tempo: 'how time moves',
  weather: 'moral climate',
  sound: 'the ear',
  world: 'where it lives',
  shape: 'structure',
  format: 'the physical fact',
};

export const FACET_VOCABULARY: Record<FacetAxis, readonly string[]> = {
  look: [
    '35mm grain',
    'anamorphic flare',
    'available light',
    'sodium-and-cyan night',
    'video-tape texture',
    'high-contrast monochrome',
    'Kodachrome warmth',
    'fluorescent institutional',
  ],
  camera: [
    'locked-off',
    'handheld verité',
    'dolly-in on faces',
    'unbroken take',
    "god's-eye overhead",
    'zoom-as-punctuation',
  ],
  tempo: ['slow burn', 'procedural', 'breathless', 'elliptical', 'real-time', 'dread accumulating'],
  weather: [
    'nobody wins',
    'competence porn',
    'doomed romance',
    'guilt as engine',
    'complicity',
    'dignity under pressure',
  ],
  sound: [
    'needle-drop maximalism',
    'silence as threat',
    'synth pulse',
    'diegetic only',
    'score as narrator',
  ],
  world: [
    'rain-slick city night',
    'sunbaked backroad',
    'institutional corridors',
    'one apartment',
    'the sea',
    'a war with no front',
  ],
  shape: ['nonlinear', 'frame story', 'chapter cards', 'ensemble braid', 'single POV', 'two-hander'],
  format: [
    '1.37 Academy',
    '2.39 anamorphic',
    'IMAX 70mm',
    '16mm blowup',
    'shot digital, finished on film',
  ],
};

export type FacetSet = Partial<Record<FacetAxis, string[]>>;

/** A film's facets, 4–7 terms total across any axes. */
export const MIN_FACETS_PER_FILM = 4;
export const MAX_FACETS_PER_FILM = 7;

const VALID_TERMS: Map<FacetAxis, Set<string>> = new Map(
  FACET_AXES.map((axis) => [axis, new Set(FACET_VOCABULARY[axis].map((t) => t.toLowerCase()))])
);

const ALL_TERMS: Map<string, FacetAxis> = new Map(
  FACET_AXES.flatMap((axis) =>
    FACET_VOCABULARY[axis].map((term) => [term.toLowerCase(), axis] as [string, FacetAxis])
  )
);

export function isFacetAxis(value: string): value is FacetAxis {
  return (FACET_AXES as readonly string[]).includes(value);
}

export function isValidTerm(axis: FacetAxis, term: string): boolean {
  return VALID_TERMS.get(axis)?.has(term.trim().toLowerCase()) ?? false;
}

/** The axis a term belongs to, or null if it is not in the vocabulary. */
export function axisOf(term: string): FacetAxis | null {
  return ALL_TERMS.get(term.trim().toLowerCase()) ?? null;
}

/**
 * Discards anything the model invented and caps the total.
 *
 * Models reliably return *plausible* facets that are not in the vocabulary
 * ("neon-drenched" for "sodium-and-cyan night"). Keeping those would silently
 * split the corpus into terms that can never match anything, so they are
 * dropped rather than coerced.
 */
export function sanitizeFacets(raw: unknown): FacetSet {
  if (!raw || typeof raw !== 'object') return {};

  const result: FacetSet = {};
  let total = 0;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const axis = key.trim().toLowerCase();
    if (!isFacetAxis(axis)) continue;

    const terms = Array.isArray(value) ? value : [value];
    const kept: string[] = [];

    for (const term of terms) {
      if (typeof term !== 'string') continue;
      if (total + kept.length >= MAX_FACETS_PER_FILM) break;
      if (!isValidTerm(axis, term)) continue;

      // Store the vocabulary's own casing so keys compare reliably later.
      const canonical = FACET_VOCABULARY[axis].find(
        (t) => t.toLowerCase() === term.trim().toLowerCase()
      );
      if (canonical && !kept.includes(canonical)) kept.push(canonical);
    }

    if (kept.length) {
      result[axis] = kept;
      total += kept.length;
    }
  }

  return result;
}

export function facetCount(facets: FacetSet): number {
  return Object.values(facets).reduce((sum, terms) => sum + (terms?.length ?? 0), 0);
}

/** Flattens to a comparable set of terms, ignoring which axis they came from. */
export function facetTerms(facets: FacetSet): string[] {
  return FACET_AXES.flatMap((axis) => facets[axis] ?? []);
}

/**
 * Inverse-frequency weight for a term across a corpus.
 *
 * Two films sharing 'heist procedural' tells you far more than two films sharing
 * something half the corpus has. Without this, common terms dominate every
 * comparison and everything looks similar to everything.
 */
export function facetWeights(corpus: FacetSet[]): Map<string, number> {
  const documentCount = Math.max(corpus.length, 1);
  const frequency = new Map<string, number>();

  for (const facets of corpus) {
    for (const term of new Set(facetTerms(facets))) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    }
  }

  const weights = new Map<string, number>();
  for (const [term, count] of frequency) {
    // Smoothed IDF; the +1 inside keeps a term present in every document at a
    // small positive weight rather than exactly zero.
    weights.set(term, Math.log(1 + documentCount / count));
  }
  return weights;
}

/**
 * Weighted overlap between two films, normalised to 0–1.
 *
 * Deliberately explainable: the score is the weight of what they share over the
 * weight of everything either has. No training data, no embedding, and the
 * shared terms are exactly the sentence shown to the user.
 */
export function facetSimilarity(
  a: FacetSet,
  b: FacetSet,
  weights?: Map<string, number>
): number {
  const termsA = new Set(facetTerms(a));
  const termsB = new Set(facetTerms(b));
  if (!termsA.size || !termsB.size) return 0;

  const weightOf = (term: string) => weights?.get(term) ?? 1;

  let shared = 0;
  let union = 0;

  for (const term of new Set([...termsA, ...termsB])) {
    const weight = weightOf(term);
    union += weight;
    if (termsA.has(term) && termsB.has(term)) shared += weight;
  }

  return union === 0 ? 0 : shared / union;
}

/** The terms two films share, heaviest first. */
export function sharedFacets(a: FacetSet, b: FacetSet, weights?: Map<string, number>): string[] {
  const termsB = new Set(facetTerms(b));
  return facetTerms(a)
    .filter((term) => termsB.has(term))
    .sort((x, y) => (weights?.get(y) ?? 1) - (weights?.get(x) ?? 1));
}

/**
 * The edge between two films as a phrase rather than a number — "because of the
 * night" instead of "87% match". Returns null when they share nothing, so
 * callers show no heading rather than an empty one.
 */
export function explainOverlap(
  a: FacetSet,
  b: FacetSet,
  weights?: Map<string, number>
): string | null {
  const shared = sharedFacets(a, b, weights).slice(0, 4);
  return shared.length ? shared.join(' · ') : null;
}

/** The vocabulary as prompt text, so the model picks from it instead of inventing. */
export function vocabularyPrompt(): string {
  return FACET_AXES.map(
    (axis) => `${axis} (${AXIS_PURPOSE[axis]}): ${FACET_VOCABULARY[axis].join(' · ')}`
  ).join('\n');
}
