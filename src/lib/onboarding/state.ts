import type { Axis } from '../taste/types';
import type { ImportSourceId, SelectsProfile, TasteStats } from './profile';

export type { ImportSourceId };

export type Step =
  | 'splash'
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'import'
  | 'reading'
  | 'negativeProfile'
  | 'insights';

export const STEP_ORDER: readonly Step[] = [
  'splash',
  'positive',
  'negative',
  'neutral',
  'import',
  'reading',
  'negativeProfile',
  'insights',
];

export type FilmPick = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  genreIds?: number[];
};

export const IMPORT_SOURCES: readonly ImportSourceId[] = ['letterboxd', 'imdb', 'notes', 'images'];

export type ImportSourceState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; films: number; nights: number }
  | { status: 'error'; message: string };

export const PICK_LIMIT: Record<'positive' | 'negative', number> = { positive: 3, negative: 2 };

export type OnboardingState = {
  step: Step;
  positive: FilmPick[];
  negative: FilmPick[];
  axes: Axis[];
  imports: Record<ImportSourceId, ImportSourceState>;
  stats: TasteStats | null;
  profile: SelectsProfile | null;
};

export type OnboardingAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; step: Step }
  | { type: 'togglePick'; wall: 'positive' | 'negative'; film: FilmPick }
  | { type: 'toggleAxis'; axis: Axis }
  | { type: 'importStarted'; source: ImportSourceId }
  | { type: 'importDone'; source: ImportSourceId; films: number; nights: number }
  | { type: 'importFailed'; source: ImportSourceId; message: string }
  | { type: 'importReset'; source: ImportSourceId }
  | { type: 'statsReady'; stats: TasteStats }
  | { type: 'profileReady'; profile: SelectsProfile | null };

export const initialOnboardingState: OnboardingState = {
  step: 'splash',
  positive: [],
  negative: [],
  axes: [],
  imports: { letterboxd: { status: 'idle' }, imdb: { status: 'idle' }, notes: { status: 'idle' }, images: { status: 'idle' } },
  stats: null,
  profile: null,
};

/** The one place that knows which step may advance. */
export function canAdvance(state: OnboardingState): boolean {
  switch (state.step) {
    case 'positive':
      return state.positive.length >= 1;
    case 'reading':
      return state.stats !== null;
    default:
      return true;
  }
}

export function filmsRead(state: OnboardingState): number {
  return Object.values(state.imports).reduce((n, s) => (s.status === 'done' ? n + s.films : n), 0);
}

export function anyImportRunning(state: OnboardingState): boolean {
  return Object.values(state.imports).some((s) => s.status === 'running');
}

export function anyImportDone(state: OnboardingState): boolean {
  return Object.values(state.imports).some((s) => s.status === 'done');
}

function togglePick(list: FilmPick[], film: FilmPick, limit: number): FilmPick[] {
  if (list.some((f) => f.id === film.id)) return list.filter((f) => f.id !== film.id);
  if (list.length >= limit) return list;
  return [...list, film];
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'next': {
      if (!canAdvance(state)) return state;
      const i = STEP_ORDER.indexOf(state.step);
      const step = STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)];
      return step === state.step ? state : { ...state, step };
    }
    case 'back': {
      const i = STEP_ORDER.indexOf(state.step);
      if (i <= 1) return state;
      return { ...state, step: STEP_ORDER[i - 1] };
    }
    case 'goto':
      return state.step === action.step ? state : { ...state, step: action.step };
    case 'togglePick': {
      const next = togglePick(state[action.wall], action.film, PICK_LIMIT[action.wall]);
      return next === state[action.wall] ? state : { ...state, [action.wall]: next };
    }
    case 'toggleAxis': {
      const has = state.axes.includes(action.axis);
      return { ...state, axes: has ? state.axes.filter((a) => a !== action.axis) : [...state.axes, action.axis] };
    }
    case 'importStarted':
      return { ...state, imports: { ...state.imports, [action.source]: { status: 'running' } } };
    case 'importDone':
      return {
        ...state,
        imports: { ...state.imports, [action.source]: { status: 'done', films: action.films, nights: action.nights } },
      };
    case 'importFailed':
      return { ...state, imports: { ...state.imports, [action.source]: { status: 'error', message: action.message } } };
    case 'importReset':
      return { ...state, imports: { ...state.imports, [action.source]: { status: 'idle' } } };
    case 'statsReady':
      return { ...state, stats: action.stats };
    case 'profileReady':
      return { ...state, profile: action.profile };
  }
}
