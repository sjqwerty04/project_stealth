export type ImportSourceId = 'letterboxd' | 'imdb' | 'notes' | 'images';

export type Facet = 'look' | 'tempo' | 'weather' | 'world' | 'shape' | 'format';

export const FACETS: readonly Facet[] = ['look', 'tempo', 'weather', 'world', 'shape', 'format'];

/** Everything the profile author is allowed to quote. Computed client side, never invented. */
export type TasteStats = {
  filmsRead: number;
  nights: number;
  hours: number;
  lateNightPct: number | null;
  rewatchOfFiveStarPct: number | null;
  fiveStarCount: number;
  topDecades: [string, number][];
  topPeople: [string, number][];
  topGenres: [string, number][];
  facetWeights: Record<Facet, number>;
  colourHex: string;
  postersSampled: number;
  graphSeed: string;
  sources: ImportSourceId[];
  positive: string[];
  negative: string[];
  axes: string[];
};

export type Insight = {
  title: string;
  headline: string;
  body: string;
  tone: 'warm' | 'sharp';
};

export type SelectsProfile = {
  archetype: string | null;
  read: string;
  insights: Insight[];
};

export const INSIGHT_COUNT = 10;
export const SHARP_COUNT = 2;

const EM_DASH = /[\u2013\u2014]/;

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(EM_DASH, ',').trim();
  return s.length > 0 && s.length <= max ? s : null;
}

/**
 * Boundary parser for whatever the model returns. Enforces the card ratio and rejects anything malformed.
 * Returns null when the payload cannot be trusted; callers fall back to templates.
 */
export function parseSelectsProfile(raw: unknown): SelectsProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const read = cleanString(o.read, 160);
  if (!read) return null;
  const archetypeRaw = o.archetype;
  const archetype = archetypeRaw === null || archetypeRaw === undefined ? null : cleanString(archetypeRaw, 24);
  if (archetypeRaw && !archetype) return null;
  if (!Array.isArray(o.insights)) return null;
  const insights: Insight[] = [];
  for (const item of o.insights) {
    if (!item || typeof item !== 'object') return null;
    const c = item as Record<string, unknown>;
    const title = cleanString(c.title, 32);
    const headline = cleanString(c.headline, 120);
    const body = cleanString(c.body, 220);
    const tone = c.tone === 'sharp' ? 'sharp' : c.tone === 'warm' ? 'warm' : null;
    if (!title || !headline || !body || !tone) return null;
    insights.push({ title: title.toUpperCase(), headline, body, tone });
  }
  if (insights.length !== INSIGHT_COUNT) return null;
  if (insights.filter((i) => i.tone === 'sharp').length !== SHARP_COUNT) return null;
  return { archetype: archetype ? archetype.toUpperCase() : null, read, insights };
}

export const MAX_LABEL_CHARS = 120;
export const MAX_LIST_ITEMS = 10;

const EMPTY_WEIGHTS: Record<Facet, number> = { look: 1, tempo: 1, weather: 1, world: 1, shape: 1, format: 1 };

/** Only the six known facets survive, each as a finite number; foreign keys and strings never reach the prompt. */
function facetWeightsFrom(raw: unknown): Record<Facet, number> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...EMPTY_WEIGHTS };
  for (const f of FACETS) {
    const v = src[f];
    if (typeof v === 'number' && Number.isFinite(v)) out[f] = Math.min(10, Math.max(0, v));
  }
  return out;
}

/** Fill any field a client forgot so the template author never reads undefined. */
export function normalizeStats(raw: Partial<TasteStats>): TasteStats {
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const nullable = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  // Every string here is serialised into the model prompt, so caps bound the input-token cost per call.
  const clip = (s: string) => s.slice(0, MAX_LABEL_CHARS);
  const pairs = (v: unknown): [string, number][] =>
    Array.isArray(v)
      ? v
          .filter((p): p is [string, number] => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'number')
          .slice(0, MAX_LIST_ITEMS)
          .map(([label, count]) => [clip(label), count])
      : [];
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, MAX_LIST_ITEMS).map(clip) : [];
  return {
    filmsRead: num(raw.filmsRead),
    nights: num(raw.nights),
    hours: num(raw.hours),
    lateNightPct: nullable(raw.lateNightPct),
    rewatchOfFiveStarPct: nullable(raw.rewatchOfFiveStarPct),
    fiveStarCount: num(raw.fiveStarCount),
    topDecades: pairs(raw.topDecades),
    topPeople: pairs(raw.topPeople),
    topGenres: pairs(raw.topGenres),
    facetWeights: facetWeightsFrom(raw.facetWeights),
    colourHex: typeof raw.colourHex === 'string' && /^#[0-9a-f]{6}$/i.test(raw.colourHex) ? raw.colourHex : '#3A6E85',
    postersSampled: num(raw.postersSampled),
    graphSeed: typeof raw.graphSeed === 'string' ? raw.graphSeed.slice(0, 64) : '',
    sources: strings(raw.sources) as ImportSourceId[],
    positive: strings(raw.positive),
    negative: strings(raw.negative),
    axes: strings(raw.axes),
  };
}

