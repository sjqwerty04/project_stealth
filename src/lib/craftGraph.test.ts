import { describe, expect, it } from 'vitest';
import { craftGraph, craftNodeCount, withRelatedFilms } from './craftGraph';

const heat = {
  id: 949,
  title: 'Heat',
  poster: '/heat.jpg',
  kept: true,
  director: { id: 1, name: 'Michael Mann' },
  camera: { id: 2, name: 'Dante Spinotti' },
  score: { id: 3, name: 'Elliot Goldenthal' },
  cast: [{ id: 4, name: 'Al Pacino' }],
};

const collateral = {
  id: 765,
  title: 'Collateral',
  poster: '/collateral.jpg',
  director: { id: 1, name: 'Michael Mann' },
  camera: { id: 5, name: 'Paul Cameron' },
  cast: [{ id: 6, name: 'Tom Cruise' }],
};

describe('craftGraph', () => {
  it('joins two films on the same director and still draws the other crafts', () => {
    const graph = craftGraph([heat, collateral], 'You', '#3A6E85');
    const direction = graph.sectors.find((sector) => sector.key === 'dir');
    expect(direction?.branches).toHaveLength(1);
    expect(direction?.branches[0].name).toBe('Michael Mann');
    expect(direction?.branches[0].films.map((film) => film.title)).toEqual(['Heat', 'Collateral']);
    expect(direction?.branches[0].films[0].kept).toBe(true);
    expect(graph.sectors.map((sector) => sector.key)).toEqual(['dir', 'dp', 'mus', 'cast']);
    expect(craftNodeCount(graph)).toBeGreaterThan(4);
  });

  it('still emits nodes for a single film', () => {
    const graph = craftGraph([heat], 'Heat', '#FF3B14');
    expect(graph.label).toBe('Heat');
    expect(craftNodeCount(graph)).toBeGreaterThan(0);
    expect(graph.sectors.find((sector) => sector.key === 'cast')?.branches[0].films).toHaveLength(1);
  });

  it('hangs a related film on the person who made it', () => {
    const graph = withRelatedFilms(craftGraph([heat], 'Heat', '#FF3B14'), 1, [
      { id: 765, title: 'Collateral', poster: '/collateral.jpg', kept: false },
    ]);
    const films = graph.sectors.find((sector) => sector.key === 'dir')?.branches[0].films;
    expect(films?.map((film) => film.id)).toEqual([949, 765]);
  });
});
