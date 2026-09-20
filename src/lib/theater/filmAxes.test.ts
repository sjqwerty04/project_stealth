import { describe, expect, it, vi } from 'vitest';
import { loadSkill } from '../skills';
import type { KeptTheater } from './archive';
import {
  buildFilmAxesPrompt,
  deriveUserAxisRows,
  filmAxesDocFrom,
  filmAxesDocId,
  filmAxesLlm,
  generateFilmAxes,
  loadFilmAxes,
  parseCachedFilmAxes,
  parseFilmAxes,
  parseFilmAxesDoc,
  parseFilmAxesResult,
  theaterEvidenceByFilm,
  theaterFilmMatchesAxisValue,
  type FilmAxes,
  type FilmAxesDoc,
  type FilmAxesSource,
  type FilmAxesSubject,
} from './filmAxes';

const THIEF: FilmAxesSubject = {
  id: 10858,
  mediaType: 'movie',
  title: 'Thief',
  year: '1981',
  director: 'Michael Mann',
  genres: ['Crime', 'Thriller'],
};

const THIEF_ROWS = [
  { name: 'LOOK', value: 'sodium-and-cyan night', score: 4 },
  { name: 'CAMERA', value: 'locked-off', score: 2 },
  { name: 'TEMPO', value: 'procedural', score: 5 },
  { name: 'WEATHER', value: 'competence porn', score: 4 },
  { name: 'SOUND', value: 'synth pulse', score: 2 },
  { name: 'WORLD', value: 'rain-slick city night', score: 3 },
  { name: 'SHAPE', value: 'two-hander', score: 1 },
  { name: 'FORMAT', value: '1.85 spherical', score: 3 },
];

const THIEF_AXES = parseFilmAxes(THIEF_ROWS) as FilmAxes;

const OTHER_AXES = parseFilmAxes([
  { name: 'LOOK', value: 'blown-out daylight', score: 1 },
  { name: 'CAMERA', value: 'handheld', score: 5 },
  { name: 'TEMPO', value: 'breathless', score: 5 },
  { name: 'WEATHER', value: 'nothing to lose', score: 3 },
  { name: 'SOUND', value: 'brass stabs', score: 4 },
  { name: 'WORLD', value: 'desert border', score: 4 },
  { name: 'SHAPE', value: 'heist ladder', score: 2 },
  { name: 'FORMAT', value: '2.39 anamorphic', score: 5 },
]) as FilmAxes;

function keptFilm(id: number, title: string, year: string, reason: string) {
  return { id, title, year, posterPath: null, mediaType: 'movie' as const, reason };
}

const BECAUSE_OF_THE_NIGHT: KeptTheater = {
  id: 'because-of-the-night',
  title: 'Because of the night',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'],
  insight: 'You keep walking back into the same rained-on block after midnight.',
  swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
  films: [
    keptFilm(5511, 'Le Samouraï', '1967', 'THE PROFESSIONAL AS MONK. BOTH MEN ARE ALONE BY CHOICE.'),
    keptFilm(9526, 'To Live and Die in L.A.', '1985', 'SYNTH PULSE, SODIUM LIGHT, AND A CITY THAT DOES THE TALKING.'),
    keptFilm(1538, 'Collateral', '2004', 'MANN AGAIN. SAME CITY LOGIC, TWENTY-THREE YEARS LATER.'),
    keptFilm(10858, 'Thief', '1981', 'FRANK BUILDS THE WHOLE LIFE ON PAPER AND BURNS EVERY PAGE OF IT.'),
  ],
  keptAt: 1758240000000,
};

const LOCKED_OFF_FRAMES: KeptTheater = {
  id: 'locked-off-frames',
  title: 'Locked-off frames, procedural men',
  facets: ['LOCKED-OFF', 'PROCEDURAL'],
  insight: 'The camera stays put and lets the work happen.',
  swatches: ['#2B2B2F', '#1D5B8A', '#8A3A1D', '#3A6E85'],
  films: [
    keptFilm(949, 'Heat', '1995', 'THE HEIST RUNS ON A CLOCK AND THE CLOCK RUNS OUT.'),
    keptFilm(1538, 'Collateral', '2004', 'A CAB BECOMES A LOCKED-OFF FRAME FOR TWO MEN.'),
  ],
  keptAt: 1755000000000,
};

