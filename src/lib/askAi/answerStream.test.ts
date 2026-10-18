import { describe, expect, it } from 'vitest';
import { clampSentences, createAnswerStream, ENTITY_SENTINEL } from './answerStream';

function run(chunks: string[]) {
  const s = createAnswerStream();
  const shown = chunks.map((c) => s.push(c)).join('');
  return { shown, ...s.finish() };
}

describe('answer stream', () => {
  it('never shows an em dash, even split across chunks', () => {
    const { shown, text } = run(['It is sharper ', '\u2014', ' and meaner', ' than Get Out.']);
    expect(shown).toBe('It is sharper, and meaner than Get Out.');
    expect(text).toBe(shown);
  });

  it('hides the entity block and parses it', () => {
    const { shown, text, entities } = run([
      'Kravitz nails it.',
      '\n<<ENT',
      'ITIES>>{"films":[{"title":"Get Out","year":"2017"}],',
      '"people":["Zoë Kravitz"]}',
    ]);
    expect(shown).toBe('Kravitz nails it.');
    expect(text).toBe('Kravitz nails it.');
    expect(entities).toEqual({ films: [{ title: 'Get Out', year: '2017' }], people: ['Zoë Kravitz'] });
  });

  it('survives a malformed entity block', () => {
    const { text, entities } = run([`Short answer.${ENTITY_SENTINEL}{oops`]);
    expect(text).toBe('Short answer.');
    expect(entities).toEqual({});
  });

  it('streams text with no sentinel at all', () => {
    expect(run(['Just ', 'text.']).shown).toBe('Just text.');
  });

  it('stops after three sentences and still parses entities', () => {
    const { shown, text, entities } = run([
      'One. Two. Three. Four is too many.',
      `${ENTITY_SENTINEL}{"films":[{"title":"Get Out"}],"people":[]}`,
    ]);
    expect(clampSentences('One. Two. Three. Four.')).toBe('One. Two. Three.');
    expect(shown).toBe('One. Two. Three.');
    expect(text).toBe('One. Two. Three.');
    expect(entities.films?.[0].title).toBe('Get Out');
  });
});
