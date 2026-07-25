import { facetTerms, type FacetSet } from './facets';

/**
 * Tonight's constraints, and how a warm queue is narrowed to a decision.
 *
 * The architectural point: constraints are applied *locally*, over a queue that
 * was generated without knowing them. Pre-generating per constraint combination
 * would mean warming 27 queues; generating on demand would put a model call back
 * on the critical path, which is the thing that made the app slow. So the queue
 * is deliberately diverse and the filter runs in memory in about a millisecond.
 */

/** Minutes. 'any' is stored as a large number so comparisons stay uniform. */
export const RUNTIME_CAPS = { short: 90, medium: 120, any: 100000 } as const;

export type RuntimeChoice = keyof typeof RUNTIME_CAPS;

/** How much attention the viewer has left, not how "smart" the film is. */
export type EnergyChoice = 'low' | 'medium' | 'high';

export type CompanyChoice = 'alone' | 'two' | 'group';

export type Constraints = {
  runtime: RuntimeChoice;
  energy: EnergyChoice;
  company: CompanyChoice;
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  runtime: 'medium',
  energy: 'medium',
  company: 'alone',
};

export type Candidate = {
  movieId: number;
  title: string;
  year: string;
  posterPath: string | null;
  runtimeMinutes: number | null;
  reason: string;
  facets: FacetSet;
};

/**
 * Facets that demand attention. A viewer with none left bounces off these, which
 * is the most common cause of "I picked something and turned it off".
 */
const DEMANDING = new Set([
  'nonlinear',
  'elliptical',
  'frame story',
  'dread accumulating',
  'slow burn',
  'silence as threat',
  'a war with no front',
  'ensemble braid',
]);

/** Facets that carry a room. */
const CROWD_PLEASING = new Set([
  'needle-drop maximalism',
  'breathless',
  'competence porn',
  'zoom-as-punctuation',
  'chapter cards',
]);

/** Facets that need one person and a closed door. */
const SOLITARY = new Set(['one apartment', 'doomed romance', 'two-hander', 'guilt as engine', 'single POV']);

const ENERGY_WEIGHT: Record<EnergyChoice, number> = { low: -1, medium: 0, high: 1 };

/**
 * How well a candidate fits, in the range roughly -1..1. Deliberately a small
 * readable heuristic rather than a learned model: with no behavioural data yet
 * there is nothing to learn from, and this can be explained to a user.
 */
export function fitScore(candidate: Candidate, constraints: Constraints): number {
  const terms = facetTerms(candidate.facets);
  if (!terms.length) return 0;

  let score = 0;

  const demanding = terms.filter((t) => DEMANDING.has(t)).length / terms.length;
  score += demanding * ENERGY_WEIGHT[constraints.energy];

  if (constraints.company === 'group') {
    score += terms.filter((t) => CROWD_PLEASING.has(t)).length / terms.length;
    score -= terms.filter((t) => SOLITARY.has(t)).length / terms.length;
  } else if (constraints.company === 'alone') {
    score += (terms.filter((t) => SOLITARY.has(t)).length / terms.length) * 0.5;
  }

  return score;
}

export function fitsRuntime(candidate: Candidate, constraints: Constraints): boolean {
  // Unknown runtime is not a reason to hide a film; it is a reason not to promise.
  if (candidate.runtimeMinutes == null) return true;
  return candidate.runtimeMinutes <= RUNTIME_CAPS[constraints.runtime];
}

/**
 * Hard cap on what a user is shown.
 *
 * This is the product decision, not a UI detail. Showing more options is what
 * turns a two-minute choice into a twenty-minute one; the research on choice
 * overload is unambiguous and every competitor's infinite grid is the mistake
 * being corrected here. There is deliberately no "show more".
 */
export const MAX_PICKS = 3;

export type SelectionResult = {
  picks: Candidate[];
  /** True when the runtime cap had to be ignored to fill the list. */
  relaxedRuntime: boolean;
};

/**
 * Narrows a queue to at most MAX_PICKS.
 *
 * Runtime is treated as a hard filter first because it is the one constraint a
 * user states literally ("I have ninety minutes"). If that leaves nothing, the
 * cap is relaxed rather than showing an empty screen — but the caller is told,
 * so the UI can say so instead of quietly breaking its promise.
 */
export function selectPicks(
  queue: Candidate[],
  constraints: Constraints,
  limit: number = MAX_PICKS
): SelectionResult {
  const rank = (items: Candidate[]) =>
    [...items]
      .map((candidate) => ({ candidate, score: fitScore(candidate, constraints) }))
      // Stable within equal scores: the queue's own order encodes taste ranking.
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.candidate);

  const withinRuntime = queue.filter((c) => fitsRuntime(c, constraints));

  if (withinRuntime.length > 0) {
    return { picks: rank(withinRuntime), relaxedRuntime: false };
  }

  return { picks: rank(queue), relaxedRuntime: queue.length > 0 };
}

/** Stable key for a constraint set, for analytics and cache busting. */
export function constraintKey(constraints: Constraints): string {
  return `${constraints.runtime}:${constraints.energy}:${constraints.company}`;
}

export function parseConstraintKey(key: string): Constraints | null {
  const [runtime, energy, company] = key.split(':');
  if (!(runtime in RUNTIME_CAPS)) return null;
  if (!['low', 'medium', 'high'].includes(energy)) return null;
  if (!['alone', 'two', 'group'].includes(company)) return null;
  return {
    runtime: runtime as RuntimeChoice,
    energy: energy as EnergyChoice,
    company: company as CompanyChoice,
  };
}
