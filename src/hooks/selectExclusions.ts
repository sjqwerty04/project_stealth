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

/**
 * Picks already watched or rated must never render, even from a cache written
 * before the verdict landed.
 */
export function rejectSeenPicks<T extends { movieId: number; title: string }>(
  picks: readonly T[],
  seen: readonly SelectExclusion[],
): T[] {
  if (!seen.length) return [...picks];
  const ids = new Set(seen.map((row) => row.id));
  const titles = new Set(seen.map((row) => normalizedTitle(row.title)));
  return picks.filter(
    (pick) => !ids.has(String(pick.movieId)) && !titles.has(normalizedTitle(pick.title)),
  );
}

export function buildYourSelectsBody<TContext>(
  context: TContext,
  excluded: SelectExclusion[],
  count: 1 | 3 = 3,
) {
  return { context, count, excluded };
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
  const first = await hydrateList(opts.raw, opts.hydrate);
  if (first.length >= opts.count) return first.slice(0, opts.count);
  const moreExcluded = mergeSelectExclusions([
    ...opts.excluded,
    ...first.map((pick) => ({ movieId: pick.movieId, title: pick.title ?? String(pick.movieId) })),
  ]);
  const remaining = opts.count - first.length;
  const nextCount: 1 | 3 = remaining === 1 ? 1 : 3;
  const more = await hydrateList(await opts.requestMore(moreExcluded, nextCount), opts.hydrate);
  return uniqueByMovieId([...first, ...more]).slice(0, opts.count);
}
