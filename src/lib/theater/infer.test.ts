import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSkill } from '../skills';
import { buildTheaterPrompt, inferTheater, parseTheaterDraft, swatchesFrom, theaterLlm, type InferDeps } from './infer';
import type { TheaterDraft, TheaterFilm, TheaterPick, TheaterSignal } from './types';

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

const searchResult = (id: number, title: string, year: string, posterPath: string | null): TheaterFilm => ({
  id,
  title,
  year,
  posterPath,
  backdropPath: null,
  genres: [],
  director: null,
  mediaType: 'movie',
});

const TRAIL: TheaterSignal[] = [
  { kind: 'query', text: 'heat', mode: 'standard', at: 0 },
  { kind: 'detail_view', film: HEAT, at: 1000 },
  { kind: 'detail_view', film: THIEF, at: 2000 },
  { kind: 'detail_view', film: COLLATERAL, at: 3000 },
  { kind: 'dwell', filmId: 10858, ms: 20000, engaged: true },
];

const DRAFT: TheaterDraft = {
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep opening films where the plan is perfect and the ending is not.',
  picks: [
    { title: 'Le Samouraï', year: '1967', reason: 'A contract killer follows his routine flawlessly and it still closes on him.' },
    { title: 'To Live and Die in L.A.', year: '1985', reason: 'A Secret Service agent so good at the chase he becomes the crime.' },
    { title: 'The Friends of Eddie Coyle', year: '1973', reason: 'Every hood in Boston knows his trade and none of it saves Eddie.' },
    { title: 'Sorcerer', year: '1977', reason: 'Four experts drive nitroglycerin through a jungle that does not care.' },
    { title: "Miller's Crossing", year: '1990', reason: 'Tom plays every angle in the room and still ends up alone.' },
    { title: 'Sicario', year: '2015', reason: 'Kate does everything right and learns the job was never hers.' },
  ],
};

const CATALOG: Record<string, TheaterFilm> = {
  'Le Samouraï': searchResult(5511, 'Le Samouraï', '1967', '/samourai.jpg'),
  'To Live and Die in L.A.': searchResult(9526, 'To Live and Die in L.A.', '1985', '/tlad.jpg'),
  'The Friends of Eddie Coyle': searchResult(31672, 'The Friends of Eddie Coyle', '1973', null),
  Sorcerer: searchResult(24559, 'Sorcerer', '1977', '/sorcerer.jpg'),
  "Miller's Crossing": searchResult(379, "Miller's Crossing", '1990', '/millers.jpg'),
  Sicario: searchResult(273481, 'Sicario', '2015', '/sicario.jpg'),
  Drive: searchResult(64690, 'Drive', '2011', '/drive.jpg'),
  Heat: HEAT,
  Collateral: COLLATERAL,
};

const searchCatalog = async (pick: TheaterPick): Promise<TheaterFilm | null> => CATALOG[pick.title] ?? null;

const EXPECTED_LINEUP = DRAFT.picks.map((pick) => ({ ...CATALOG[pick.title], reason: pick.reason }));

function deps(overrides: Partial<InferDeps> = {}): InferDeps {
  return { llm: async () => DRAFT, searchFilm: searchCatalog, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseTheaterDraft', () => {
  it('accepts the literal draft and trims its strings', () => {
    const padded = { ...DRAFT, title: `  ${DRAFT.title} `, facets: [' COMPETENCE PORN', 'NOBODY WINS '] };
    expect(parseTheaterDraft(padded)).toEqual(DRAFT);
  });

  it('coerces numeric years to strings', () => {
    const parsed = parseTheaterDraft({ ...DRAFT, picks: DRAFT.picks.map((pick) => ({ ...pick, year: Number(pick.year) })) });
    expect(parsed?.picks).toEqual(DRAFT.picks);
  });

  it('accepts exactly six picks and rejects five, seven, eight, or none', () => {
    expect(parseTheaterDraft(DRAFT)?.picks).toHaveLength(6);
    expect(parseTheaterDraft({ ...DRAFT, picks: DRAFT.picks.slice(0, 5) })).toBeNull();
    const seventh = { title: 'Drive', year: '2011', reason: 'The driver is perfect behind the wheel and helpless everywhere else.' };
    expect(parseTheaterDraft({ ...DRAFT, picks: [...DRAFT.picks, seventh] })).toBeNull();
    const eighth = { title: 'Blue Collar', year: '1978', reason: 'Three men rob their own union and the union wins.' };
    expect(parseTheaterDraft({ ...DRAFT, picks: [...DRAFT.picks, seventh, eighth] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, picks: [] })).toBeNull();
  });

  it('treats a NO_PATTERN payload as a miss', () => {
    expect(parseTheaterDraft('NO_PATTERN')).toBeNull();
    expect(parseTheaterDraft('  NO_PATTERN  ')).toBeNull();
    expect(parseTheaterDraft({ pattern: false, ...DRAFT })).toBeNull();
    expect(parseTheaterDraft({ pattern: null, ...DRAFT })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, title: 'NO_PATTERN' })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, insight: 'NO_PATTERN' })).toBeNull();
  });

  it('rejects malformed or incomplete output', () => {
    expect(parseTheaterDraft(null)).toBeNull();
    expect(parseTheaterDraft('{"title": "cut off')).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, title: '' })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, facets: ['COMPETENCE PORN'] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, facets: ['COMPETENCE PORN', 'NOBODY WINS', 'NEON'] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, facets: ['COMPETENCE PORN', ' '] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, insight: undefined })).toBeNull();
  });

  it('rejects the whole draft when one pick lacks a reason, year, or title', () => {
    const [first, ...rest] = DRAFT.picks;
    expect(parseTheaterDraft({ ...DRAFT, picks: [{ title: first.title, year: first.year }, ...rest] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, picks: [{ ...first, reason: '   ' }, ...rest] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, picks: [{ ...first, year: null }, ...rest] })).toBeNull();
    expect(parseTheaterDraft({ ...DRAFT, picks: [{ ...first, title: '' }, ...rest] })).toBeNull();
  });
});

