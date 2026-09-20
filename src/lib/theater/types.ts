export type MediaType = 'movie' | 'tv';

export type TheaterFilm = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  director: string | null;
  mediaType: MediaType;
};

export type QueryMode = 'standard' | 'ai-curated';

export type TheaterSignal =
  | { kind: 'query'; text: string; mode: QueryMode; at: number }
  | { kind: 'detail_view'; film: TheaterFilm; at: number }
  | { kind: 'dwell'; filmId: number; ms: number; engaged: boolean };

export type TheaterPick = { title: string; year: string; reason: string };

export type TheaterDraft = {
  title: string;
  facets: [string, string];
  insight: string;
  picks: TheaterPick[];
};

export type Swatches = [string, string, string, string];

export type TheaterLineupItem = TheaterFilm & { reason: string };

export const LINEUP_SIZE = 8;

export type Theater = {
  title: string;
  facets: [string, string];
  insight: string;
  swatches: Swatches;
  sourceFilmIds: number[];
  lineup: TheaterLineupItem[];
};

export type TheaterSession =
  | { status: 'idle' }
  | { status: 'collecting'; signals: TheaterSignal[]; lastActiveAt: number; failedFingerprint: string | null }
  | { status: 'inferring'; signals: TheaterSignal[]; revision: number; fingerprint: string; lastActiveAt: number }
  | { status: 'showing'; theater: Theater; signals: TheaterSignal[]; fingerprint: string; lastActiveAt: number }
  | { status: 'kept'; theater: Theater; keptId: string }
  | { status: 'closed'; reason: 'dismissed' | 'idle' | 'signed_out' };

export type TheaterEvent =
  | { type: 'signal'; signal: TheaterSignal }
  | { type: 'infer_started'; revision: number; now: number }
  | { type: 'infer_succeeded'; revision: number; theater: Theater }
  | { type: 'infer_failed'; revision: number }
  | { type: 'keep' }
  | { type: 'dismiss' }
  | { type: 'expire'; now: number }
  | { type: 'sign_out' };

export const THEATER_DOC_SCHEMA = 1;

export type TheaterDoc = {
  schema: typeof THEATER_DOC_SCHEMA;
  title: string;
  facets: [string, string] | null;
  insight: string;
  swatches: Swatches;
  sourceSignals: TheaterSignal[];
  sourceFilmIds: number[];
  lineup: TheaterLineupItem[];
  keptAt: number;
};

export const FALLBACK_SWATCHES: Swatches = ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'];

export function filmIdentity(film: Pick<TheaterFilm, 'id' | 'mediaType'>): string {
  return `${film.mediaType}:${film.id}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Normalize a stored instant to epoch milliseconds. Firestore hands back `{ seconds }`, older writes hand back a number. */
export function timestampMillis(value: unknown): number | null {
  if (finiteNumber(value)) return value;
  if (isRecord(value) && finiteNumber(value.seconds)) return value.seconds * 1000;
  return null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function parseFacets(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b]: unknown[] = value;
  return nonEmptyString(a) && nonEmptyString(b) ? [a.trim(), b.trim()] : null;
}

export function parseSwatches(value: unknown): Swatches | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [a, b, c, d]: unknown[] = value;
  return isHexColor(a) && isHexColor(b) && isHexColor(c) && isHexColor(d) ? [a, b, c, d] : null;
}

export function parseTheaterFilm(raw: unknown): TheaterFilm | null {
  if (!isRecord(raw) || !finiteNumber(raw.id) || !nonEmptyString(raw.title) || typeof raw.year !== 'string') return null;
  if (!nullableString(raw.posterPath) || !nullableString(raw.backdropPath)) return null;
  if (!stringList(raw.genres) || !nullableString(raw.director)) return null;
  if (raw.mediaType !== 'movie' && raw.mediaType !== 'tv') return null;
  return {
    id: raw.id,
    title: raw.title,
    year: raw.year,
    posterPath: raw.posterPath,
    backdropPath: raw.backdropPath,
    genres: raw.genres,
    director: raw.director,
    mediaType: raw.mediaType,
  };
}

export function parseTheaterSignal(raw: unknown): TheaterSignal | null {
  if (!isRecord(raw)) return null;
  switch (raw.kind) {
    case 'query': {
      const mode = raw.mode === 'ai-curated' ? 'ai-curated' : raw.mode === 'standard' ? 'standard' : null;
      if (typeof raw.text !== 'string' || !mode || !finiteNumber(raw.at)) return null;
      return { kind: 'query', text: raw.text, mode, at: raw.at };
    }
    case 'detail_view': {
      const film = parseTheaterFilm(raw.film);
      return film && finiteNumber(raw.at) ? { kind: 'detail_view', film, at: raw.at } : null;
    }
    case 'dwell':
      if (!finiteNumber(raw.filmId) || !finiteNumber(raw.ms) || typeof raw.engaged !== 'boolean') return null;
      return { kind: 'dwell', filmId: raw.filmId, ms: raw.ms, engaged: raw.engaged };
    default:
      return null;
  }
}

function parseLineupItem(raw: unknown): TheaterLineupItem | null {
  const film = parseTheaterFilm(raw);
  if (!film || !isRecord(raw) || typeof raw.reason !== 'string') return null;
  return { ...film, reason: raw.reason };
}

export function parseTheater(raw: unknown): Theater | null {
  if (!isRecord(raw)) return null;
  const facets = parseFacets(raw.facets);
  const swatches = parseSwatches(raw.swatches);
  if (!nonEmptyString(raw.title) || !facets || !nonEmptyString(raw.insight) || !swatches) return null;
  if (!Array.isArray(raw.sourceFilmIds) || !raw.sourceFilmIds.every(finiteNumber)) return null;
  if (!Array.isArray(raw.lineup) || raw.lineup.length !== LINEUP_SIZE) return null;
  const lineup: TheaterLineupItem[] = [];
  for (const item of raw.lineup) {
    const parsed = parseLineupItem(item);
    if (!parsed) return null;
    lineup.push(parsed);
  }
  return {
    title: raw.title,
    facets,
    insight: raw.insight,
    swatches,
    sourceFilmIds: raw.sourceFilmIds,
    lineup,
  };
}