function pct(n: number | null): string {
  return n === null ? '' : `${Math.round(n)}%`;
}

/** The model only runs when there is something to read. An empty payload gets the template for free. */
export function meaningfulStats(stats: TasteStats): boolean {
  return stats.filmsRead > 0 || stats.positive.length > 0 || stats.negative.length > 0;
}

/** Deterministic fallback so the reward never blanks when the model is slow or down. */
export function templateProfile(stats: TasteStats): SelectsProfile {
  const decade = stats.topDecades[0]?.[0] ?? null;
  const person = stats.topPeople[0]?.[0] ?? null;
  const genre = stats.topGenres[0]?.[0] ?? null;
  const first = stats.positive[0] ?? null;
  const reject = stats.negative[0] ?? null;
  const hours = Math.round(stats.hours);
  const cards: Insight[] = [
    {
      title: 'THE COUNT',
      headline: `${stats.filmsRead}`,
      body: stats.filmsRead > 0 ? `films read. ${hours} hours, give or take a trailer.` : 'films read. The floor is yours to lay.',
      tone: 'warm',
    },
    {
      title: 'THE ANCHOR',
      headline: first ? `${first}.` : 'One film, forever.',
      body: first ? 'The one you would rent the theatre for. Everything else is measured against it.' : 'You skipped the anchor. The map will find one.',
      tone: 'warm',
    },
    {
      title: 'THE DECADE',
      headline: decade ? `${decade}s.` : 'No decade yet.',
      body: decade ? `Where most of your logs land. A home base, not a cage.` : 'Log a few nights and a decade will claim you.',
      tone: 'warm',
    },
    {
      title: 'THE COMPANY',
      headline: person ? `${person}.` : 'No regulars yet.',
      body: person ? 'The name that keeps turning up. You go back to the same people.' : 'Nobody repeats yet. That changes fast.',
      tone: 'warm',
    },
    {
      title: 'THE HOUR',
      headline: stats.lateNightPct === null ? 'No hour yet.' : stats.lateNightPct >= 50 ? 'You watch late.' : 'Lights down before ten.',
      body: stats.lateNightPct !== null ? `${pct(stats.lateNightPct)} of your dated logs start after 10pm.` : 'Dated logs will tell us when the lights go down.',
      tone: 'warm',
    },
    {
      title: 'THE GENRE',
      headline: genre ? `${genre}.` : 'Undeclared.',
      body: genre ? 'The shelf you reach for first. Noted, not judged.' : 'No genre leads yet.',
      tone: 'warm',
    },
    {
      title: 'THE LENS',
      headline: stats.axes.length ? stats.axes.join(' and ') + '.' : 'Both, depending.',
      body: 'How you judge, which is not the same as what you like.',
      tone: 'warm',
    },
    {
      title: 'THE COLOUR',
      headline: stats.colourHex.toUpperCase(),
      body: `The average of ${stats.postersSampled} posters you have lived with. It drifts as you log.`,
      tone: 'warm',
    },
    {
      title: 'THE RESISTANCE',
      headline: reject ? `${reject}.` : 'Nothing struck.',
      body: reject ? 'Everyone loved it. You did not. That carves the map more than a like does.' : 'You resisted nothing. Suspicious, honestly.',
      tone: 'sharp',
    },
    {
      title: 'ONE IN FIVE',
      headline:
        stats.rewatchOfFiveStarPct !== null
          ? stats.rewatchOfFiveStarPct === 0
            ? 'You have never rewatched anything you gave five stars.'
            : `You rewatched ${pct(stats.rewatchOfFiveStarPct)} of your five stars.`
          : 'No five stars on record.',
      body: 'Make of that what you like.',
      tone: 'sharp',
    },
  ];
  return { archetype: null, read: 'The map is thin. It fills in as you log.', insights: cards };
}