describe('buildTheaterPrompt', () => {
  it('lists committed searches and opened films with director and genres, marking the one they stayed with', () => {
    const prompt = buildTheaterPrompt(TRAIL);
    expect(prompt).toContain('Searches this person committed to:\n- "heat"\n');
    expect(prompt).toContain(
      'Films this person opened:\n- Heat (1995) | dir. Michael Mann | Crime, Drama\n- Thief (1981) | dir. Michael Mann | Crime, Thriller | stayed with it\n- Collateral (2004) | dir. Michael Mann | Crime, Thriller\n',
    );
    expect(prompt).toContain('program exactly 6 films');
    expect(prompt).toContain('return NO_PATTERN');
  });

  it('omits director and genres when a film carries neither', () => {
    const prompt = buildTheaterPrompt([{ kind: 'detail_view', film: searchResult(64690, 'Drive', '2011', null), at: 0 }]);
    expect(prompt).toContain('Films this person opened:\n- Drive (2011)\n');
  });

  it('marks an AI-curated query and writes none for missing evidence', () => {
    const prompt = buildTheaterPrompt([{ kind: 'query', text: ' men who lose anyway ', mode: 'ai-curated', at: 0 }]);
    expect(prompt).toContain('- "men who lose anyway" (written in their own words)');
    expect(prompt).toContain('Films this person opened:\n- none');
  });
});

describe('swatchesFrom', () => {
  it('uses valid supplied colors in order and fills the rest from the fallback palette', () => {
    expect(swatchesFrom([])).toEqual(['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20']);
    expect(swatchesFrom(['#112233', 'nope', '#abc', '#445566'])).toEqual(['#112233', '#445566', '#3A6E85', '#1D1D20']);
    expect(swatchesFrom(['#000001', '#000002', '#000003', '#000004', '#000005'])).toEqual(['#000001', '#000002', '#000003', '#000004']);
  });
});

