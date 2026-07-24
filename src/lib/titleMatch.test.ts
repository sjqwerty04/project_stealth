import { describe, expect, it } from 'vitest';
import { buildSeenKeys, isSeen, stripYearSuffix, titleKey } from './titleMatch';

describe('titleKey', () => {
  it('ignores casing, punctuation, and spacing', () => {
    expect(titleKey('The Grand Budapest Hotel')).toBe(titleKey('the grand budapest hotel'));
    expect(titleKey('WALL·E')).toBe(titleKey('Wall-E'));
    expect(titleKey('Amélie')).toBe(titleKey('amelie'));
    expect(titleKey('Spider-Man: No Way Home')).toBe(titleKey('spider man no way home'));
  });

  it('keeps distinct titles distinct', () => {
    expect(titleKey('Heat')).not.toBe(titleKey('Heats'));
    expect(titleKey('Dune')).not.toBe(titleKey('Dune Part Two'));
  });

  it('tolerates empty input', () => {
    expect(titleKey('')).toBe('');
  });
});

describe('stripYearSuffix', () => {
  it('removes a trailing year', () => {
    expect(stripYearSuffix('Parasite (2019)')).toBe('Parasite');
    expect(stripYearSuffix('Parasite ()')).toBe('Parasite');
  });

  it('leaves titles whose parentheses are not a trailing suffix alone', () => {
    expect(stripYearSuffix('Kill Bill: Vol. 1')).toBe('Kill Bill: Vol. 1');
  });
});

describe('buildSeenKeys / isSeen', () => {
  const seen = buildSeenKeys([
    'Parasite (2019)',
    'The Grand Budapest Hotel (2014)',
    'WALL·E (2008)',
    'Amélie (2001)',
  ]);

  it('matches regardless of how the title is punctuated or cased', () => {
    expect(isSeen('parasite', seen)).toBe(true);
    expect(isSeen('The Grand Budapest Hotel', seen)).toBe(true);
    expect(isSeen('Wall-E', seen)).toBe(true);
    expect(isSeen('Amelie', seen)).toBe(true);
  });

  it('does not match unwatched titles', () => {
    expect(isSeen('Memories of Murder', seen)).toBe(false);
    expect(isSeen('Moonrise Kingdom', seen)).toBe(false);
  });

  it('treats missing titles as unseen rather than throwing', () => {
    expect(isSeen(undefined, seen)).toBe(false);
    expect(isSeen(null, seen)).toBe(false);
    expect(isSeen('', seen)).toBe(false);
  });

  it('matches a remake by title alone, which is the intended trade-off', () => {
    const seenDune = buildSeenKeys(['Dune (2021)']);
    expect(isSeen('Dune', seenDune)).toBe(true);
  });

  it('ignores entries that are only a year suffix', () => {
    expect(buildSeenKeys(['(2019)', '']).size).toBe(0);
  });
});
