import type { LibraryFilm } from '../library/types';
import type { Facet, TasteStats } from './profile';
import { FACETS } from './profile';
import type { FilmPick, ImportSourceId } from './state';
import { fnv1aHex } from './graph';
import { oklabCentroid, samplePosterColours } from './colour';
import { posterUrl } from '../fallbackCatalog';

export type StatsFilm = Pick<
  LibraryFilm,
  'movieId' | 'title' | 'year' | 'poster' | 'stars' | 'watchCount' | 'watched' | 'firstWatchedAt'
> & { runtime?: number; genres?: string[]; people?: string[] };

/** One calendar_logs row reduced to what the stats need. `time` is 'HH:mm' when the log carried one. */
export type StatsNight = { date: string; time?: string | null; movieId?: number };

export type StatsPicks = {
  positive: FilmPick[];
  negative: FilmPick[];
  axes: string[];
  sources: ImportSourceId[];
};

export type StatsInput = StatsPicks & {
  films: StatsFilm[];
  nights: StatsNight[];
  uid: string;
};

const DEFAULT_RUNTIME_MIN = 105;
const LATE_NIGHT_HOUR = 22;
const SHAPE_FLOOR = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

function topN(counts: Map<string, number>, n: number): [string, number][] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function tally(values: Iterable<string>, counts: Map<string, number>) {
  for (const v of values) {
    const key = v.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}

function decadeOf(year: LibraryFilm['year']): string | null {
  const n = typeof year === 'number' ? year : parseInt(String(year ?? ''), 10);
  if (!Number.isFinite(n) || n < 1880 || n > 2100) return null;
  return String(Math.floor(n / 10) * 10);
}

function hourOf(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return h >= 0 && h < 24 ? h : null;
}

export function computeFacetWeights(picks: Pick<StatsPicks, 'positive' | 'negative' | 'axes'>): Record<Facet, number> {
  const w = Object.fromEntries(FACETS.map((f) => [f, 1])) as Record<Facet, number>;
  for (const axis of picks.axes) {
    if (axis === 'story') {
      w.shape += 0.5;
      w.weather += 0.5;
    } else if (axis === 'visual') {
      w.look += 0.5;
      w.format += 0.5;
    } else if (axis === 'mood') {
      w.weather += 0.5;
      w.tempo += 0.5;
    }
  }
  for (let i = 0; i < picks.positive.length; i++) {
    w.look += 0.25;
    w.world += 0.25;
  }
  for (let i = 0; i < picks.negative.length; i++) {
    w.shape = Math.max(SHAPE_FLOOR, w.shape - 0.15);
  }
  for (const f of FACETS) w[f] = round2(w[f]);
  return w;
}

export function graphSeedFor(uid: string, positive: FilmPick[], negative: FilmPick[], facetWeights: Record<Facet, number>): string {
  const ids = (list: FilmPick[]) => [...list.map((p) => p.id)].sort((a, b) => a - b).join(',');
  return fnv1aHex(`${uid}|${ids(positive)}|${ids(negative)}|${JSON.stringify(facetWeights)}`);
}

export function computeTasteStats(input: StatsInput, colourHex: string, postersSampled: number): TasteStats {
  const watched = input.films.filter((f) => f.watched);
  const hours = watched.reduce((sum, f) => sum + (f.runtime ?? DEFAULT_RUNTIME_MIN), 0) / 60;

  const timed = input.nights.map((n) => hourOf(n.time)).filter((h): h is number => h !== null);
  const lateNightPct = timed.length === 0 ? null : round2(pct(timed.filter((h) => h >= LATE_NIGHT_HOUR).length, timed.length));

  const fiveStars = input.films.filter((f) => f.stars === 5);
  const rewatchOfFiveStarPct =
    fiveStars.length === 0 ? null : round2(pct(fiveStars.filter((f) => (f.watchCount ?? 0) >= 2).length, fiveStars.length));

  const decades = new Map<string, number>();
  const people = new Map<string, number>();
  const genres = new Map<string, number>();
  for (const f of input.films) {
    const d = decadeOf(f.year);
    if (d) tally([d], decades);
    if (f.people) tally(f.people, people);
    if (f.genres) tally(f.genres, genres);
  }

  const facetWeights = computeFacetWeights(input);

  return {
    filmsRead: watched.length,
    nights: input.nights.length,
    hours: Math.round(hours),
    lateNightPct,
    rewatchOfFiveStarPct,
    fiveStarCount: fiveStars.length,
    topDecades: topN(decades, 3),
    topPeople: topN(people, 3),
    topGenres: topN(genres, 3),
    facetWeights,
    colourHex,
    postersSampled,
    graphSeed: graphSeedFor(input.uid, input.positive, input.negative, facetWeights),
    sources: [...input.sources],
    positive: input.positive.map((p) => p.title),
    negative: input.negative.map((p) => p.title),
    axes: [...input.axes],
  };
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
}

/** Calendar rows store a date string; a clock only exists when the row carried one or the date is a full ISO stamp. */
function nightTime(data: Record<string, unknown>): string | null {
  const explicit = asString(data.time);
  if (explicit && hourOf(explicit) !== null) return explicit;
  const date = asString(data.date);
  const m = date ? /T(\d{2}:\d{2})/.exec(date) : null;
  return m ? m[1] : null;
}

export function filmFromDoc(data: Record<string, unknown>, fallbackId: string): StatsFilm {
  const movieId = asNumber(data.movieId) ?? parseInt(fallbackId, 10);
  return {
    movieId: Number.isFinite(movieId) ? movieId : 0,
    title: asString(data.title) ?? '',
    year: asString(data.year) ?? asNumber(data.year),
    poster: asString(data.poster) ?? '',
    stars: asNumber(data.stars) ?? null,
    watchCount: asNumber(data.watchCount) ?? 0,
    watched: data.watched === true,
    firstWatchedAt: asString(data.firstWatchedAt) ?? null,
    runtime: asNumber(data.runtime),
    genres: asStringArray(data.genres),
    people: asStringArray(data.people),
  };
}

export function nightFromDoc(data: Record<string, unknown>): StatsNight | null {
  const date = asString(data.date);
  if (!date) return null;
  if (data.status === 'planned') return null;
  return { date, time: nightTime(data), movieId: asNumber(data.movieId) };
}

export async function loadStatsInput(uid: string, picks: StatsPicks): Promise<StatsInput> {
  // Firebase is loaded on demand so the pure stats maths stays importable without a browser or app bootstrap.
  const [{ collection, getDocs }, { db }] = await Promise.all([import('firebase/firestore'), import('../firebase')]);
  const [filmSnap, nightSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'films')),
    getDocs(collection(db, 'users', uid, 'calendar_logs')),
  ]);
  const films = filmSnap.docs.map((d) => filmFromDoc(d.data() as Record<string, unknown>, d.id));
  const nights = nightSnap.docs
    .map((d) => nightFromDoc(d.data() as Record<string, unknown>))
    .filter((n): n is StatsNight => n !== null);
  return { ...picks, films, nights, uid };
}

export function posterUrlsFor(input: StatsInput): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const f of input.films) {
    if (!f.watched || !f.poster) continue;
    const url = f.poster.startsWith('/') ? posterUrl(f.poster) : f.poster;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export async function buildTasteStats(
  uid: string,
  picks: StatsPicks,
  onProgress?: (sampled: number, total: number) => void,
): Promise<TasteStats> {
  const input = await loadStatsInput(uid, picks);
  const urls = posterUrlsFor(input);
  const colours = await samplePosterColours(urls, { onProgress });
  return computeTasteStats(input, oklabCentroid(colours), colours.length);
}