describe('inferTheater', () => {
  it('hydrates six recommended picks, copies the opened trail, and preserves every reason', async () => {
    const received: { prompt?: string; system?: string } = {};
    const theater = await inferTheater(
      TRAIL,
      deps({
        llm: async (prompt, system) => {
          received.prompt = prompt;
          received.system = system;
          return DRAFT;
        },
      }),
    );
    expect(theater).toEqual({
      title: 'Men who are good at their jobs and lose anyway',
      facets: ['COMPETENCE PORN', 'NOBODY WINS'],
      insight: 'You keep opening films where the plan is perfect and the ending is not.',
      swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
      sourceFilmIds: [949, 10858, 1538],
      trail: [HEAT, THIEF, COLLATERAL],
      lineup: EXPECTED_LINEUP,
    });
    expect(theater?.lineup).toHaveLength(6);
    expect(theater?.lineup.map((item) => item.title)).not.toEqual(expect.arrayContaining(['Heat', 'Thief', 'Collateral']));
    expect(theater?.lineup.map((item) => item.reason)).toEqual(DRAFT.picks.map((pick) => pick.reason));
    expect(received.prompt).toBe(buildTheaterPrompt(TRAIL));
    expect(received.system).toBe(loadSkill('theater-infer'));
    expect(received.system).toContain('exactly six films');
  });

  it('returns null on NO_PATTERN without hydrating anything', async () => {
    const searchFilm = vi.fn(searchCatalog);
    expect(await inferTheater(TRAIL, deps({ llm: async () => 'NO_PATTERN', searchFilm }))).toBeNull();
    expect(searchFilm).not.toHaveBeenCalled();
  });

  it('keeps the remaining picks when one hydrated title does not match', async () => {
    const godfather = searchResult(238, 'The Godfather', '1972', null);
    const theater = await inferTheater(
      TRAIL,
      deps({ searchFilm: async (pick) => (pick.title === 'Sicario' ? godfather : searchCatalog(pick)) }),
    );
    expect(theater?.lineup.map((item) => item.title)).toEqual(DRAFT.picks.slice(0, 5).map((pick) => pick.title));
  });

  it('skips a duplicate hydration instead of inventing a second row', async () => {
    const secondDrive = { title: 'Drive (2011)', year: '2011', reason: 'A second reason for the same film.' };
    const draft = { ...DRAFT, picks: DRAFT.picks.map((pick) => (pick.title === 'Sicario' ? secondDrive : pick)) };
    const theater = await inferTheater(
      TRAIL,
      deps({ llm: async () => draft, searchFilm: async (pick) => searchCatalog(pick.title === 'Drive (2011)' ? { ...pick, title: 'Drive' } : pick) }),
    );
    expect(theater?.lineup.map((item) => item.title)).toEqual([...DRAFT.picks.slice(0, 5).map((pick) => pick.title), 'Drive']);
    expect(theater?.lineup.filter((item) => item.title === 'Drive')).toHaveLength(1);
  });

  it('drops a pick that hydrates to a film the person already opened', async () => {
    const draft = { ...DRAFT, picks: [{ title: 'Heat', year: '1995', reason: 'They already opened this one.' }, ...DRAFT.picks.slice(1)] };
    const theater = await inferTheater(TRAIL, deps({ llm: async () => draft }));
    expect(theater?.lineup.map((item) => item.title)).toEqual(DRAFT.picks.slice(1).map((pick) => pick.title));
    expect(theater?.lineup.map((item) => item.title)).not.toContain('Heat');
  });

  it('skips a pick whose search throws or comes back empty', async () => {
    const throwing = deps({
      searchFilm: async (pick) => {
        if (pick.title === 'Sorcerer') throw new Error('TMDB 500');
        return searchCatalog(pick);
      },
    });
    expect((await inferTheater(TRAIL, throwing))?.lineup.map((item) => item.title)).toEqual(
      DRAFT.picks.filter((pick) => pick.title !== 'Sorcerer').map((pick) => pick.title),
    );
    const empty = deps({ searchFilm: async (pick) => (pick.title === 'Sicario' ? null : searchCatalog(pick)) });
    expect((await inferTheater(TRAIL, empty))?.lineup).toHaveLength(5);
    expect(await inferTheater(TRAIL, deps({ searchFilm: async () => null }))).toMatchObject({ lineup: [] });
  });

  it('yields null on malformed output without hydrating anything', async () => {
    const searchFilm = vi.fn(searchCatalog);
    expect(await inferTheater(TRAIL, deps({ llm: async () => null, searchFilm }))).toBeNull();
    expect(await inferTheater(TRAIL, deps({ llm: async () => 'not json', searchFilm }))).toBeNull();
    const [first, ...rest] = DRAFT.picks;
    const missingReason = { ...DRAFT, picks: [{ title: first.title, year: first.year }, ...rest] };
    expect(await inferTheater(TRAIL, deps({ llm: async () => missingReason, searchFilm }))).toBeNull();
    expect(searchFilm).not.toHaveBeenCalled();
  });

  it('derives swatches from poster colors when a source is supplied', async () => {
    let sampled: TheaterFilm[] = [];
    const posterColors = async (films: TheaterFilm[]) => {
      sampled = films;
      return ['#0B3D91', 'bad', '#7A1F1F'];
    };
    const theater = await inferTheater(TRAIL, deps({ posterColors }));
    expect(theater?.swatches).toEqual(['#0B3D91', '#7A1F1F', '#3A6E85', '#1D1D20']);
    expect(sampled.map((film) => film.id)).toEqual([5511, 9526, 31672, 24559, 379, 273481]);
  });
});

describe('theaterLlm', () => {
  const llmResponse = (text: string): typeof fetch => async () => new Response(JSON.stringify({ text }), { status: 200 });

  it('parses a complete draft from one Grok call at low reasoning and 700 tokens', async () => {
    const fetchMock = vi.fn(llmResponse(JSON.stringify(DRAFT)));
    vi.stubGlobal('fetch', fetchMock);
    const theater = await inferTheater(TRAIL, { llm: theaterLlm, searchFilm: searchCatalog });
    expect(theater?.lineup).toEqual(EXPECTED_LINEUP);
    expect(theater?.trail).toEqual([HEAT, THIEF, COLLATERAL]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/llm');
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: buildTheaterPrompt(TRAIL),
      systemPrompt: loadSkill('theater-infer'),
      maxTokens: 700,
      reasoningEffort: 'low',
    });
  });

  it('spends exactly one Grok call on a malformed draft and never repairs it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(llmResponse('{"title": "Men who are good at their jobs and'));
    vi.stubGlobal('fetch', fetchMock);
    const otherTrail: TheaterSignal[] = [
      { kind: 'query', text: 'thief', mode: 'standard', at: 0 },
      { kind: 'detail_view', film: HEAT, at: 1000 },
      { kind: 'detail_view', film: THIEF, at: 2000 },
      { kind: 'detail_view', film: COLLATERAL, at: 3000 },
    ];
    expect(await inferTheater(otherTrail, { llm: theaterLlm, searchFilm: searchCatalog })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
