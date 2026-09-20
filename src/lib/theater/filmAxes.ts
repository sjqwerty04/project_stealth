import { callLlmForJSON } from '../llm';
import { loadSkill } from '../skills';
import type { KeptTheater } from './archive';
import { filmIdentity, finiteNumber, isRecord, nonEmptyString, type MediaType } from './types';

export const FILM_AXIS_NAMES = ['LOOK', 'CAMERA', 'TEMPO', 'WEATHER', 'SOUND', 'WORLD', 'SHAPE', 'FORMAT'] as const;

export type FilmAxisName = (typeof FILM_AXIS_NAMES)[number];

export const AXIS_BARS = 5;

const AXIS_SCORES = [1, 2, 3, 4, 5] as const;

export type AxisScore = (typeof AXIS_SCORES)[number];

export type FilmAxis<Name extends FilmAxisName = FilmAxisName> = {
  name: Name;
  value: string;
  score: AxisScore;
};

export type FilmAxes = readonly [
  FilmAxis<'LOOK'>,
  FilmAxis<'CAMERA'>,
  FilmAxis<'TEMPO'>,
  FilmAxis<'WEATHER'>,
  FilmAxis<'SOUND'>,
  FilmAxis<'WORLD'>,
  FilmAxis<'SHAPE'>,
  FilmAxis<'FORMAT'>,
];

export type FilmAxisRow = FilmAxis & { count: number };

export const FILM_AXES_COLLECTION = 'film_axes';

export const FILM_AXES_SCHEMA = 1;

export type FilmAxesSubject = {
  id: number;
  mediaType: MediaType;
  title: string;
  year: string;
  director: string | null;
  genres: readonly string[];
};

export type FilmAxesDoc = {
  schema: typeof FILM_AXES_SCHEMA;
  mediaType: MediaType;
  filmId: number;
  title: string;
  year: string;
  axes: FilmAxes;
  createdAt: number;
};

export function filmAxesDocId(mediaType: MediaType, filmId: number): string {
  return filmIdentity({ id: filmId, mediaType });
}

function parseScore(raw: unknown): AxisScore | null {
  return AXIS_SCORES.find((score) => score === raw) ?? null;
}

function parseAxis<Name extends FilmAxisName>(name: Name, raw: unknown): FilmAxis<Name> | null {
  if (!isRecord(raw) || raw.name !== name || !nonEmptyString(raw.value)) return null;
  const score = parseScore(raw.score);
  return score === null ? null : { name, value: raw.value.trim(), score };
}

export function parseFilmAxes(raw: unknown): FilmAxes | null {
  if (!Array.isArray(raw) || raw.length !== FILM_AXIS_NAMES.length) return null;
  const look = parseAxis('LOOK', raw[0]);
  const camera = parseAxis('CAMERA', raw[1]);
  const tempo = parseAxis('TEMPO', raw[2]);
  const weather = parseAxis('WEATHER', raw[3]);
  const sound = parseAxis('SOUND', raw[4]);
  const world = parseAxis('WORLD', raw[5]);
  const shape = parseAxis('SHAPE', raw[6]);
  const format = parseAxis('FORMAT', raw[7]);
  if (!look || !camera || !tempo || !weather || !sound || !world || !shape || !format) return null;
  return [look, camera, tempo, weather, sound, world, shape, format];
}

export function parseFilmAxesResult(raw: unknown): FilmAxes | null {
  return isRecord(raw) ? parseFilmAxes(raw.axes) : null;
}

export function filmAxesDocFrom(subject: FilmAxesSubject, axes: FilmAxes, createdAt: number): FilmAxesDoc {
  return {
    schema: FILM_AXES_SCHEMA,
    mediaType: subject.mediaType,
    filmId: subject.id,
    title: subject.title,
    year: subject.year,
    axes,
    createdAt,
  };
}

export function parseFilmAxesDoc(raw: unknown): FilmAxesDoc | null {
  if (!isRecord(raw) || raw.schema !== FILM_AXES_SCHEMA || !finiteNumber(raw.filmId)) return null;
  if (!nonEmptyString(raw.title) || typeof raw.year !== 'string') return null;
  if (raw.mediaType !== 'movie' && raw.mediaType !== 'tv') return null;
  const axes = parseFilmAxes(raw.axes);
  if (!axes || !finiteNumber(raw.createdAt)) return null;
  return {
    schema: FILM_AXES_SCHEMA,
    mediaType: raw.mediaType,
    filmId: raw.filmId,
    title: raw.title,
    year: raw.year,
    axes,
    createdAt: raw.createdAt,
  };
}

