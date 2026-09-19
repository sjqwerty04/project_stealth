import { describe, expect, it } from 'vitest';
import { apiUrlFor, PROD_ORIGIN } from './apiUrl';

describe('apiUrlFor', () => {
  it('keeps a relative path on web', () => {
    expect(apiUrlFor('/api/llm', false)).toBe('/api/llm');
  });

  it('prefixes production origin on native', () => {
    expect(apiUrlFor('/api/llm', true)).toBe(`${PROD_ORIGIN}/api/llm`);
  });

  it('normalizes a path without a leading slash', () => {
    expect(apiUrlFor('api/movie-lookup?title=Heat', true)).toBe(
      `${PROD_ORIGIN}/api/movie-lookup?title=Heat`
    );
  });
});
