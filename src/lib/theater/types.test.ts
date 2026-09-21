import { describe, expect, it } from 'vitest';
import { FALLBACK_SWATCHES, PICKS_SIZE, parseTheater, type Theater, type TheaterFilm, type TheaterLineupItem } from './types';

const HEAT: TheaterFilm = {
  id: 949,
  title: 'Heat',
  year: '1995',
  posterPath: '/heat.jpg',
  backdropPath: '/heat-backdrop.jpg',
  genres: ['Crime', 'Drama'],
  director: 'Michael Mann',
  mediaType: 'movie',
};
const THIEF: TheaterFilm = {
  id: 10858,
  title: 'Thief',
  year: '1981',
  posterPath: '/thief.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};
const COLLATERAL: TheaterFilm = {
  id: 1538,
  title: 'Collateral',
  year: '2004',
  posterPath: '/collateral.jpg',
  backdropPath: null,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  mediaType: 'movie',
};

const LINEUP: TheaterLineupItem[] = [
  { id: 5511, title: 'Le Samouraï', year: '1967', posterPath: '/5511.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'A contract killer follows his routine flawlessly and it still closes on him.' },
  { id: 9526, title: 'To Live and Die in L.A.', year: '1985', posterPath: '/9526.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'A Secret Service agent so good at the chase he becomes the crime.' },
  { id: 31672, title: 'The Friends of Eddie Coyle', year: '1973', posterPath: '/31672.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'Every hood in Boston knows his trade and none of it saves Eddie.' },
  { id: 24559, title: 'Sorcerer', year: '1977', posterPath: '/24559.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'Four experts drive nitroglycerin through a jungle that does not care.' },
  { id: 379, title: "Miller's Crossing", year: '1990', posterPath: '/379.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'Tom plays every angle in the room and still ends up alone.' },
  { id: 273481, title: 'Sicario', year: '2015', posterPath: '/273481.jpg', backdropPath: null, genres: [], director: null, mediaType: 'movie', reason: 'Kate does everything right and learns the job was never hers.' },
];

const THEATER: Theater = {
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep opening films where the plan is perfect and the ending is not.',
  swatches: FALLBACK_SWATCHES,
  sourceFilmIds: [949, 10858, 1538],
  trail: [HEAT, THIEF, COLLATERAL],
  lineup: LINEUP,
};

describe('parseTheater', () => {
  it('accepts a Theater with a three-film trail and up to six picks', () => {
    expect(parseTheater(THEATER)).toEqual(THEATER);
    expect(parseTheater({ ...THEATER, lineup: [] })?.lineup).toEqual([]);
    expect(PICKS_SIZE).toBe(6);
  });

  it('refuses an old eight-row lineup', () => {
    const extra: TheaterLineupItem = {
      ...LINEUP[0],
      id: 64690,
      title: 'Drive',
      year: '2011',
      reason: 'The driver is perfect behind the wheel and helpless everywhere else.',
    };
    const eighth: TheaterLineupItem = {
      ...LINEUP[0],
      id: 680,
      title: 'Pulp Fiction',
      year: '1994',
      reason: 'A second extra row from the old schema.',
    };
    expect(parseTheater({ ...THEATER, lineup: [...LINEUP, extra, eighth] })).toBeNull();
  });

  it('refuses a restored session whose trail has fewer than three films', () => {
    expect(parseTheater({ ...THEATER, trail: [HEAT, THIEF] })).toBeNull();
    expect(parseTheater({ ...THEATER, trail: [HEAT] })).toBeNull();
    expect(parseTheater({ ...THEATER, trail: [] })).toBeNull();
    const { trail: _trail, ...withoutTrail } = THEATER;
    expect(parseTheater(withoutTrail)).toBeNull();
  });
});
