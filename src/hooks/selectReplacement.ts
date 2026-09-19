export type SelectSlotId = 0 | 1 | 2;

export type VisibleSelect = {
  movieId: number;
  title: string;
};

export type SelectExclusion = {
  id: string;
  title: string;
};

type ReplacementOptions<TPick extends VisibleSelect, TRawPick, TContext> = {
  slotId: SelectSlotId;
  picks: readonly TPick[];
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

  const excluded = picks.map((pick) => ({
    id: String(pick.movieId),
    title: pick.title,
  }));
  const context = await readContext();
  const candidates = await requestPicks(context, excluded);
  const visibleIds = new Set(picks.map((pick) => pick.movieId));
  const visibleTitles = new Set(picks.map((pick) => normalizedTitle(pick.title)));

  for (const candidate of candidates) {
    const hydrated = await hydratePick(candidate);
    if (!hydrated) continue;
    if (visibleIds.has(hydrated.movieId) || visibleTitles.has(normalizedTitle(hydrated.title))) continue;

    const next = replacePickAtSlot(picks, slotId, hydrated);
    await persistPicks(next);
    return next;
  }

  throw new Error('No new select available');
}