describe('parseFilmAxes', () => {
  it('parses the eight Thief axes with their values and scores', () => {
    expect(THIEF_AXES).toEqual([
      { name: 'LOOK', value: 'sodium-and-cyan night', score: 4 },
      { name: 'CAMERA', value: 'locked-off', score: 2 },
      { name: 'TEMPO', value: 'procedural', score: 5 },
      { name: 'WEATHER', value: 'competence porn', score: 4 },
      { name: 'SOUND', value: 'synth pulse', score: 2 },
      { name: 'WORLD', value: 'rain-slick city night', score: 3 },
      { name: 'SHAPE', value: 'two-hander', score: 1 },
      { name: 'FORMAT', value: '1.85 spherical', score: 3 },
    ]);
  });

  it('trims a padded value', () => {
    const axes = parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 0 ? { ...row, value: '  sodium-and-cyan night ' } : row)));
    expect(axes?.[0].value).toBe('sodium-and-cyan night');
  });

  it('rejects a missing row', () => {
    expect(parseFilmAxes(THIEF_ROWS.slice(0, 7))).toBeNull();
  });

  it('rejects a ninth row', () => {
    expect(parseFilmAxes([...THIEF_ROWS, { name: 'LOOK', value: 'again', score: 1 }])).toBeNull();
  });

  it('rejects a duplicated axis', () => {
    expect(parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 1 ? { ...THIEF_ROWS[0] } : row)))).toBeNull();
  });

  it('rejects an unknown axis name', () => {
    expect(parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 3 ? { ...row, name: 'MOOD' } : row)))).toBeNull();
  });

  it('rejects the eight axes out of order', () => {
    const swapped = [...THIEF_ROWS];
    swapped[0] = THIEF_ROWS[1];
    swapped[1] = THIEF_ROWS[0];
    expect(parseFilmAxes(swapped)).toBeNull();
  });

  it('rejects an empty value', () => {
    expect(parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 2 ? { ...row, value: '   ' } : row)))).toBeNull();
  });

  it('rejects a score of 0, 6, 2.5, or "3"', () => {
    for (const score of [0, 6, 2.5, '3']) {
      expect(parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 4 ? { ...row, score } : row)))).toBeNull();
    }
  });

  it('rejects a value that is not a string', () => {
    expect(parseFilmAxes(THIEF_ROWS.map((row, i) => (i === 5 ? { ...row, value: 3 } : row)))).toBeNull();
  });

  it('rejects anything that is not an array of rows', () => {
    expect(parseFilmAxes(null)).toBeNull();
    expect(parseFilmAxes({ axes: THIEF_ROWS })).toBeNull();
    expect(parseFilmAxes(THIEF_ROWS.map((row) => row.value))).toBeNull();
  });
});

describe('parseFilmAxesResult', () => {
  it('reads the axes out of the model envelope', () => {
    expect(parseFilmAxesResult({ axes: THIEF_ROWS })?.[6]).toEqual({ name: 'SHAPE', value: 'two-hander', score: 1 });
  });

  it('rejects an envelope without axes and a bare array', () => {
    expect(parseFilmAxesResult({ rows: THIEF_ROWS })).toBeNull();
    expect(parseFilmAxesResult(THIEF_ROWS)).toBeNull();
  });
});

describe('the film axes cache document', () => {
  const doc = filmAxesDocFrom(THIEF, THIEF_AXES, 1758240000000);

  it('keys a film by media type and id', () => {
    expect(filmAxesDocId('movie', 10858)).toBe('movie:10858');
    expect(filmAxesDocId('tv', 1396)).toBe('tv:1396');
  });

  it('stores schema, film identity, axes, and createdAt', () => {
    expect(doc).toEqual({
      schema: 1,
      mediaType: 'movie',
      filmId: 10858,
      title: 'Thief',
      year: '1981',
      axes: THIEF_AXES,
      createdAt: 1758240000000,
    });
  });

  it('reads its own document back', () => {
    expect(parseFilmAxesDoc(doc)).toEqual(doc);
  });

  it('rejects malformed cache data', () => {
    expect(parseFilmAxesDoc({ ...doc, schema: 2 })).toBeNull();
    expect(parseFilmAxesDoc({ ...doc, mediaType: 'book' })).toBeNull();
    expect(parseFilmAxesDoc({ ...doc, filmId: '10858' })).toBeNull();
    expect(parseFilmAxesDoc({ ...doc, createdAt: null })).toBeNull();
    expect(parseFilmAxesDoc({ ...doc, axes: THIEF_ROWS.slice(0, 7) })).toBeNull();
    expect(parseFilmAxesDoc('{}')).toBeNull();
  });

  it('reads a document that names the film its path names', () => {
    expect(parseCachedFilmAxes('movie:10858', doc)).toEqual(THIEF_AXES);
  });

  it('refuses a document filed under another film', () => {
    expect(parseCachedFilmAxes('movie:949', doc)).toBeNull();
    expect(parseCachedFilmAxes('tv:10858', doc)).toBeNull();
    expect(parseCachedFilmAxes('movie:10858', { ...doc, filmId: 949 })).toBeNull();
    expect(parseCachedFilmAxes('movie:10858', { ...doc, mediaType: 'tv' })).toBeNull();
  });

  it('refuses malformed data whatever the path', () => {
    expect(parseCachedFilmAxes('movie:10858', { ...doc, schema: 2 })).toBeNull();
    expect(parseCachedFilmAxes('movie:10858', null)).toBeNull();
  });
});

