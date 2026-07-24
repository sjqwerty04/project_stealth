import { describe, expect, it } from 'vitest';
import { extractJSON } from './claude';

describe('extractJSON', () => {
  it('parses a bare object', () => {
    expect(extractJSON('{"title":"Heat","year":"1995"}')).toEqual({ title: 'Heat', year: '1995' });
  });

  it('parses a bare array of objects', () => {
    expect(
      extractJSON('[{"title":"Heat","year":"1995"},{"title":"Collateral","year":"2004"}]')
    ).toEqual([
      { title: 'Heat', year: '1995' },
      { title: 'Collateral', year: '2004' },
    ]);
  });

  // Regression: matching /\{[\s\S]*\}/ first turned an array of objects into
  // `{...}, {...}`, which is not valid JSON. Every array-shaped prompt was
  // silently falling through to a repair retry, costing an extra LLM round trip.
  it('does not mangle an array into a bare object', () => {
    const result = extractJSON('[{"title":"A"},{"title":"B"}]');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('parses an object that contains an array', () => {
    expect(extractJSON('{"picks":[{"title":"Heat"}]}')).toEqual({ picks: [{ title: 'Heat' }] });
  });

  it('unwraps a markdown code block', () => {
    expect(extractJSON('```json\n[{"title":"Heat"}]\n```')).toEqual([{ title: 'Heat' }]);
  });

  it('ignores prose surrounding the payload', () => {
    expect(
      extractJSON('Sure! Here is the result:\n[{"title":"Heat"}]\nHope that helps.')
    ).toEqual([{ title: 'Heat' }]);
  });

  it('tolerates a trailing comma', () => {
    expect(extractJSON('[{"title":"Heat"},]')).toEqual([{ title: 'Heat' }]);
  });

  it('returns null for unparseable input', () => {
    expect(extractJSON('no json at all')).toBeNull();
    expect(extractJSON('')).toBeNull();
  });
});
