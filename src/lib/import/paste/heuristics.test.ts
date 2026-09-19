import { describe, expect, it } from 'vitest';
import { bucketFor, bundleFromList, parseListLine, parseListText } from './heuristics';

describe('parseListLine', () => {
  it('strips bullets, numbering, quotes, and pulls year and stars', () => {
    expect(parseListLine('1. Heat (1995) ★★★★½')).toEqual({ title: 'Heat', year: '1995', stars: 4.5, struck: false, raw: '1. Heat (1995) ★★★★½' });
    expect(parseListLine('- "Drive" 2011 - 4/5')).toMatchObject({ title: 'Drive', year: '2011', stars: 4 });
    expect(parseListLine('• Her, 2013 8/10')).toMatchObject({ title: 'Her', year: '2013', stars: 4 });
    expect(parseListLine('Tron 1982 - 1.5')).toMatchObject({ title: 'Tron', year: '1982', stars: 1.5 });
    expect(parseListLine('Whiplash (2014) *****')).toMatchObject({ title: 'Whiplash', year: '2014', stars: 5 });
    expect(parseListLine('Sicario *** 2015')).toMatchObject({ title: 'Sicario', year: '2015', stars: 3 });
    expect(parseListLine('Conclave')).toMatchObject({ title: 'Conclave', year: undefined, stars: undefined, struck: false });
  });

  it('detects struck, checked, and seen items', () => {
    expect(parseListLine('~~Heat (1995)~~')).toMatchObject({ title: 'Heat', struck: true });
    expect(parseListLine('- [x] Drive')).toMatchObject({ title: 'Drive', struck: true });
    expect(parseListLine('- [ ] Sicario')).toMatchObject({ title: 'Sicario', struck: false });
    expect(parseListLine('✓ Her')).toMatchObject({ title: 'Her', struck: true });
    expect(parseListLine('H̶e̶a̶t̶')).toMatchObject({ title: 'Heat', struck: true });
    expect(parseListLine('Whiplash (watched)')).toMatchObject({ title: 'Whiplash', struck: true });
    expect(parseListLine('<s>Tron</s>')).toMatchObject({ title: 'Tron', struck: true });
  });

  it('drops junk lines', () => {
    expect(parseListLine('')).toBeNull();
    expect(parseListLine('3')).toBeNull();
    expect(parseListLine('- ')).toBeNull();
  });
});

describe('parseListText', () => {
  it('reads a Notes to-watch list with strikethrough as watchlist with struck items watched', () => {
    const parsed = parseListText(`Movies to watch:\n~~Heat~~\nSicario\n- Whiplash (2014)\nH̶e̶r̶`);
    expect(parsed.header).toBe('Movies to watch');
    expect(parsed.intent).toBe('watchlist');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.9);
    expect(parsed.items.map((i) => [i.title, i.struck])).toEqual([
      ['Heat', true],
      ['Sicario', false],
      ['Whiplash', false],
      ['Her', true],
    ]);
    expect(bucketFor(parsed.items[0], parsed.intent)).toBe('watched');
    expect(bucketFor(parsed.items[1], parsed.intent)).toBe('watchlist');
  });

  it('reads a ranked list with stars as watched', () => {
    const parsed = parseListText(`1. Heat (1995) ★★★★★\n2. Drive (2011) ★★★★\n3. Tron (1982) ★½`);
    expect(parsed.intent).toBe('watched');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.85);
    expect(parsed.items.map((i) => i.stars)).toEqual([5, 4, 1.5]);
  });

  it('reads a markdown checklist', () => {
    const parsed = parseListText(`## Watchlist\n- [x] Heat\n- [ ] Sicario\n- [ ] Whiplash`);
    expect(parsed.intent).toBe('watchlist');
    expect(parsed.items.filter((i) => i.struck).map((i) => i.title)).toEqual(['Heat']);
  });

  it('reads a "seen" header as watched', () => {
    const parsed = parseListText(`Films I have seen\nHeat\nDrive`);
    expect(parsed.intent).toBe('watched');
    expect(parsed.items.length).toBe(2);
  });

  it('is unknown for bare titles', () => {
    const parsed = parseListText(`Heat\nDrive\nHer`);
    expect(parsed.intent).toBe('unknown');
    expect(parsed.confidence).toBeLessThan(0.6);
    expect(parsed.header).toBeUndefined();
    expect(parsed.items.length).toBe(3);
  });

  it('treats a fully struck bare list as watched', () => {
    const parsed = parseListText(`~~Heat~~\n~~Drive~~`);
    expect(parsed.intent).toBe('watched');
  });

  it('does not swallow a first film as a header', () => {
    const parsed = parseListText(`Heat (1995)\nDrive (2011)`);
    expect(parsed.header).toBeUndefined();
    expect(parsed.items.length).toBe(2);
  });
});

describe('bundleFromList', () => {
  it('splits items into films and watchlist, honours overrides, and dedupes', () => {
    const parsed = parseListText(`To watch:\n~~Heat (1995)~~ 5/5\nSicario\nSicario\nWhiplash`);
    const overrides = new Map([['whiplash|', 'watched' as const]]);
    const bundle = bundleFromList(parsed.items, parsed.intent, 'paste', overrides);
    expect(bundle.source).toBe('paste');
    expect(bundle.films).toEqual([
      { title: 'Heat', year: '1995', stars: 5, watched: true },
      { title: 'Whiplash', year: undefined, stars: undefined, watched: true },
    ]);
    expect(bundle.watchlist).toEqual([{ title: 'Sicario', year: undefined }]);
    expect(bundle.meta.counts).toEqual({ films: 2, watchlist: 1 });
  });
});
