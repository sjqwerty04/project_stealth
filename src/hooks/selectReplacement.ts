import { hydratedTitleMatchesPick } from '../lib/taste/selectPickCoherence';
import { mergeSelectExclusions, type SelectExclusion } from './selectExclusions';

export type { SelectExclusion } from './selectExclusions';

export type SelectSlotId = 0 | 1 | 2;

export type VisibleSelect = {
  movieId: number;
  title: string;
};

type ReplacementOptions<TPick extends VisibleSelect, TRawPick, TContext> = {
  slotId: SelectSlotId;
  picks: readonly TPick[];
  extraExcluded?: readonly SelectExclusion[];
  feedbackSaved: boolean;
  saveFeedback: () => Promise<void>;
  onFeedbackSaved: () => void;
  readContext: () => Promise<TContext>;
  requestPicks: (context: TContext, excluded: SelectExclusion[]) => Promise<TRawPick[]>;
  hydratePick: (pick: TRawPick) => Promise<TPick | null>;
  persistPicks: (picks: TPick[]) => Promise<void>;
};

function normalizedTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

function rawTitle(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || !('title' in raw)) return '';
  return typeof raw.title === 'string' ? raw.title : '';
}

export function replacePickAtSlot<T>(picks: readonly T[], slotId: SelectSlotId, replacement: T): T[] {
  return picks.map((pick, index) => (index === slotId ? replacement : pick));
}

export async function executeSelectReplacement<
  TPick extends VisibleSelect,
  TRawPick,
  TContext,
>({
  slotId,
  picks,
  extraExcluded = [],
  feedbackSaved,
  saveFeedback,
  onFeedbackSaved,
  readContext,
  requestPicks,
  hydratePick,
  persistPicks,
}: ReplacementOptions<TPick, TRawPick, TContext>): Promise<TPick[]> {
  if (!picks[slotId]) throw new Error('Select slot is unavailable');

  if (!feedbackSaved) {
    await saveFeedback();
    onFeedbackSaved();
  }

  const excluded = mergeSelectExclusions([
    ...picks.map((pick) => ({ movieId: pick.movieId, title: pick.title })),
    ...extraExcluded,
  ]);
  const context = await readContext();
  const candidates = await requestPicks(context, excluded);
  const excludedIds = new Set(excluded.map((row) => row.id));
  const excludedTitles = new Set(excluded.map((pick) => normalizedTitle(pick.title)));

  for (const candidate of candidates) {
    const hydrated = await hydratePick(candidate);
    if (!hydrated) continue;
    const recommended = rawTitle(candidate) || hydrated.title;
    if (!hydratedTitleMatchesPick(recommended, hydrated.title)) continue;
    if (excludedIds.has(String(hydrated.movieId)) || excludedTitles.has(normalizedTitle(hydrated.title))) continue;

    const next = replacePickAtSlot(picks, slotId, hydrated);
    await persistPicks(next);
    return next;
  }

  throw new Error('No new select available');
}
