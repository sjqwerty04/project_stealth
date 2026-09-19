import { hydratedTitleMatchesPick } from '../lib/taste/selectPickCoherence';

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
  getPicks?: () => readonly TPick[];
  feedbackSaved: boolean;
  saveFeedback: () => Promise<void>;
  onFeedbackSaved: () => void;
  readContext: () => Promise<TContext>;
  requestPicks: (context: TContext, excluded: SelectExclusion[]) => Promise<TRawPick[]>;
  hydratePick: (pick: TRawPick) => Promise<TPick | null>;
  persistPicks: (picks: TPick[]) => Promise<void | boolean>;
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

export function replacementConflictsWithSiblings<T extends VisibleSelect>(
  picks: readonly T[],
  slotId: SelectSlotId,
  incoming: T,
): boolean {
  const title = normalizedTitle(incoming.title);
  return picks.some(
    (pick, index) =>
      index !== slotId &&
      (pick.movieId === incoming.movieId || normalizedTitle(pick.title) === title),
  );
}

function exclusionsForReplacement(
  live: readonly VisibleSelect[],
  departing: readonly VisibleSelect[],
): SelectExclusion[] {
  const excluded: SelectExclusion[] = [];
  const seen = new Set<string>();
  for (const pick of [...live, ...departing]) {
    const id = String(pick.movieId);
    const key = `${id}:${normalizedTitle(pick.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    excluded.push({ id, title: pick.title });
  }
  return excluded;
}

export async function executeSelectReplacement<
  TPick extends VisibleSelect,
  TRawPick,
  TContext,
>({
  slotId,
  picks,
  getPicks,
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

  const currentPicks = () => getPicks?.() ?? picks;
  const context = await readContext();
  const candidates = await requestPicks(
    context,
    exclusionsForReplacement(currentPicks(), picks),
  );

  for (const candidate of candidates) {
    const hydrated = await hydratePick(candidate);
    if (!hydrated) continue;
    const recommended = rawTitle(candidate) || hydrated.title;
    if (!hydratedTitleMatchesPick(recommended, hydrated.title)) continue;
    const latest = currentPicks();
    if (replacementConflictsWithSiblings(latest, slotId, hydrated)) continue;

    const next = replacePickAtSlot(latest, slotId, hydrated);
    const accepted = await persistPicks(next);
    if (accepted === false) continue;
    return replacePickAtSlot(currentPicks(), slotId, hydrated);
  }

  throw new Error('No new select available');
}
