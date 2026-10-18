export type StarterKind =
  | 'llm'
  | 'compare'
  | 'related'
  | 'meaning'
  | 'theme'
  | 'director'
  | 'cast'
  | 'more-like'
  | 'before'
  | 'ending';

export type FilmRef = { id: number; title: string; year?: string; posterPath: string | null };

export type Starter = {
  id: string;
  text: string;
  kind: StarterKind;
  score: number;
  /** Titles that appear in `text`, in that order. Posters follow this list. */
  films: FilmRef[];
  brief?: string;
  spoiler?: boolean;
};

export type DiscourseQuestion = {
  text: string;
  films?: FilmRef[];
  brief?: string;
  spoiler?: boolean;
};

export type StarterInput = {
  film: FilmRef;
  related?: FilmRef[];
  collection?: FilmRef[];
  questions?: DiscourseQuestion[];
};

/** Starters shown per film, in the one scrolling row. */
export const MAX_STARTERS = 5;

const GENERIC_QUESTION =
  /which one hits harder|actually about\b|\bbest work\b|career best\b|worth the hype|what should i watch after|for a new crowd|need to see .{0,48} before\b/i;

function isGenericQuestion(text: string) {
  return GENERIC_QUESTION.test(text);
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** Strips em dashes (and spaced en dashes) the model likes to add. */
export function noEmDash(text: string) {
  return text
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s+\u2013\s+/g, ', ')
    .replace(/,\s*([,.!?])/g, '$1')
    .replace(/^,\s*/, '');
}

function namedFilms(text: string, pool: FilmRef[]): FilmRef[] {
  const lower = text.toLowerCase();
  const seen = new Set<number>();
  const hits: FilmRef[] = [];
  for (const film of pool) {
    if (!film?.title || seen.has(film.id)) continue;
    if (!lower.includes(film.title.toLowerCase())) continue;
    seen.add(film.id);
    hits.push(film);
  }
  return hits.sort(
    (a, b) => lower.indexOf(a.title.toLowerCase()) - lower.indexOf(b.title.toLowerCase()),
  );
}

const slug = (s: string) => normalize(s).join('-').slice(0, 60);

/** At most MAX_STARTERS non-spoilers, then one spoiler. Generic phrasings are dropped. */
export function buildStarters(input: StarterInput): Starter[] {
  const pool = [
    input.film,
    ...(input.related || []),
    ...(input.collection || []),
    ...((input.questions || []).flatMap((q) => q.films || [])),
  ];
  const unique: Starter[] = [];
  const seen = new Set<string>();
  (input.questions || []).forEach((q, i) => {
    const text = noEmDash((q.text || '').trim());
    const key = text.toLowerCase();
    if (!text || text.length > 110 || isGenericQuestion(text) || seen.has(key)) return;
    seen.add(key);
    const brief = q.brief ? noEmDash(q.brief.trim()) : '';
    unique.push({
      id: `llm-${slug(text)}`,
      kind: 'llm',
      text,
      films: namedFilms(text, pool),
      brief: brief || undefined,
      spoiler: !!q.spoiler,
      score: 100 - i,
    });
  });

  const safe = unique.filter((s) => !s.spoiler).slice(0, MAX_STARTERS);
  const spoiler = unique.find((s) => s.spoiler);
  return spoiler ? [...safe, spoiler] : safe;
}

/** What the user actually sees: spoilers only after they have logged the film. */
export function visibleStarters(starters: Starter[], hasLogged: boolean) {
  const safe = starters.filter((s) => !s.spoiler);
  const spoiler = hasLogged ? starters.find((s) => s.spoiler) : undefined;
  return (spoiler ? [spoiler, ...safe] : safe).slice(0, MAX_STARTERS);
}

/** Give up waiting for the library snapshot and paint a cached row with the spoiler withheld. */
export const LIBRARY_WAIT_MS = 900;

export type VisibleState = {
  /** Already painted this visit. Stays put, so a late response cannot reshuffle the row. */
  shown: Starter[] | null;
  local: Starter[] | null;
  server: Starter[] | null;
  graceElapsed: boolean;
  hasLogged: boolean;
  /** Library snapshot has resolved, so the spoiler decision is real. */
  logKnown: boolean;
};

/**
 * Picks the row to paint. Only a cached or server discourse set can paint.
 * `shown` is returned unchanged. An empty list is a real result.
 */
export function resolveVisibleStarters(state: VisibleState): Starter[] | null {
  if (state.shown) return state.shown;
  const cached = state.local || state.server;
  if (!cached) return null;
  if (!state.logKnown && !state.graceElapsed) return null;
  return visibleStarters(cached, state.logKnown && state.hasLogged);
}

const TAPS_KEY = 'selects.askAi.taps';

export function readTapHistory(): Partial<Record<StarterKind, number>> {
  try {
    return JSON.parse(localStorage.getItem(TAPS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function recordTap(kind: StarterKind) {
  try {
    const h = readTapHistory();
    h[kind] = (h[kind] || 0) + 1;
    localStorage.setItem(TAPS_KEY, JSON.stringify(h));
  } catch {
    // storage unavailable
  }
}
