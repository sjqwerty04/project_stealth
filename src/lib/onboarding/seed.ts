import type { Axis } from '../taste/types';
import {
  initialOnboardingState,
  onboardingReducer,
  type FilmPick,
  type OnboardingState,
  type Step,
} from './state';

export const MARKETING_SEED_KEY = 'selects.marketingSeed';

export type SeedFilm = { id: number; title: string; year: number };

export type MarketingAxis = 'writing' | 'room' | 'both';

export type MarketingSeed = {
  v: 1;
  name: string;
  positive: SeedFilm[];
  negative: SeedFilm[];
  axes: MarketingAxis[];
  hour: number;
  letterboxd: string;
};

const AXIS_TO_APP: Record<MarketingAxis, Axis> = {
  writing: 'story',
  room: 'visual',
  both: 'mood',
};

const MARKETING_AXES: readonly MarketingAxis[] = ['writing', 'room', 'both'];

type SeedStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStore(): SeedStore {
  return sessionStorage;
}

export function encodeSeedParam(seed: MarketingSeed): string {
  const bytes = new TextEncoder().encode(JSON.stringify(seed));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string | null {
  if (!/^[-A-Za-z0-9_]+$/.test(value) || value.length > 6000) return null;
  try {
    const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isSeedFilm(value: unknown): value is SeedFilm {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'number' &&
    Number.isInteger(row.id) &&
    row.id > 0 &&
    typeof row.title === 'string' &&
    row.title.trim().length > 0 &&
    row.title.length <= 200 &&
    typeof row.year === 'number' &&
    Number.isInteger(row.year) &&
    row.year >= 1888 &&
    row.year <= 2100
  );
}

function cleanFilm(film: SeedFilm): SeedFilm {
  return { id: film.id, title: film.title.trim(), year: film.year };
}

export function parseMarketingSeed(param: string | null | undefined): MarketingSeed | null {
  if (!param) return null;
  const json = decodeBase64Url(param);
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.v !== 1) return null;
  if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 80) return null;
  if (!Array.isArray(row.positive) || row.positive.length < 1 || row.positive.length > 12 || !row.positive.every(isSeedFilm)) {
    return null;
  }
  if (!Array.isArray(row.negative) || row.negative.length > 12 || !row.negative.every(isSeedFilm)) return null;
  if (!Array.isArray(row.axes) || row.axes.length > 3 || row.axes.some((axis) => !MARKETING_AXES.includes(axis as MarketingAxis))) {
    return null;
  }
  if (typeof row.hour !== 'number' || !Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23) return null;
  if (typeof row.letterboxd !== 'string' || row.letterboxd.length > 40) return null;
  const letterboxd = row.letterboxd.trim();
  if (letterboxd && !/^[A-Za-z0-9_-]+$/.test(letterboxd)) return null;
  const axes: MarketingAxis[] = [];
  for (const axis of row.axes as MarketingAxis[]) {
    if (!axes.includes(axis)) axes.push(axis);
  }
  return {
    v: 1,
    name: row.name.trim(),
    positive: row.positive.map(cleanFilm),
    negative: row.negative.map(cleanFilm),
    axes,
    hour: row.hour,
    letterboxd,
  };
}

export function rememberSeedParam(param: string | null, storage: SeedStore = browserStore()): void {
  if (param == null) return;
  if (parseMarketingSeed(param)) storage.setItem(MARKETING_SEED_KEY, param);
  else storage.removeItem(MARKETING_SEED_KEY);
}

export function readRememberedSeed(storage: SeedStore = browserStore()): MarketingSeed | null {
  return parseMarketingSeed(storage.getItem(MARKETING_SEED_KEY));
}

export function forgetSeed(storage: SeedStore = browserStore()): void {
  storage.removeItem(MARKETING_SEED_KEY);
}

export function profileAlreadyFinished(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as { onboardingCompleted?: unknown }).onboardingCompleted === true);
}

export function axesFromSeed(axes: readonly MarketingAxis[]): Axis[] {
  const out: Axis[] = [];
  for (const axis of axes) {
    const mapped = AXIS_TO_APP[axis];
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export function filmsFromSeed(films: readonly SeedFilm[]): FilmPick[] {
  return films.map((film) => ({
    id: film.id,
    title: film.title,
    year: String(film.year),
    posterPath: null,
  }));
}

export function seedFilmDoc(film: SeedFilm): { id: number; title: string; year: number } {
  return { id: film.id, title: film.title, year: film.year };
}

export function stepForSeed(seed: MarketingSeed): Step {
  return seed.axes.length > 0 ? 'import' : 'neutral';
}

export function stateFromSeed(seed: MarketingSeed): OnboardingState {
  return onboardingReducer(initialOnboardingState, {
    type: 'applySeed',
    positive: filmsFromSeed(seed.positive),
    negative: filmsFromSeed(seed.negative),
    axes: axesFromSeed(seed.axes),
    step: stepForSeed(seed),
  });
}
