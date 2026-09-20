import { describe, expect, it } from 'vitest';
import { libraryRows, type LibraryCounts } from './libraryRows';

const COUNTS: LibraryCounts = {
  watched: 312,
  wallet: 9,
  saved: 24,
  theaters: 6,
  sharedLists: 3,
  sharedPeople: 5,
};

describe('libraryRows', () => {
  it('lists the five Figma rows in order with their routes', () => {
    expect(libraryRows(COUNTS).map((row) => [row.label, row.to])).toEqual([
      ['Watched', '/watched#timeline'],
      ['The Wallet', '/liked'],
      ['Saved', '/saved'],
      ['Theaters', '/theaters'],
      ['Shared lists', '/shared'],
    ]);
  });

  it('writes each metadata line from the live counts', () => {
    expect(libraryRows(COUNTS).map((row) => row.meta)).toEqual([
      '312 FILMS',
      '9 FILMS CLOSEST TO YOU',
      '24 WAITING',
      '6 FACETS YOU KEPT',
      '3 LISTS · 5 PEOPLE',
    ]);
  });

  it('writes every singular form at a count of one', () => {
    const rows = libraryRows({ watched: 1, wallet: 1, saved: 1, theaters: 1, sharedLists: 1, sharedPeople: 1 });
    expect(rows.map((row) => row.meta)).toEqual([
      '1 FILM',
      '1 FILM CLOSEST TO YOU',
      '1 WAITING',
      '1 FACET YOU KEPT',
      '1 LIST · 1 PERSON',
    ]);
  });

  it('writes every plural form at a count of two', () => {
    const rows = libraryRows({ watched: 2, wallet: 2, saved: 2, theaters: 2, sharedLists: 2, sharedPeople: 2 });
    expect(rows.map((row) => row.meta)).toEqual([
      '2 FILMS',
      '2 FILMS CLOSEST TO YOU',
      '2 WAITING',
      '2 FACETS YOU KEPT',
      '2 LISTS · 2 PEOPLE',
    ]);
  });

  it('reads zero for an empty library', () => {
    const rows = libraryRows({ watched: 0, wallet: 0, saved: 0, theaters: 0, sharedLists: 0, sharedPeople: 0 });
    expect(rows.map((row) => row.meta)).toEqual([
      '0 FILMS',
      '0 FILMS CLOSEST TO YOU',
      '0 WAITING',
      '0 FACETS YOU KEPT',
      '0 LISTS · 0 PEOPLE',
    ]);
  });
});
