/**
 * CraftGraph is the one node graph.
 * Film renders it as The DNA, You as The Assembly, Home as the night's bill.
 * A sector is a craft. A branch is a person. Film nodes hang off that person.
 */
export type CraftFilmNode = {
  id: number;
  title: string;
  poster: string | null;
  kept: boolean;
};

export type CraftBranch = {
  personId: number;
  name: string;
  films: CraftFilmNode[];
};

export type CraftSector = {
  key: 'dir' | 'dp' | 'mus' | 'cast';
  name: string;
  colour: string;
  branches: CraftBranch[];
};

export type CraftGraph = {
  label: string;
  colour: string;
  sectors: CraftSector[];
};

export type CraftPerson = { id: number; name: string };

export type CraftCredit = {
  id: number;
  title: string;
  poster: string | null;
  kept?: boolean;
  director?: CraftPerson | null;
  camera?: CraftPerson | null;
  score?: CraftPerson | null;
  cast?: CraftPerson[];
};

const SECTORS: Array<{
  key: CraftSector['key'];
  name: string;
  colour: string;
  people: (film: CraftCredit) => CraftPerson[];
}> = [
  { key: 'dir', name: 'Direction', colour: '#FF3B14', people: (film) => (film.director ? [film.director] : []) },
  { key: 'dp', name: 'Camera', colour: '#7FA6CC', people: (film) => (film.camera ? [film.camera] : []) },
  { key: 'mus', name: 'Score', colour: '#D7A63E', people: (film) => (film.score ? [film.score] : []) },
  { key: 'cast', name: 'Cast', colour: '#EFEDE9', people: (film) => (film.cast ?? []).slice(0, 2) },
];

export function craftGraph(films: CraftCredit[], label: string, colour: string): CraftGraph {
  const sectors: CraftSector[] = [];
  for (const sector of SECTORS) {
    const byPerson = new Map<number, CraftBranch>();
    for (const film of films) {
      const node: CraftFilmNode = {
        id: film.id,
        title: film.title,
        poster: film.poster,
        kept: film.kept === true,
      };
      for (const person of sector.people(film)) {
        if (!person.id || !person.name) continue;
        const branch = byPerson.get(person.id) ?? { personId: person.id, name: person.name, films: [] };
        if (!branch.films.some((row) => row.id === film.id)) branch.films.push(node);
        byPerson.set(person.id, branch);
      }
    }
    const branches = [...byPerson.values()]
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name))
      .slice(0, 2)
      .map((branch) => ({ ...branch, films: branch.films.slice(0, 3) }));
    if (branches.length) sectors.push({ key: sector.key, name: sector.name, colour: sector.colour, branches });
  }
  return { label, colour, sectors };
}

export function withRelatedFilms(graph: CraftGraph, personId: number, films: CraftFilmNode[]): CraftGraph {
  return {
    ...graph,
    sectors: graph.sectors.map((sector) => ({
      ...sector,
      branches: sector.branches.map((branch) => {
        if (branch.personId !== personId || branch.films.length >= 3) return branch;
        const next = [...branch.films];
        for (const film of films) {
          if (next.length >= 3) break;
          if (!next.some((row) => row.id === film.id)) next.push(film);
        }
        return { ...branch, films: next };
      }),
    })),
  };
}

export function craftNodeCount(graph: CraftGraph): number {
  return graph.sectors.reduce(
    (sum, sector) => sum + sector.branches.reduce((inner, branch) => inner + 1 + branch.films.length, 0),
    0,
  );
}
