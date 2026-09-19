import { callLlmForJSON } from '../llm';
import { loadSkill } from '../skills';
import { hydratedTitleMatchesPick } from '../taste/selectPickCoherence';
import { filmsOf, queriesOf } from './gate';
import {
  FALLBACK_SWATCHES,
  filmIdentity,
  isHexColor,
  isRecord,
  LINEUP_SIZE,
  nonEmptyString,
  parseFacets,
  type Swatches,
  type Theater,
  type TheaterDraft,
  type TheaterFilm,
  type TheaterLineupItem,
  type TheaterPick,
  type TheaterSignal,
} from './types';

export type TheaterLlm = (prompt: string, system: string) => Promise<unknown>;

export type InferDeps = {
  llm: TheaterLlm;
  searchFilm: (pick: TheaterPick) => Promise<TheaterFilm | null>;
  posterColors?: (films: TheaterFilm[]) => Promise<string[]>;
};

export const THEATER_MAX_TOKENS = 700;
const NO_REPAIR_RETRIES = 0;

export const theaterLlm: TheaterLlm = (prompt, system) =>
  callLlmForJSON<unknown>(prompt, system, NO_REPAIR_RETRIES, { reasoningEffort: 'low', maxTokens: THEATER_MAX_TOKENS });

function describeFilm(film: TheaterFilm, stayed: boolean): string {
  const parts = [`${film.title} (${film.year})`];
  if (film.director) parts.push(`dir. ${film.director}`);
  if (film.genres.length) parts.push(film.genres.join(', '));
  if (stayed) parts.push('stayed with it');
  return `- ${parts.join(' | ')}`;
}

export function buildTheaterPrompt(signals: readonly TheaterSignal[]): string {
  const stayed = new Set(signals.flatMap((s) => (s.kind === 'dwell' && s.engaged ? [s.filmId] : [])));
  const queries = queriesOf(signals).map(
    (q) => `- "${q.text.trim()}"${q.mode === 'ai-curated' ? ' (written in their own words)' : ''}`,
  );
  const films = filmsOf(signals).map((f) => describeFilm(f, stayed.has(f.id)));
  return [
    '<evidence>',
    'Searches this person committed to:',
    ...(queries.length ? queries : ['- none']),
    'Films this person opened:',
    ...(films.length ? films : ['- none']),
    '</evidence>',
    '<task>',
    `Name the Theater this trail is building and program exactly ${LINEUP_SIZE} films for it.`,
    'Return only the JSON object described in your instructions.',
    '</task>',
  ].join('\n');
}

function parsePick(raw: unknown): TheaterPick | null {
  if (!isRecord(raw) || !nonEmptyString(raw.title) || !nonEmptyString(raw.reason)) return null;
  const year = typeof raw.year === 'number' ? String(raw.year) : raw.year;
  if (!nonEmptyString(year)) return null;
  return { title: raw.title.trim(), year: year.trim(), reason: raw.reason.trim() };
}

export function parseTheaterDraft(raw: unknown): TheaterDraft | null {
  if (!isRecord(raw)) return null;
  const facets = parseFacets(raw.facets);
  if (!nonEmptyString(raw.title) || !facets || !nonEmptyString(raw.insight)) return null;
  if (!Array.isArray(raw.picks) || raw.picks.length !== LINEUP_SIZE) return null;
  const picks: TheaterPick[] = [];
  for (const item of raw.picks) {
    const pick = parsePick(item);
    if (!pick) return null;
    picks.push(pick);
  }
  return { title: raw.title.trim(), facets, insight: raw.insight.trim(), picks };
}

export function swatchesFrom(colors: readonly string[]): Swatches {
  const valid = colors.filter(isHexColor);
  const [a, b, c, d] = FALLBACK_SWATCHES.map((fallback, i) => valid[i] ?? fallback);
  return [a, b, c, d];
}

async function hydrateLineup(
  picks: readonly TheaterPick[],
  sources: readonly TheaterFilm[],
  searchFilm: InferDeps['searchFilm'],
): Promise<TheaterLineupItem[]> {
  const found = await Promise.all(picks.map((pick) => searchFilm(pick).catch(() => null)));
  const seen = new Set(sources.map(filmIdentity));
  const lineup: TheaterLineupItem[] = [];
  picks.forEach((pick, i) => {
    const film = found[i];
    if (!film || !hydratedTitleMatchesPick(pick.title, film.title)) return;
    const identity = filmIdentity(film);
    if (seen.has(identity)) return;
    seen.add(identity);
    lineup.push({ ...film, reason: pick.reason });
  });
  return lineup;
}

export async function inferTheater(signals: readonly TheaterSignal[], deps: InferDeps): Promise<Theater | null> {
  const draft = parseTheaterDraft(await deps.llm(buildTheaterPrompt(signals), loadSkill('theater-infer')));
  if (!draft) return null;
  const sources = filmsOf(signals);
  const lineup = await hydrateLineup(draft.picks, sources, deps.searchFilm);
  if (lineup.length !== LINEUP_SIZE) return null;
  const colors = deps.posterColors ? await deps.posterColors(lineup) : [];
  return {
    title: draft.title,
    facets: draft.facets,
    insight: draft.insight,
    swatches: swatchesFrom(colors),
    sourceFilmIds: sources.map((f) => f.id),
    lineup,
  };
}