describe('theaterFilmMatchesAxisValue', () => {
  it('meets an axis on one shared word, whatever the case and punctuation', () => {
    expect(
      theaterFilmMatchesAxisValue(
        'sodium-and-cyan night',
        'Because of the night COMPETENCE PORN THE PROFESSIONAL AS MONK. BOTH MEN ARE ALONE BY CHOICE.',
      ),
    ).toBe(true);
    expect(theaterFilmMatchesAxisValue('locked-off', 'A CAB BECOMES A LOCKED-OFF FRAME FOR TWO MEN.')).toBe(true);
  });

  it('spends no match on a stopword the two texts happen to share', () => {
    expect(theaterFilmMatchesAxisValue('two-hander', 'A CAB BECOMES A LOCKED-OFF FRAME FOR TWO MEN.')).toBe(false);
  });

  it('spends no match on a word shorter than three letters', () => {
    expect(theaterFilmMatchesAxisValue('1.85 spherical', 'A 1.85 FRAME')).toBe(false);
    expect(theaterFilmMatchesAxisValue('1.85 spherical', 'SHOT 1.85 SPHERICAL ON KODAK')).toBe(true);
  });

  it('meets nothing when the Theater says nothing about the film', () => {
    expect(theaterFilmMatchesAxisValue('synth pulse', '')).toBe(false);
    expect(theaterFilmMatchesAxisValue('synth pulse', 'THE HEIST RUNS ON A CLOCK AND THE CLOCK RUNS OUT.')).toBe(false);
  });
});

describe('theaterEvidenceByFilm', () => {
  it('gathers one text per distinct film and pools what both Theaters said', () => {
    const evidence = theaterEvidenceByFilm([BECAUSE_OF_THE_NIGHT, LOCKED_OFF_FRAMES]);
    expect(evidence).toHaveLength(5);
    const collateral = evidence.filter((text) => text.includes('MANN AGAIN. SAME CITY LOGIC, TWENTY-THREE YEARS LATER.'));
    expect(collateral).toHaveLength(1);
    expect(collateral[0]).toContain('Because of the night');
    expect(collateral[0]).toContain('Locked-off frames, procedural men');
    expect(collateral[0]).toContain('A CAB BECOMES A LOCKED-OFF FRAME FOR TWO MEN.');
  });
});

