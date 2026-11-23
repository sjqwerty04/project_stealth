import { describe, expect, it } from 'vitest';
import { libraryRows } from './LibraryHub';

describe('libraryRows', () => {
  it('keeps every current library route', () => {
    expect(libraryRows.map((row) => row.to)).toEqual([
      '/watched',
      '/liked',
      '/saved',
      '/watchlist',
      '/shared',
      '/vibes',
    ]);
  });
});
