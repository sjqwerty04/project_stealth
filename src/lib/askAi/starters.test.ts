import { describe, expect, it } from 'vitest';
import { MAX_STARTERS, buildStarters, noEmDash, resolveVisibleStarters, visibleStarters, type FilmRef, type Starter } from './starters';

const ref = (id: number, title: string, year?: string): FilmRef => ({ id, title, year, posterPath: `/${id}.jpg` });
const blinkTwice = ref(840705, 'Blink Twice', '2024');
const getOut = ref(419430, 'Get Out', '2017');

const input = {
  film: blinkTwice,
  related: [getOut, ref(667216, 'Infinity Pool'), ref(1, 'Barbarian')],
};

describe('ask ai starters', () => {
  it('keeps a question only when it opens a specific claim, and posters only for titles it names', () => {
    const starters = buildStarters({
      ...input,
      questions: [
        {
          text: 'What did the island have to do with that summer?',
          brief: 'People read the island as the news of that year, not as a vacation.',
        },
        { text: 'Blink Twice vs Get Out: which one hits harder?', films: [blinkTwice, getOut] },
        { text: "Is this Zoë Kravitz's best work?" },
        { text: 'Okay, what is Blink Twice actually about?' },
        {
          text: 'Is the party doing what Get Out did?',
          films: [blinkTwice, getOut, ref(1, 'Barbarian')],
          brief: 'The dinner scenes got compared to the Armitage house.',
        },
        {
          text: 'Blink Twice and Get Out, same house different decade?',
          films: [getOut, blinkTwice],
          brief: 'People put the two dinners next to each other.',
        },
      ],
    });
    expect(starters.map((s) => s.text)).toEqual([
      'What did the island have to do with that summer?',
      'Is the party doing what Get Out did?',
      'Blink Twice and Get Out, same house different decade?',
    ]);
    expect(starters[0].films).toEqual([]);
    expect(starters[0].brief).toMatch(/island/);
    expect(starters[1].films.map((f) => f.title)).toEqual(['Get Out']);
    expect(starters[2].films.map((f) => f.title)).toEqual(['Blink Twice', 'Get Out']);
  });

  it('does not invent questions from metadata', () => {
    expect(buildStarters(input)).toEqual([]);
    expect(buildStarters({ film: ref(9, 'Untitled') })).toEqual([]);
  });

  it('caps the set at five plus one gated spoiler', () => {
    const llm = Array.from({ length: 7 }, (_, i) => ({
      text: `What is detail ${i} that only this cut mentions?`,
      brief: `Detail ${i}.`,
      spoiler: i === 6,
    }));
    const starters = buildStarters({ film: blinkTwice, questions: llm });
    expect(starters.filter((s) => !s.spoiler)).toHaveLength(MAX_STARTERS);
    expect(starters.filter((s) => s.spoiler)).toHaveLength(1);
  });

  it('hides the spoiler starter until the film is logged', () => {
    const starters = buildStarters({
      film: blinkTwice,
      questions: [
        { text: 'Why does the champagne never stop?', brief: 'The pour is the image people keep posting.' },
        { text: 'What was actually in the gift bags?', brief: 'The bags are the argument.', spoiler: true },
      ],
    });
    expect(visibleStarters(starters, false).some((s) => s.spoiler)).toBe(false);
    const logged = visibleStarters(starters, true);
    expect(logged[0].spoiler).toBe(true);
    expect(logged).toHaveLength(2);
  });

  it('strips em dashes and does not keep a canned echo of a real question', () => {
    const starters = buildStarters({
      film: blinkTwice,
      questions: [
        { text: 'Why does nobody on the island remember the night \u2014 any of it?' },
        { text: 'Blink Twice vs Get Out \u2014 which one hits harder?', films: [blinkTwice, getOut] },
      ],
    });
    expect(starters).toHaveLength(1);
    expect(starters[0].text).toBe('Why does nobody on the island remember the night, any of it?');
  });

  it('asks different films different questions', () => {
    const blink = buildStarters({
      film: blinkTwice,
      questions: [{ text: 'What did the island have to do with that summer?', brief: 'The news.' }],
    });
    const dune = buildStarters({
      film: ref(693134, 'Dune: Part Two', '2024'),
      questions: [{ text: 'Why does the spice look like that on Arrakis?', brief: 'The color.' }],
    });
    expect(blink[0].text).not.toBe(dune[0].text);
    expect(blink[0].text).not.toMatch(/Dune/);
    expect(dune[0].text).not.toMatch(/Blink Twice/);
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
  kind: 'llm',
  score: 1,
  films: [],
  spoiler,
});

describe('resolveVisibleStarters', () => {
  const base = {
    shown: null,
    local: null,
    server: null,
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

  it('does not paint a row until discourse arrives, then locks it', () => {
    expect(resolveVisibleStarters(base)).toBeNull();
    const painted = resolveVisibleStarters({ ...base, server: [row('island')] })!;
    expect(painted.map((s) => s.text)).toEqual(['island']);
    const stuck = resolveVisibleStarters({ ...base, shown: painted, server: [row('later')] });
    expect(stuck).toBe(painted);
  });

  it('treats an empty discourse set as a real row', () => {
    expect(resolveVisibleStarters({ ...base, server: [] })).toEqual([]);
  });
});
