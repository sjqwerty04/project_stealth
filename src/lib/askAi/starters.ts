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
  /** Films the text names, in order, so chips can show a poster next to each title. */
  films: FilmRef[];
  spoiler?: boolean;
};

export type StarterInput = {
  film: FilmRef;
  genres?: string[];
  director?: string | null;
  cast?: { name: string; character?: string }[];
  /** Other entries in the same collection, release order. */
  collection?: FilmRef[];
  /** Related films, best first (TMDB recommendations, or LLM-reranked). */
  related?: FilmRef[];
  keywords?: string[];
  /** Questions written by the LLM in the voice of film posts on X, best first. */
  llm?: { text: string; films?: FilmRef[]; spoiler?: boolean }[];
  tapHistory?: Partial<Record<StarterKind, number>>;
};

/** Starters shown per film, across the row and the expanded view. */
export const MAX_STARTERS = 5;

const PRIOR: Record<StarterKind, number> = {
  llm: 100,
  compare: 80,
  meaning: 74,
  related: 72,
  director: 64,
  cast: 60,
  theme: 56,
  'more-like': 52,
  before: 48,
  ending: 44,
};

const SENSITIVE = /(rape|sexual|abuse|suicide|incest|pedophil|murder|torture|violence|gore|nudity|sex|death of|killing|drug|overdose|self-harm|assault|slur)/i;
const GENERIC = /^(woman director|duringcreditsstinger|aftercreditsstinger|sequel|remake|biography|independent film|anime|aftercredits|3d|based on .*)$/i;
// TMDB keywords mix themes with props and places ("sandstorm", "laundromat"); only
// keywords naming an idea read well as a question.
const THEMATIC =
  /(allegory|ambition|betrayal|class|consumerism|corruption|destiny|dream|exploitation|faith|family|fate|forgiveness|freedom|gender|grief|guilt|identity|isolation|jealousy|justice|loneliness|loss|love|madness|manipulation|masculinity|memory|moral|nihilism|obsession|paranoia|patriotism|philosophy|power|privilege|redemption|regret|religio|revenge|vengeance|seclusion|social commentary|subconscious|surveillance|survival|trauma|wealth|capitalis)/i;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

function similar(a: string, b: string, title: string) {
  const own = new Set(normalize(title));
  const wa = new Set(normalize(a).filter((w) => !own.has(w)));
  const wb = new Set(normalize(b).filter((w) => !own.has(w)));
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  wa.forEach((w) => wb.has(w) && shared++);
  return shared / Math.min(wa.size, wb.size) >= 0.75;
}

export function pickThemes(keywords: string[] = [], max = 1) {
  return keywords
    .map((k) => k.trim())
    .filter((k) => k && k.length <= 28 && THEMATIC.test(k) && !SENSITIVE.test(k) && !GENERIC.test(k))
    .slice(0, max);
}

/** Strips em dashes (and spaced en dashes) the model likes to add. */
export function noEmDash(text: string) {
  return text
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s+\u2013\s+/g, ', ')
    .replace(/,\s*([,.!?])/g, '$1')
    .replace(/^,\s*/, '');
}

type Draft = Omit<Starter, 'id' | 'score'>;

// Fallback questions, written the way people post about a film on X: short, opinionated, specific.
function templates(input: StarterInput): Draft[] {
  const f = input.film;
  const t = f.title;
  const out: Draft[] = [];
  const sibling = input.collection?.find((c) => c.id !== f.id && (c.year || '') < (f.year || '9999'));
  const related = (input.related || []).filter((r) => r.id !== f.id && r.id !== sibling?.id);

  if (related[0]) {
    out.push({ kind: 'compare', text: `${t} vs ${related[0].title}: which one hits harder?`, films: [f, related[0]] });
  }
  if (sibling) {
    out.push({ kind: 'related', text: `Do I need to see ${sibling.title} before ${t}?`, films: [sibling, f] });
  } else if (related[1]) {
    out.push({ kind: 'related', text: `Is ${t} basically ${related[1].title} for a new crowd?`, films: [f, related[1]] });
  }
  out.push({ kind: 'meaning', text: `Okay, what is ${t} actually about?`, films: [f] });
  if (input.director) out.push({ kind: 'director', text: `Is this ${input.director}'s best work?`, films: [] });
  const lead = input.cast?.[0];
  if (lead?.character) out.push({ kind: 'cast', text: `${lead.name} as ${lead.character}: career best?`, films: [] });
  const theme = pickThemes(input.keywords)[0];
  if (theme) out.push({ kind: 'theme', text: `Is ${t} secretly about ${theme}?`, films: [f] });
  out.push({ kind: 'more-like', text: `What should I watch after ${t}?`, films: [f] });
  out.push({ kind: 'before', text: `Is ${t} worth the hype?`, films: [f] });
  out.push({ kind: 'ending', text: `That ending. What actually happened?`, films: [], spoiler: true });
  return out;
}

const slug = (s: string) => normalize(s).join('-').slice(0, 60);

/**
 * Per-film starters: LLM-written questions first, metadata templates fill the gaps.
 * Returns MAX_STARTERS non-spoiler starters plus at most one spoiler, which the client
 * shows only once the film is logged (see `visibleStarters`).
 */
export function buildStarters(input: StarterInput): Starter[] {
  const history = input.tapHistory || {};
  const candidates: Starter[] = [];

  (input.llm || []).forEach((q, i) => {
    const text = noEmDash(q.text.trim());
    if (!text) return;
    candidates.push({
      id: `llm-${slug(text)}`,
      kind: 'llm',
      text,
      films: q.films || [],
      spoiler: q.spoiler,
      score: PRIOR.llm - i * 4,
    });
  });
  templates(input).forEach((c, i) => {
    const learned = Math.min(12, (history[c.kind] || 0) * 3);
    candidates.push({ ...c, id: `${c.kind}-${slug(c.text)}`, score: PRIOR[c.kind] + learned - i * 0.1 });
  });

  const unique: Starter[] = [];
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    if (unique.some((u) => u.id === c.id || similar(u.text, c.text, input.film.title))) continue;
    unique.push(c);
  }

  const seen = new Map<StarterKind, number>();
  const firstPass: Starter[] = [];
  const rest: Starter[] = [];
  for (const s of unique) {
    const n = seen.get(s.kind) || 0;
    (n < (s.kind === 'llm' ? 4 : 1) ? firstPass : rest).push(s);
    seen.set(s.kind, n + 1);
  }
  const ordered = [...firstPass, ...rest];
  const safe = ordered.filter((s) => !s.spoiler).slice(0, MAX_STARTERS);
  const spoiler = ordered.find((s) => s.spoiler);
  return spoiler ? [...safe, spoiler] : safe;
}

/** What the user actually sees: spoilers only after they have logged the film. */
export function visibleStarters(starters: Starter[], hasLogged: boolean) {
  const safe = starters.filter((s) => !s.spoiler);
  const spoiler = hasLogged ? starters.find((s) => s.spoiler) : undefined;
  return (spoiler ? [spoiler, ...safe] : safe).slice(0, MAX_STARTERS);
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
    // storage unavailable (private mode): ranking just falls back to priors
  }
}