export function parseCachedFilmAxes(filmKey: string, raw: unknown): FilmAxes | null {
  const cached = parseFilmAxesDoc(raw);
  if (!cached || filmAxesDocId(cached.mediaType, cached.filmId) !== filmKey) return null;
  return cached.axes;
}

export const FILM_AXES_MAX_TOKENS = 500;

const NO_REPAIR_RETRIES = 0;

export type FilmAxesLlm = (prompt: string, system: string) => Promise<unknown>;

export const filmAxesLlm: FilmAxesLlm = (prompt, system) =>
  callLlmForJSON<unknown>(prompt, system, NO_REPAIR_RETRIES, {
    reasoningEffort: 'low',
    maxTokens: FILM_AXES_MAX_TOKENS,
  });

export function buildFilmAxesPrompt(subject: FilmAxesSubject): string {
  const facts = [`${subject.title} (${subject.year})`];
  if (subject.director) facts.push(`dir. ${subject.director}`);
  if (subject.genres.length) facts.push(subject.genres.join(', '));
  return [
    '<film>',
    facts.join(' | '),
    '</film>',
    '<task>',
    `Read this film on all ${FILM_AXIS_NAMES.length} axes in the required order.`,
    'Return only the JSON object described in your instructions.',
    '</task>',
  ].join('\n');
}

export async function generateFilmAxes(subject: FilmAxesSubject, llm: FilmAxesLlm): Promise<FilmAxes | null> {
  return parseFilmAxesResult(await llm(buildFilmAxesPrompt(subject), loadSkill('film-axes')));
}

export type FilmAxesSource = {
  readCache: (filmKey: string) => Promise<FilmAxes | null>;
  generate: (subject: FilmAxesSubject) => Promise<FilmAxes | null>;
  writeCache: (filmKey: string, doc: FilmAxesDoc) => Promise<void>;
  now: () => number;
};

export type FilmAxesResult = { filmKey: string; axes: FilmAxes | null };

export async function loadFilmAxes(subject: FilmAxesSubject, source: FilmAxesSource): Promise<FilmAxesResult> {
  const filmKey = filmAxesDocId(subject.mediaType, subject.id);
  const cached = await source.readCache(filmKey);
  if (cached) return { filmKey, axes: cached };
  const axes = await source.generate(subject);
  if (!axes) return { filmKey, axes: null };
  await source.writeCache(filmKey, filmAxesDocFrom(subject, axes, source.now())).catch(() => {});
  return { filmKey, axes };
}

const COUNT_STOPWORDS = new Set(['and', 'the', 'that', 'this', 'with', 'from', 'for', 'its', 'into', 'over', 'you', 'who', 'are', 'was', 'his', 'her', 'them', 'they', 'their', 'all', 'one', 'two', 'out']);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !COUNT_STOPWORDS.has(word));
}

export function theaterFilmMatchesAxisValue(axisValue: string, theaterEvidence: string): boolean {
  const evidence = new Set(significantWords(theaterEvidence));
  return significantWords(axisValue).some((word) => evidence.has(word));
}

export function theaterEvidenceByFilm(theaters: readonly KeptTheater[]): string[] {
  const evidence = new Map<string, string>();
  for (const theater of theaters) {
    const shared = [theater.title, ...(theater.facets ?? [])].join(' ');
    for (const film of theater.films) {
      const key = filmIdentity(film);
      evidence.set(key, `${evidence.get(key) ?? ''} ${shared} ${film.reason}`);
    }
  }
  return [...evidence.values()];
}

export function deriveUserAxisRows(axes: FilmAxes, theaters: readonly KeptTheater[]): FilmAxisRow[] {
  const evidence = theaterEvidenceByFilm(theaters);
  return axes.map((axis) => ({
    ...axis,
    count: evidence.filter((text) => theaterFilmMatchesAxisValue(axis.value, text)).length,
  }));
}
