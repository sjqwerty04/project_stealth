import { hydratedTitleMatchesPick } from '../lib/taste/selectPickCoherence';
import { mergeSelectExclusions, pickIsExcluded, type SelectExclusion } from './selectExclusions';

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
  requestPicks: (context: TContext, excluded: SelectExclusion[], count: 1 | 3) => Promise<TRawPick[]>;
  hydratePick: (pick: TRawPick) => Promise<TPick | null>;
  persistPicks: (picks: TPick[]) => Promise<void>;
};

function rawTitle(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || !('title' in raw)) return '';
  return typeof raw.title === 'string' ? raw.title : '';
}

export function replacingBlocksGenerate(
  replacements: Partial<Record<string, { phase?: string } | null | undefined>>,
): boolean {
  return Object.values(replacements).some((row) => row && (row.phase === 'saving' || row.phase === 'replacing'));
}

export function replacePickAtSlot<T>(picks: readonly T[], slotId: SelectSlotId, replacement: T): T[] {
  return picks.map((pick, index) => (index === slotId ? replacement : pick));
}

async function firstValidReplacement<TPick extends VisibleSelect, TRawPick>(
  picks: readonly TPick[],
  slotId: SelectSlotId,
  candidates: TRawPick[],
  excluded: SelectExclusion[],
  hydratePick: (pick: TRawPick) => Promise<TPick | null>,
  persistPicks: (picks: TPick[]) => Promise<void>,
): Promise<TPick[] | null> {
  for (const candidate of candidates) {
    const hydrated = await hydratePick(candidate);
    if (!hydrated) continue;
    const recommended = rawTitle(candidate) || hydrated.title;
    if (!hydratedTitleMatchesPick(recommended, hydrated.title)) continue;
    if (pickIsExcluded(hydrated, excluded)) continue;
    const next = replacePickAtSlot(picks, slotId, hydrated);
    await persistPicks(next);
    return next;
  }
  return null;
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
  const first = await firstValidReplacement(
    picks,
    slotId,
    await requestPicks(context, excluded, 1),
    excluded,
    hydratePick,
    persistPicks,
  );
  if (first) return first;
  const more = await firstValidReplacement(
    picks,
    slotId,
    await requestPicks(context, excluded, 3),
    excluded,
    hydratePick,
    persistPicks,
  );
  if (more) return more;
  throw new Error('No new select available');
}
