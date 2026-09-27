import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
}));

import { Capacitor } from '@capacitor/core';
import { apiUrl } from './apiOrigin';

describe('apiUrl', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
  });

  it('keeps a web path relative', () => {
    expect(apiUrl('/api/llm')).toBe('/api/llm');
  });

  it('points an iOS path at production', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    expect(apiUrl('/api/your-selects')).toBe('https://selects-film.vercel.app/api/your-selects');
    expect(apiUrl('/api/movie-lookup?title=Heat')).toBe(
      'https://selects-film.vercel.app/api/movie-lookup?title=Heat',
    );
  });

  it('leaves an absolute url alone on iOS', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    expect(apiUrl('https://api.themoviedb.org/3/movie/1')).toBe('https://api.themoviedb.org/3/movie/1');
  });
});
