import { describe, expect, it } from 'vitest';
import { buildStarters, pickThemes } from './starters';

const blinkTwice = {
  title: 'Blink Twice',
  year: '2024',
  genres: ['Thriller', 'Mystery'],
  director: 'Zoë Kravitz',
  cast: [{ name: 'Naomi Ackie', character: 'Frida' }],
  related: [{ title: 'Get Out' }, { title: 'Infinity Pool' }, { title: 'Barbarian' }],
  keywords: ['rape', 'forgiveness', 'exploitation', 'dark comedy', 'seclusion', 'sexual violence'],
};

describe('ask ai starters', () => {
  it('tailors the Blink Twice starters to its related films, genre and people', () => {
    const texts = buildStarters(blinkTwice).map((s) => s.text);
    expect(texts).toContain('How does Blink Twice compare to Get Out?');
    expect(texts).toContain('How is Blink Twice related to Infinity Pool?');
    expect(texts).toContain('What is the meaning behind Blink Twice?');
    expect(texts).toContain('Pull together some thriller films, starting with Blink Twice');
    expect(texts).toContain('How did Naomi Ackie approach playing Frida?');
  });

  it('never surfaces sensitive keywords as one-tap themes', () => {
    expect(pickThemes(blinkTwice.keywords)).toEqual(['forgiveness', 'exploitation']);
    expect(pickThemes(['based on novel or book', 'sandstorm', 'chosen one', 'destiny', 'vengeance'])).toEqual([
      'destiny',
      'vengeance',
    ]);
    const texts = buildStarters(blinkTwice).map((s) => s.text.toLowerCase());
    expect(texts.some((t) => t.includes('rape') || t.includes('sexual'))).toBe(false);
  });

  it('prefers a collection sibling for the "related to" prompt', () => {
    const texts = buildStarters({
      title: 'Dune: Part Two',
      collection: [{ title: 'Dune' }, { title: 'Dune: Part Two' }],
      related: [{ title: 'Oppenheimer' }],
    }).map((s) => s.text);
    expect(texts).toContain('How is Dune: Part Two related to Dune?');
    expect(texts).toContain('How does Dune: Part Two compare to Oppenheimer?');
  });

  it('ranks frequently asked questions first and dedupes template echoes', () => {
    const starters = buildStarters({
      ...blinkTwice,
      faq: ['What is the meaning behind Blink Twice really?', 'Why does everyone forget on the island?'],
    });
    expect(starters[0].kind).toBe('faq');
    expect(starters[1].kind).toBe('faq');
    expect(starters.filter((s) => /meaning behind/i.test(s.text))).toHaveLength(1);
  });

  it('spreads the first chips across question shapes', () => {
    const top = buildStarters(blinkTwice).slice(0, 4).map((s) => s.kind);
    expect(new Set(top).size).toBe(4);
  });

  it('still gives a bare film tailored starters when metadata is missing', () => {
    const starters = buildStarters({ title: 'Untitled' });
    expect(starters.length).toBeGreaterThanOrEqual(4);
    expect(starters.every((s) => s.text.includes('Untitled'))).toBe(true);
  });

  it('learns from what this user taps', () => {
    const base = buildStarters(blinkTwice).map((s) => s.kind);
    const tuned = buildStarters({ ...blinkTwice, tapHistory: { cast: 5 } }).map((s) => s.kind);
    expect(tuned.indexOf('cast')).toBeLessThan(base.indexOf('cast'));
  });
});
