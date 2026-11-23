import {
  craftGraph,
  withRelatedFilms,
  type CraftCredit,
  type CraftFilmNode,
  type CraftGraph,
  type CraftPerson,
} from './craftGraph';

export type CraftSeed = {
  id: number;
  title: string;
  poster: string | null;
  mediaType?: 'movie' | 'tv';
};

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

function posterSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w185${path.startsWith('/') ? path : `/${path}`}`;
}

function person(row: { id?: number; name?: string } | undefined): CraftPerson | null {
  if (!row || typeof row.id !== 'number' || typeof row.name !== 'string' || !row.name.trim()) return null;
  return { id: row.id, name: row.name };
}

function creditFromPayload(id: number, title: string, poster: string | null, data: Record<string, unknown>, kept: boolean): CraftCredit {
  const credits = (data.credits && typeof data.credits === 'object' ? data.credits : data) as {
    crew?: { id?: number; name?: string; job?: string }[];
    cast?: { id?: number; name?: string }[];
  };
  const crew = credits.crew ?? [];
  const job = (name: string) => person(crew.find((row) => row.job === name));
  return {
    id,
    title: typeof data.title === 'string' ? data.title : typeof data.name === 'string' ? data.name : title,
    poster: posterSrc(typeof data.poster_path === 'string' ? data.poster_path : poster),
    kept,
    director: job('Director'),
    camera: job('Director of Photography'),
    score: job('Original Music Composer'),
    cast: (credits.cast ?? []).slice(0, 2).map(person).filter((row): row is CraftPerson => row !== null),
  };
}

async function creditsFor(seed: CraftSeed, kept: boolean): Promise<CraftCredit | null> {
  if (!TMDB_KEY) return null;
  const path = seed.mediaType === 'tv' ? 'tv' : 'movie';
  const res = await fetch(`${TMDB_BASE}/${path}/${seed.id}?api_key=${TMDB_KEY}&append_to_response=credits`);
  if (!res.ok) return null;
  const data = await res.json() as Record<string, unknown>;
  return creditFromPayload(seed.id, seed.title, seed.poster, data, kept);
}

const CRAFT_JOB: Record<string, string> = {
  dir: 'Director',
  dp: 'Director of Photography',
  mus: 'Original Music Composer',
};

async function relatedFilms(personId: number, exclude: Set<number>, craft: string): Promise<CraftFilmNode[]> {
  if (!TMDB_KEY) return [];
  const res = await fetch(`${TMDB_BASE}/person/${personId}/movie_credits?api_key=${TMDB_KEY}`);
  if (!res.ok) return [];
  const data = await res.json() as { cast?: Record<string, unknown>[]; crew?: Record<string, unknown>[] };
  const rows = craft === 'cast'
    ? (data.cast ?? [])
    : (data.crew ?? []).filter((row) => row.job === CRAFT_JOB[craft]);
  const byId = new Map<number, { popularity: number; film: CraftFilmNode }>();
  for (const row of rows) {
    const id = typeof row.id === 'number' ? row.id : 0;
    const title = typeof row.title === 'string' ? row.title : '';
    const poster = typeof row.poster_path === 'string' ? row.poster_path : null;
    if (!id || !title || !poster || exclude.has(id)) continue;
    const popularity = typeof row.popularity === 'number' ? row.popularity : 0;
    const existing = byId.get(id);
    if (existing && existing.popularity >= popularity) continue;
    byId.set(id, {
      popularity,
      film: { id, title, poster: posterSrc(poster), kept: false },
    });
  }
  return [...byId.values()]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 2)
    .map((row) => row.film);
}

export async function loadCraftGraph(
  seeds: CraftSeed[],
  options: { label: string; colour: string; keptIds?: number[] },
): Promise<CraftGraph> {
  const unique = new Map<number, CraftSeed>();
  for (const seed of seeds) {
    if (seed.id && !unique.has(seed.id)) unique.set(seed.id, seed);
  }
  const list = [...unique.values()].slice(0, 6);
  const kept = new Set(options.keptIds ?? []);
  const credits = (await Promise.all(list.map((seed) => creditsFor(seed, kept.has(seed.id)).catch(() => null))))
    .filter((row): row is CraftCredit => row !== null);
  let graph = craftGraph(credits, options.label, options.colour);
  const thin = graph.sectors
    .flatMap((sector) => sector.branches.filter((branch) => branch.films.length < 2).map((branch) => ({
      personId: branch.personId,
      craft: sector.key,
    })))
    .slice(0, 4);
  const seen = new Set(list.map((seed) => seed.id));
  for (const branch of thin) {
    const extra = await relatedFilms(branch.personId, seen, branch.craft).catch(() => []);
    if (extra.length) graph = withRelatedFilms(graph, branch.personId, extra);
  }
  return graph;
}
