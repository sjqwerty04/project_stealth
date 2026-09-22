import { hydratedTitleMatchesPick } from '../lib/taste/selectPickCoherence';

export type SelectExclusion = {
  id: string;
  title: string;
};

export type SelectFilmRef = {
  movieId?: number;
  id?: string;
  title: string;
};

function normalizedTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

export function uniqueByMovieId<T extends { movieId: number }>(picks: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const pick of picks) {
    if (seen.has(pick.movieId)) continue;
    seen.add(pick.movieId);
    out.push(pick);
  }
  return out;
}

export function toSelectExclusion(film: SelectFilmRef | SelectExclusion): SelectExclusion | null {
  const title = film.title.trim();
  const fromId = 'id' in film && film.id != null ? String(film.id).trim() : '';
  const fromMovie = 'movieId' in film && film.movieId != null ? String(film.movieId) : '';
  const id = fromId || fromMovie;
  if (!title && !id) return null;
  return { id: id || title, title: title || id };
}

export function mergeSelectExclusions(
  films: readonly (SelectFilmRef | SelectExclusion | null | undefined)[],
): SelectExclusion[] {
  const byKey = new Map<string, SelectExclusion>();
  for (const film of films) {
    if (!film) continue;
    const exclusion = toSelectExclusion(film);
    if (!exclusion) continue;
    const key = exclusion.id ? `id:${exclusion.id}` : `title:${normalizedTitle(exclusion.title)}`;
    if (byKey.has(key)) continue;
    byKey.set(key, exclusion);
  }
  return [...byKey.values()];
}

export function buildSelectExclusions(args: {
  lastPicks?: readonly SelectFilmRef[];
  ledgerWatched?: readonly SelectFilmRef[];
  sessionRated?: readonly SelectFilmRef[];
}): SelectExclusion[] {
  return mergeSelectExclusions([
    ...(args.lastPicks ?? []),
    ...(args.ledgerWatched ?? []),
    ...(args.sessionRated ?? []),
  ]);
}

export function buildYourSelectsBody<TContext>(
  context: TContext,
  excluded: SelectExclusion[],
  count: 1 | 3 = 3,
) {
  return { context, count, excluded };
}

export function pickIsExcluded(
  pick: { movieId?: number; id?: string; title?: string },
  excluded: readonly SelectExclusion[],
): boolean {
  const pickId =
    pick.id != null && String(pick.id).trim()
      ? String(pick.id).trim()
      : pick.movieId != null
        ? String(pick.movieId)
        : '';
  for (const row of excluded) {
    if (row.id && pickId && row.id === pickId) return true;
    if (row.title && pick.title && hydratedTitleMatchesPick(row.title, pick.title)) return true;
  }
  return false;
}

export function dropExcludedPicks<T extends { movieId: number; title?: string }>(
  picks: readonly T[],
  excluded: readonly SelectExclusion[],
): T[] {
  return picks.filter((pick) => !pickIsExcluded(pick, excluded));
}

export function canGenerateSelects(opts: { libraryReady: boolean; replacing: boolean }): boolean {
  return opts.libraryReady && !opts.replacing;
}

export function selectsStatusWhileBusy(
  displayedCount: number,
  storedReady: boolean,
): 'ready' | 'loading' {
  if (displayedCount > 0 || storedReady) return 'ready';
  return 'loading';
}

export function openSelectSlots<T extends { movieId: number; title?: string }>(
  picks: readonly T[],
  excluded: readonly SelectExclusion[],
): number[] {
  return picks.slice(0, 3).flatMap((pick, index) => (pickIsExcluded(pick, excluded) ? [index] : []));
}

export function coerceSelectTrio<T>(current: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length >= 3) return incoming.slice(0, 3);
  if (current.length >= 3) return current.slice(0, 3);
  return [...incoming];
}

async function hydrateList<TRaw, TPick extends { movieId: number; title?: string }>(
  raw: TRaw[],
  hydrate: (row: TRaw) => Promise<TPick | null>,
): Promise<TPick[]> {
  const settled = await Promise.all(raw.map((item) => hydrate(item)));
  const rows: TPick[] = [];
  for (const next of settled) {
    if (next) rows.push(next);
  }
  return uniqueByMovieId(rows);
}

export async function hydrateUniqueSelectPicks<TRaw, TPick extends { movieId: number; title?: string }>(opts: {
  raw: TRaw[];
  hydrate: (raw: TRaw) => Promise<TPick | null>;
  count: 1 | 3;
  excluded: SelectExclusion[];
  requestMore: (excluded: SelectExclusion[], count: 1 | 3) => Promise<TRaw[]>;
}): Promise<TPick[]> {
  const first = dropExcludedPicks(await hydrateList(opts.raw, opts.hydrate), opts.excluded);
  if (first.length >= opts.count) return first.slice(0, opts.count);
  const moreExcluded = mergeSelectExclusions([
    ...opts.excluded,
    ...first.map((pick) => ({ movieId: pick.movieId, title: pick.title ?? String(pick.movieId) })),
  ]);
  const remaining = opts.count - first.length;
  const nextCount: 1 | 3 = remaining === 1 ? 1 : 3;
  const more = dropExcludedPicks(
    await hydrateList(await opts.requestMore(moreExcluded, nextCount), opts.hydrate),
    moreExcluded,
  );
  return uniqueByMovieId([...first, ...more]).slice(0, opts.count);
}
