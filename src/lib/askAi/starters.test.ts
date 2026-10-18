import { describe, expect, it } from 'vitest';
import { MAX_STARTERS, buildStarters, noEmDash, pickThemes, resolveVisibleStarters, visibleStarters, type FilmRef, type Starter } from './starters';

const ref = (id: number, title: string, year?: string): FilmRef => ({ id, title, year, posterPath: `/${id}.jpg` });
const blinkTwice = ref(840705, 'Blink Twice', '2024');
const getOut = ref(419430, 'Get Out', '2017');

const input = {
  film: blinkTwice,
  genres: ['Thriller', 'Mystery'],
  director: 'Zoë Kravitz',
  cast: [{ name: 'Naomi Ackie', character: 'Frida' }],
  related: [getOut, ref(667216, 'Infinity Pool'), ref(1, 'Barbarian')],
  keywords: ['rape', 'forgiveness', 'exploitation', 'dark comedy', 'seclusion', 'sexual violence'],
};

describe('ask ai starters', () => {
  it('writes punchy, film-specific fallbacks and tags every film they name', () => {
    const starters = buildStarters(input);
    const compare = starters.find((s) => s.kind === 'compare')!;
    expect(compare.text).toBe('Blink Twice vs Get Out: which one hits harder?');
    expect(compare.films.map((f) => f.title)).toEqual(['Blink Twice', 'Get Out']);
    expect(starters.map((s) => s.text)).toContain('Is this Zoë Kravitz\'s best work?');
  });

  it('caps the set at five plus one gated spoiler', () => {
    const starters = buildStarters(input);
    expect(starters.filter((s) => !s.spoiler)).toHaveLength(MAX_STARTERS);
    expect(starters.filter((s) => s.spoiler)).toHaveLength(1);
  });

  it('hides the spoiler starter until the film is logged', () => {
    const starters = buildStarters(input);
    expect(visibleStarters(starters, false).some((s) => s.spoiler)).toBe(false);
    const logged = visibleStarters(starters, true);
    expect(logged).toHaveLength(MAX_STARTERS);
    expect(logged[0].spoiler).toBe(true);
  });

  it('never surfaces sensitive keywords as themes', () => {
    expect(pickThemes(input.keywords, 2)).toEqual(['forgiveness', 'exploitation']);
    expect(pickThemes(['based on novel or book', 'sandstorm', 'chosen one', 'destiny'])).toEqual(['destiny']);
  });

  it('asks about the earlier collection entry', () => {
    const dune2 = ref(693134, 'Dune: Part Two', '2024');
    const starters = buildStarters({ film: dune2, collection: [ref(438631, 'Dune', '2021'), dune2] });
    const related = starters.find((s) => s.kind === 'related')!;
    expect(related.text).toBe('Do I need to see Dune before Dune: Part Two?');
    expect(related.films.map((f) => f.id)).toEqual([438631, 693134]);
  });

  it('puts LLM questions first, strips their em dashes, and drops template echoes', () => {
    const starters = buildStarters({
      ...input,
      llm: [
        { text: 'Blink Twice vs Get Out \u2014 which one hits harder?', films: [blinkTwice, getOut] },
        { text: 'Why does nobody on the island remember anything?' },
      ],
    });
    expect(starters[0].kind).toBe('llm');
    expect(starters[0].text).toBe('Blink Twice vs Get Out, which one hits harder?');
    expect(starters.filter((s) => /hits harder/.test(s.text))).toHaveLength(1);
  });

  it('gives a bare film enough starters', () => {
    expect(buildStarters({ film: ref(9, 'Untitled') }).filter((s) => !s.spoiler).length).toBeGreaterThanOrEqual(3);
  });

  it('learns from what this user taps', () => {
    const base = buildStarters(input).map((s) => s.kind);
    const tuned = buildStarters({ ...input, tapHistory: { theme: 5 } }).map((s) => s.kind);
    expect(base).not.toContain('theme');
    expect(tuned).toContain('theme');
  });

  it('rewrites em dashes into commas', () => {
    expect(noEmDash('Sharp \u2014 and mean.')).toBe('Sharp, and mean.');
    expect(noEmDash('A\u2014B')).toBe('A, B');
    expect(noEmDash('2019 \u2013 2021')).toBe('2019, 2021');
  });
});

const row = (text: string, spoiler = false): Starter => ({
  id: text,
  text,
  kind: spoiler ? 'ending' : 'meaning',
  score: 1,
  films: [],
  spoiler,
});

describe('resolveVisibleStarters', () => {
  const base = {
    shown: null,
    local: null,
    server: null,
    templates: [row('template')],
    metaReady: false,
    graceElapsed: false,
    hasLogged: true,
    logKnown: true,
  };

  it('paints a cached set immediately and keeps the spoiler only once logging is known', () => {
    const local = [row('cached'), row('ending', true)];
    expect(resolveVisibleStarters({ ...base, local, logKnown: false, hasLogged: true })).toBeNull();
    expect(resolveVisibleStarters({ ...base, local, logKnown: true, hasLogged: false })!.some((s) => s.spoiler)).toBe(false);
    expect(resolveVisibleStarters({ ...base, local, logKnown: true, hasLogged: true })![0].spoiler).toBe(true);
  });

  it('holds templates for compare targets, then locks them so a late server set cannot reshuffle', () => {
    expect(resolveVisibleStarters(base)).toBeNull();
    const painted = resolveVisibleStarters({ ...base, metaReady: true })!;
    expect(painted.map((s) => s.text)).toEqual(['template']);
    const stuck = resolveVisibleStarters({ ...base, shown: painted, server: [row('llm')] });
    expect(stuck).toBe(painted);
  });

  it('lets a fast server set beat templates', () => {
    const visible = resolveVisibleStarters({ ...base, server: [row('llm')], metaReady: true });
    expect(visible!.map((s) => s.text)).toEqual(['llm']);
  });
});
