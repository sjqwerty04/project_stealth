import { describe, expect, it } from 'vitest';
import { libraryView } from '../library/useLibrary';
import {
  parseTheaterDoc,
  theaterArchiveState,
  theaterCardView,
  type KeptTheater,
} from './archive';
import { theaterFromLegacy } from './legacyStore';
import { FALLBACK_SWATCHES } from './types';

const SWATCHES = ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'];

const LINEUP_ROWS: [number, string, string, string][] = [
  [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
  [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
  [1538, 'Collateral', '2004', 'One long night where the professional and the amateur both lose the map.'],
  [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
  [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
  [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
  [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
  [10858, 'Thief', '1981', 'Frank builds the whole life on paper and burns every page of it.'],
];

const CANONICAL_DOC = {
  schema: 1,
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep landing on people whose craft is the exact thing that ruins them.',
  swatches: SWATCHES,
  sourceSignals: [],
  sourceFilmIds: [10858, 949],
  lineup: LINEUP_ROWS.map(([id, title, year, reason]) => ({
    id,
    title,
    year,
    posterPath: `/${id}.jpg`,
    backdropPath: null,
    genres: ['Crime'],
    director: 'Michael Mann',
    mediaType: 'movie',
    reason,
  })),
  keptAt: 1758240000000,
};

const LEGACY_RAW_DOC = {
  pattern: 'Rain on glass, nobody talking',
  movies: [
    { id: 949, title: 'Heat', year: 1995, posterPath: '/heat.jpg', mediaType: 'movie' },
    { id: 64690, title: 'Drive', year: '2011', posterPath: null, mediaType: 'movie' },
  ],
  createdAt: { seconds: 1700000000 },
};

function theater(overrides: Partial<KeptTheater> = {}): KeptTheater {
  return {
    id: 'trail',
    title: 'Men who are good at their jobs and lose anyway',
    facets: ['COMPETENCE PORN', 'NOBODY WINS'],
    insight: 'You keep landing on people whose craft is the exact thing that ruins them.',
    swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
    films: [],
    trail: [],
    keptAt: 1758240000000,
    ...overrides,
  };
}

function films(...ids: number[]) {
  return ids.map((id) => ({
    id,
    title: `Film ${id}`,
    year: '1981',
    posterPath: null,
    mediaType: 'movie' as const,
    reason: '',
  }));
}

describe('parseTheaterDoc', () => {
  it('reads a canonical document into title, facets, swatches, and eight films with their reasons', () => {
    const parsed = parseTheaterDoc('trail-hash', CANONICAL_DOC);
    expect(parsed?.id).toBe('trail-hash');
    expect(parsed?.title).toBe('Men who are good at their jobs and lose anyway');
    expect(parsed?.facets).toEqual(['COMPETENCE PORN', 'NOBODY WINS']);
    expect(parsed?.insight).toBe('You keep landing on people whose craft is the exact thing that ruins them.');
    expect(parsed?.swatches).toEqual(['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20']);
    expect(parsed?.keptAt).toBe(1758240000000);
    expect(parsed?.films.map((film) => film.title)).toEqual([
      'Le Samouraï',
      'To Live and Die in L.A.',
      'Collateral',
      'The Friends of Eddie Coyle',
      'Sorcerer',
      "Miller's Crossing",
      'Sicario',
      'Thief',
    ]);
    expect(parsed?.films[0].reason).toBe(
      'A contract killer follows his routine flawlessly and it still closes on him.',
    );
    expect(parsed?.films[7]).toEqual({
      id: 10858,
      title: 'Thief',
      year: '1981',
      posterPath: '/10858.jpg',
      mediaType: 'movie',
      reason: 'Frank builds the whole life on paper and burns every page of it.',
    });
    expect(parsed?.trail).toEqual(parsed?.films);
  });

  it('reads trail posters from opened films on sourceSignals', () => {
    const parsed = parseTheaterDoc('trail-hash', {
      ...CANONICAL_DOC,
      sourceSignals: [
        { kind: 'detail_view', film: { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg', mediaType: 'movie' }, at: 0 },
        { kind: 'detail_view', film: { id: 10858, title: 'Thief', year: '1981', posterPath: '/thief.jpg', mediaType: 'movie' }, at: 1 },
        { kind: 'detail_view', film: { id: 1538, title: 'Collateral', year: '2004', posterPath: '/collateral.jpg', mediaType: 'movie' }, at: 2 },
      ],
    });
    expect(parsed?.trail.map((film) => film.title)).toEqual(['Heat', 'Thief', 'Collateral']);
    expect(theaterCardView(parsed!, new Set()).filmCount).toBe(3);
    expect(theaterCardView(parsed!, new Set()).trail).toHaveLength(3);
  });

  it('reads a copied-forward legacy document with its pattern as the title and no facets', () => {
    const copied = theaterFromLegacy(LEGACY_RAW_DOC);
    const parsed = parseTheaterDoc('legacy-1', copied);
    expect(parsed?.title).toBe('Rain on glass, nobody talking');
    expect(parsed?.facets).toBeNull();
    expect(parsed?.swatches).toEqual(FALLBACK_SWATCHES);
    expect(parsed?.keptAt).toBe(1700000000000);
    expect(parsed?.films.map((film) => [film.title, film.year, film.reason])).toEqual([
      ['Heat', '1995', ''],
      ['Drive', '2011', ''],
    ]);
  });

  it('reads a raw legacy document that copy-forward has not reached yet', () => {
    const parsed = parseTheaterDoc('legacy-2', LEGACY_RAW_DOC);
    expect(parsed?.title).toBe('Rain on glass, nobody talking');
    expect(parsed?.insight).toBe('Rain on glass, nobody talking');
    expect(parsed?.facets).toBeNull();
    expect(parsed?.swatches).toEqual(FALLBACK_SWATCHES);
    expect(parsed?.keptAt).toBe(1700000000000);
    expect(parsed?.films.map((film) => film.id)).toEqual([949, 64690]);
  });

  it('drops a document with no name and skips film entries that have no id or title', () => {
    expect(parseTheaterDoc('empty', {})).toBeNull();
    expect(parseTheaterDoc('nothing', null)).toBeNull();
    expect(parseTheaterDoc('blank', { title: '   ' })).toBeNull();
    const patchy = parseTheaterDoc('patchy', {
      title: 'One apartment, one very bad week',
      lineup: [{ id: 680, title: 'Pulp Fiction' }, { title: 'No id' }, { id: 12 }, 'not a film'],
    });
    expect(patchy?.films).toEqual([
      { id: 680, title: 'Pulp Fiction', year: '', posterPath: null, mediaType: 'movie', reason: '' },
    ]);
    expect(patchy?.keptAt).toBe(0);
  });

  it('ignores a facet list that is not exactly two named facets', () => {
    expect(parseTheaterDoc('a', { title: 'T', facets: ['ONLY ONE'] })?.facets).toBeNull();
    expect(parseTheaterDoc('b', { title: 'T', facets: ['A', 'B', 'C'] })?.facets).toBeNull();
    expect(parseTheaterDoc('c', { title: 'T', facets: ['A', ''] })?.facets).toBeNull();
    expect(parseTheaterDoc('d', { title: 'T', facets: ['A', 'B'] })?.facets).toEqual(['A', 'B']);
  });

  it('falls back to the four house swatches when the stored list is not four hex colours', () => {
    expect(parseTheaterDoc('a', { title: 'T', swatches: ['#1D5B8A', '#8A3A1D'] })?.swatches).toEqual(FALLBACK_SWATCHES);
    expect(parseTheaterDoc('b', { title: 'T', swatches: ['red', 'green', 'blue', 'black'] })?.swatches).toEqual(
      FALLBACK_SWATCHES,
    );
  });
});

describe('theaterCardView', () => {
  it('counts trail posters, subtracts what the ledger has watched, and names the card for speech', () => {
    const parsed = parseTheaterDoc('trail-hash', CANONICAL_DOC);
    const view = theaterCardView(parsed!, new Set([5511, 1538, 10858]));
    expect(view.filmCount).toBe(8);
    expect(view.unseenCount).toBe(5);
    expect(view.countLine).toBe('8 FILMS · 5 UNSEEN');
    expect(view.accessibleName).toBe(
      'Men who are good at their jobs and lose anyway. 8 films, 5 unseen.',
    );
    expect(view.extraCount).toBe(2);
    expect(view.trail).toHaveLength(8);
  });

  it('leaves the spoken name as the title and counts when the document has no facets', () => {
    const view = theaterCardView(
      theater({ title: 'Rain on glass, nobody talking', facets: null, films: films(949) }),
      new Set([949]),
    );
    expect(view.accessibleName).toBe('Rain on glass, nobody talking. 1 film, 0 unseen.');
  });

  it('writes FILM for one and FILMS for two, and leaves UNSEEN unchanged', () => {
    expect(theaterCardView(theater({ films: films(949) }), new Set()).countLine).toBe('1 FILM · 1 UNSEEN');
    expect(theaterCardView(theater({ films: films(949) }), new Set([949])).countLine).toBe('1 FILM · 0 UNSEEN');
    expect(theaterCardView(theater({ films: films(949, 10858) }), new Set()).countLine).toBe('2 FILMS · 2 UNSEEN');
    expect(theaterCardView(theater({ films: films(949, 10858) }), new Set([949])).countLine).toBe('2 FILMS · 1 UNSEEN');
    expect(theaterCardView(theater({ films: [] }), new Set()).countLine).toBe('0 FILMS · 0 UNSEEN');
  });

  it('counts a repeated film once', () => {
    const view = theaterCardView(theater({ films: films(949, 949, 10858) }), new Set());
    expect(view.filmCount).toBe(2);
    expect(view.countLine).toBe('2 FILMS · 2 UNSEEN');
  });

  it('spells one film in the singular inside the spoken name', () => {
    expect(theaterCardView(theater({ films: films(949) }), new Set()).accessibleName).toBe(
      'Men who are good at their jobs and lose anyway. 1 film, 1 unseen.',
    );
  });
});

describe('theaterArchiveState', () => {
  const KEPT = theater({ films: films(949, 10858) });

  function sources(overrides: Partial<Parameters<typeof theaterArchiveState>[0]> = {}) {
    return {
      theaters: [KEPT],
      archiveLoading: false,
      archiveError: null,
      ledgerLoading: false,
      watchedFilmIds: new Set([949]),
      ...overrides,
    };
  }

  it('publishes counts once the archive and the ledger have both landed', () => {
    const state = theaterArchiveState(sources());
    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.rows).toEqual([
      { theater: KEPT, card: theaterCardView(KEPT, new Set([949])) },
    ]);
    expect(state.status === 'ready' && state.rows[0].card.countLine).toBe('2 FILMS · 1 UNSEEN');
  });

  it('holds cards while a signed-in ledger still belongs to someone else', () => {
    const ledger = libraryView('guest', { uid: 'owner', films: [] });
    expect(ledger.loading).toBe(true);
    expect(theaterArchiveState(sources({ ledgerLoading: ledger.loading, watchedFilmIds: new Set() }))).toEqual({
      status: 'loading',
    });
  });

  it('publishes nothing while the ledger is still loading, however complete the archive is', () => {
    expect(theaterArchiveState(sources({ ledgerLoading: true, watchedFilmIds: new Set() }))).toEqual({
      status: 'loading',
    });
    expect(theaterArchiveState(sources({ ledgerLoading: true, watchedFilmIds: new Set([949]) }))).toEqual({
      status: 'loading',
    });
  });

  it('never publishes the count a partially loaded ledger would produce', () => {
    const half = theaterArchiveState(sources({ ledgerLoading: true, watchedFilmIds: new Set() }));
    const whole = theaterArchiveState(sources({ watchedFilmIds: new Set([949, 10858]) }));
    expect(half.status).toBe('loading');
    expect('rows' in half).toBe(false);
    expect(whole.status === 'ready' && whole.rows[0].card.countLine).toBe('2 FILMS · 0 UNSEEN');
  });

  it('publishes nothing while the archive is still loading', () => {
    expect(theaterArchiveState(sources({ archiveLoading: true, theaters: [] }))).toEqual({ status: 'loading' });
  });

  it('shows a snapshot failure over either loading state', () => {
    expect(theaterArchiveState(sources({ archiveError: 'permission-denied' }))).toEqual({ status: 'error' });
    expect(
      theaterArchiveState(sources({ archiveError: 'permission-denied', ledgerLoading: true, theaters: [] })),
    ).toEqual({ status: 'error' });
  });

  it('shows the empty state only when both sources are done and nothing was kept', () => {
    expect(theaterArchiveState(sources({ theaters: [] }))).toEqual({ status: 'empty' });
    expect(theaterArchiveState(sources({ theaters: [], ledgerLoading: true }))).toEqual({ status: 'loading' });
  });

  it('keeps the archive order it was handed', () => {
    const older = theater({ id: 'older', films: films(64690) });
    const state = theaterArchiveState(sources({ theaters: [KEPT, older] }));
    expect(state.status === 'ready' && state.rows.map((row) => row.theater.id)).toEqual(['trail', 'older']);
  });
});