describe('deriveUserAxisRows', () => {
  it('counts the kept films whose Theater words meet each axis', () => {
    expect(deriveUserAxisRows(THIEF_AXES, [BECAUSE_OF_THE_NIGHT, LOCKED_OFF_FRAMES])).toEqual([
      { name: 'LOOK', value: 'sodium-and-cyan night', score: 4, count: 4 },
      { name: 'CAMERA', value: 'locked-off', score: 2, count: 2 },
      { name: 'TEMPO', value: 'procedural', score: 5, count: 2 },
      { name: 'WEATHER', value: 'competence porn', score: 4, count: 4 },
      { name: 'SOUND', value: 'synth pulse', score: 2, count: 1 },
      { name: 'WORLD', value: 'rain-slick city night', score: 3, count: 4 },
      { name: 'SHAPE', value: 'two-hander', score: 1, count: 0 },
      { name: 'FORMAT', value: '1.85 spherical', score: 3, count: 0 },
    ]);
  });

  it('counts every axis zero when no Theater is kept', () => {
    expect(deriveUserAxisRows(THIEF_AXES, []).map((row) => row.count)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts a film kept in two Theaters once', () => {
    const twice = deriveUserAxisRows(THIEF_AXES, [
      { ...BECAUSE_OF_THE_NIGHT, films: [BECAUSE_OF_THE_NIGHT.films[1]] },
      { ...LOCKED_OFF_FRAMES, id: 'second', title: 'Synth pulse', films: [BECAUSE_OF_THE_NIGHT.films[1]] },
    ]);
    expect(twice.find((row) => row.name === 'SOUND')?.count).toBe(1);
  });
});

describe('buildFilmAxesPrompt', () => {
  it('states the film, its director, and its genres', () => {
    expect(buildFilmAxesPrompt(THIEF)).toBe(
      [
        '<film>',
        'Thief (1981) | dir. Michael Mann | Crime, Thriller',
        '</film>',
        '<task>',
        'Read this film on all 8 axes in the required order.',
        'Return only the JSON object described in your instructions.',
        '</task>',
      ].join('\n'),
    );
  });

  it('drops an unknown director and an empty genre list', () => {
    expect(buildFilmAxesPrompt({ ...THIEF, director: null, genres: [] })).toContain('Thief (1981)\n</film>');
  });
});

describe('generateFilmAxes', () => {
  it('turns one model envelope into the eight axes', async () => {
    const axes = await generateFilmAxes(THIEF, async () => ({ axes: THIEF_ROWS }));
    expect(axes).toEqual(THIEF_AXES);
  });

  it('yields null on a short model result', async () => {
    expect(await generateFilmAxes(THIEF, async () => ({ axes: THIEF_ROWS.slice(0, 4) }))).toBeNull();
  });

  it('sends the film prompt and the film-axes skill', async () => {
    const received: { prompt: string; system: string }[] = [];
    await generateFilmAxes(THIEF, async (prompt, system) => {
      received.push({ prompt, system });
      return { axes: THIEF_ROWS };
    });
    expect(received).toHaveLength(1);
    expect(received[0].prompt).toBe(buildFilmAxesPrompt(THIEF));
    expect(received[0].system).toBe(loadSkill('film-axes'));
    expect(received[0].system).toContain('LOOK, CAMERA, TEMPO, WEATHER, SOUND, WORLD, SHAPE, FORMAT');
  });
});

describe('filmAxesLlm', () => {
  const llmResponse = (text: string): typeof fetch => async () => new Response(JSON.stringify({ text }), { status: 200 });

  it('spends one call at low reasoning and 500 tokens', async () => {
    const fetchMock = vi.fn(llmResponse(JSON.stringify({ axes: THIEF_ROWS })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await generateFilmAxes(THIEF, filmAxesLlm)).toEqual(THIEF_AXES);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/llm');
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: buildFilmAxesPrompt(THIEF),
      systemPrompt: loadSkill('film-axes'),
      maxTokens: 500,
      reasoningEffort: 'low',
    });
  });

  it('never repairs a malformed result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(llmResponse('{"axes": [{"name": "LOOK", "value": "sodium'));
    vi.stubGlobal('fetch', fetchMock);
    const heat: FilmAxesSubject = { ...THIEF, id: 949, title: 'Heat', year: '1995' };
    expect(await generateFilmAxes(heat, filmAxesLlm)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('loadFilmAxes', () => {
  type Calls = { generated: FilmAxesSubject[]; written: [string, FilmAxesDoc][] };

  function source(overrides: Partial<FilmAxesSource> = {}): FilmAxesSource & { calls: Calls } {
    const calls: Calls = { generated: [], written: [] };
    return {
      calls,
      readCache: async () => null,
      generate: async (subject) => {
        calls.generated.push(subject);
        return THIEF_AXES;
      },
      writeCache: async (filmKey, doc) => {
        calls.written.push([filmKey, doc]);
      },
      now: () => 1758240000000,
      ...overrides,
    };
  }

  it('serves a cached film without generating anything', async () => {
    const deps = source({ readCache: async () => OTHER_AXES });
    expect(await loadFilmAxes(THIEF, deps)).toEqual({ filmKey: 'movie:10858', axes: OTHER_AXES });
    expect(deps.calls.generated).toEqual([]);
    expect(deps.calls.written).toEqual([]);
  });

  it('generates once on a cache miss and writes the document it returned', async () => {
    const deps = source();
    expect(await loadFilmAxes(THIEF, deps)).toEqual({ filmKey: 'movie:10858', axes: THIEF_AXES });
    expect(deps.calls.generated).toEqual([THIEF]);
    expect(deps.calls.written).toEqual([['movie:10858', filmAxesDocFrom(THIEF, THIEF_AXES, 1758240000000)]]);
  });

  it('keeps the generated axes when the cache write is denied', async () => {
    const deps = source({
      writeCache: async () => {
        throw new Error('PERMISSION_DENIED: Missing or insufficient permissions.');
      },
    });
    expect(await loadFilmAxes(THIEF, deps)).toEqual({ filmKey: 'movie:10858', axes: THIEF_AXES });
  });

  it('reports no axes when the model returns nothing', async () => {
    const deps = source({ generate: async () => null });
    expect(await loadFilmAxes(THIEF, deps)).toEqual({ filmKey: 'movie:10858', axes: null });
    expect(deps.calls.written).toEqual([]);
  });

  it('tags a late result with the film that asked for it', async () => {
    const heat: FilmAxesSubject = { ...THIEF, id: 949, title: 'Heat', year: '1995' };
    const slow = source({
      generate: async (subject) =>
        new Promise((resolve) => setTimeout(() => resolve(subject.id === 949 ? OTHER_AXES : THIEF_AXES), 20)),
    });
    const fast = source({ generate: async () => THIEF_AXES });
    const [stale, current] = await Promise.all([loadFilmAxes(heat, slow), loadFilmAxes(THIEF, fast)]);
    expect(stale).toEqual({ filmKey: 'movie:949', axes: OTHER_AXES });
    expect(current).toEqual({ filmKey: 'movie:10858', axes: THIEF_AXES });
  });
});
