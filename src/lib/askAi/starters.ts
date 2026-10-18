export type StarterKind =
  | 'faq'
  | 'compare'
  | 'related'
  | 'meaning'
  | 'theme'
  | 'director'
  | 'cast'
  | 'more-like'
  | 'before'
  | 'ending';

export type Starter = {
  id: string;
  text: string;
  kind: StarterKind;
  score: number;
};

export type StarterFilm = { title: string; year?: string };

export type StarterInput = {
  title: string;
  year?: string;
  genres?: string[];
  director?: string | null;
  cast?: { name: string; character?: string }[];
  /** Other entries in the same TMDB collection (sequels, prequels). */
  collection?: StarterFilm[];
  /** TMDB recommendations, best first. */
  related?: StarterFilm[];
  /** TMDB keywords, used as themes. */
  keywords?: string[];
  /** Most-asked questions for this film (Reddit-grounded LLM), most asked first. */
  faq?: string[];
  /** How often this user has tapped each kind before. */
  tapHistory?: Partial<Record<StarterKind, number>>;
};

// Priors reflect how often each question shape gets tapped across films; FAQ wins
// because it is grounded in what viewers of this exact film ask.
const PRIOR: Record<StarterKind, number> = {
  faq: 100,
  compare: 80,
  meaning: 74,
  related: 70,
  'more-like': 66,
  theme: 60,
  director: 56,
  before: 50,
  cast: 46,
  ending: 40,
};

// Keywords that must never be surfaced as a one-tap prompt, even when TMDB tags the film with them.
const SENSITIVE = /(rape|sexual|abuse|suicide|incest|pedophil|murder|torture|violence|gore|nudity|sex|death of|killing|drug|overdose|self-harm|assault|slur)/i;
const GENERIC = /^(woman director|duringcreditsstinger|aftercreditsstinger|sequel|remake|biography|independent film|anime|aftercredits|3d|based on .*)$/i;

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

const genreNoun = (genre: string) => {
  const g = genre.toLowerCase();
  if (g === 'science fiction') return 'sci-fi';
  if (g === 'tv movie') return '';
  return g;
};

// TMDB keywords mix themes with props and places ("sandstorm", "laundromat"); only
// keywords naming an idea read well as "How does X explore …?".
const THEMATIC =
  /(allegory|ambition|betrayal|class|consumerism|corruption|destiny|dream|exploitation|faith|family|fate|forgiveness|freedom|gender|grief|guilt|identity|isolation|jealousy|justice|loneliness|loss|love|madness|manipulation|masculinity|memory|moral|nihilism|obsession|paranoia|patriotism|philosophy|power|privilege|redemption|regret|religio|revenge|vengeance|seclusion|social commentary|subconscious|surveillance|survival|trauma|wealth|capitalis)/i;

export function pickThemes(keywords: string[] = [], max = 2) {
  return keywords
    .map((k) => k.trim())
    .filter((k) => k && k.length <= 28 && THEMATIC.test(k) && !SENSITIVE.test(k) && !GENERIC.test(k))
    .slice(0, max);
}

function templates(input: StarterInput): Omit<Starter, 'id' | 'score'>[] {
  const t = input.title;
  const out: Omit<Starter, 'id' | 'score'>[] = [];
  const sibling = input.collection?.find((f) => f.title !== t);
  const related = (input.related || []).filter((f) => f.title !== t && f.title !== sibling?.title);
  const genre = genreNoun(input.genres?.[0] || '');

  if (sibling) {
    out.push({ kind: 'related', text: `How is ${t} related to ${sibling.title}?` });
  }
  if (related[0]) {
    out.push({ kind: 'compare', text: `How does ${t} compare to ${related[0].title}?` });
  }
  if (!sibling && related[1]) {
    out.push({ kind: 'related', text: `How is ${t} related to ${related[1].title}?` });
  }
  out.push({ kind: 'meaning', text: `What is the meaning behind ${t}?` });
  out.push({
    kind: 'more-like',
    text: genre ? `Pull together some ${genre} films, starting with ${t}` : `Pull together some films like ${t}`,
  });
  for (const theme of pickThemes(input.keywords)) {
    out.push({ kind: 'theme', text: `How does ${t} explore ${theme}?` });
  }
  if (input.director) {
    out.push({ kind: 'director', text: `What makes ${t} feel like a ${input.director} film?` });
  }
  const lead = input.cast?.[0];
  if (lead?.character) {
    out.push({ kind: 'cast', text: `How did ${lead.name} approach playing ${lead.character}?` });
  } else if (lead) {
    out.push({ kind: 'cast', text: `What did ${lead.name} bring to ${t}?` });
  }
  out.push({ kind: 'before', text: `What should I know before watching ${t}?` });
  out.push({ kind: 'ending', text: `Explain the ending of ${t} (spoilers)` });
  return out;
}

const slug = (s: string) => normalize(s).join('-').slice(0, 60);

/**
 * Per-film starter prompts: Reddit-grounded FAQ first, then metadata templates,
 * deduped and spread across question shapes so the first chips are never three
 * variants of the same question.
 */
export function buildStarters(input: StarterInput, limit = 10): Starter[] {
  const history = input.tapHistory || {};
  const candidates: Starter[] = [];

  (input.faq || []).forEach((q, i) => {
    const text = q.trim();
    if (!text) return;
    candidates.push({ id: `faq-${slug(text)}`, kind: 'faq', text, score: PRIOR.faq - i * 6 });
  });
  templates(input).forEach((c, i) => {
    const learned = Math.min(12, (history[c.kind] || 0) * 3);
    candidates.push({ ...c, id: `${c.kind}-${slug(c.text)}`, score: PRIOR[c.kind] + learned - i * 0.1 });
  });

  const unique: Starter[] = [];
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    if (unique.some((u) => u.id === c.id || similar(u.text, c.text, input.title))) continue;
    unique.push(c);
  }

  // One of each kind before any kind repeats, except FAQ which is allowed to lead.
  const seen = new Map<StarterKind, number>();
  const firstPass: Starter[] = [];
  const rest: Starter[] = [];
  for (const s of unique) {
    const n = seen.get(s.kind) || 0;
    const cap = s.kind === 'faq' ? 2 : 1;
    (n < cap ? firstPass : rest).push(s);
    seen.set(s.kind, n + 1);
  }
  return [...firstPass, ...rest].slice(0, limit);
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
