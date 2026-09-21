import { normalizeFilmTitle, whyMatchNamesRecommended } from '../taste/selectPickCoherence';
import type { TasteSnapshot } from '../taste/types';
import type { FilmNeighbor, NeighborAxis, RankedNeighbor } from './types';

function titleKey(title: string): string {
  return normalizeFilmTitle(title);
}

function excludedTitles(snapshot: TasteSnapshot): Set<string> {
  const out = new Set<string>();
  for (const item of snapshot.context.history) {
    out.add(titleKey(item.item));
  }
  for (const title of snapshot.generated.library?.rejects ?? []) {
    out.add(titleKey(title));
  }
  for (const pref of snapshot.context.preferences) {
    const dislike = pref.match(/^dislikes:\s*(.+)$/i);
    if (dislike) out.add(titleKey(dislike[1]));
  }
  return out;
}

function excludedIds(snapshot: TasteSnapshot): Set<number> {
  const out = new Set<number>();
  for (const item of snapshot.context.history) {
    if (!item.id) continue;
    const id = Number(item.id);
    if (Number.isFinite(id)) out.add(id);
  }
  return out;
}

function boostTitles(snapshot: TasteSnapshot): Set<string> {
  const out = new Set<string>();
  for (const title of snapshot.generated.library?.canon ?? []) {
    out.add(titleKey(title));
  }
  for (const pick of snapshot.generated.lastPicks) {
    out.add(titleKey(pick.title));
  }
  for (const pref of snapshot.context.preferences) {
    const like = pref.match(/^(?:something like|curious about)\s+(.+)$/i);
    if (like) out.add(titleKey(like[1]));
    else if (!pref.toLowerCase().startsWith('dislikes:') && !pref.toLowerCase().startsWith('often tags')) {
      out.add(titleKey(pref));
    }
  }
  return out;
}

function whyMentions(snapshot: TasteSnapshot, title: string): boolean {
  return snapshot.generated.lastPicks.some((pick) => whyMatchNamesRecommended(pick.whyMatch, title));
}

function axisBoost(axis: NeighborAxis | null, axes: NeighborAxis[]): number {
  if (!axis) return 0;
  return axes.includes(axis) ? 3 : 0;
}

export function rankNeighbors(args: {
  currentMovieId: number;
  neighbors: FilmNeighbor[];
  snapshot: TasteSnapshot;
  limit?: number;
}): RankedNeighbor[] {
  const excludedId = excludedIds(args.snapshot);
  excludedId.add(args.currentMovieId);
  const excludedTitle = excludedTitles(args.snapshot);
  const boosts = boostTitles(args.snapshot);
  const axis = args.snapshot.identity.axis;
  const seen = new Set<number>();
  const ranked: RankedNeighbor[] = [];

  for (const neighbor of args.neighbors) {
    if (!neighbor.movieId || seen.has(neighbor.movieId)) continue;
    if (excludedId.has(neighbor.movieId)) continue;
    if (excludedTitle.has(titleKey(neighbor.title))) continue;
    seen.add(neighbor.movieId);

    const axisPts = axisBoost(axis, neighbor.axes);
    const canonPts = boosts.has(titleKey(neighbor.title)) ? 5 : 0;
    const whyPts = whyMentions(args.snapshot, neighbor.title) ? 4 : 0;
    const tastePts = axisPts + canonPts + whyPts;
    ranked.push({
      ...neighbor,
      score: tastePts + (neighbor.source === 'scholar' ? 1 : 0),
      tasteBoost: tastePts > 0,
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return args.limit != null ? ranked.slice(0, args.limit) : ranked;
}

export function mergeNeighborPools(lineage: FilmNeighbor[], scholar: FilmNeighbor[]): FilmNeighbor[] {
  const byId = new Map<number, FilmNeighbor>();
  for (const row of lineage) byId.set(row.movieId, row);
  for (const row of scholar) byId.set(row.movieId, row);
  return Array.from(byId.values());
}
