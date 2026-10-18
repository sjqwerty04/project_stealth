import { describe, expect, it } from 'vitest';
import { AI_SEARCH_MAX_TOKENS, AI_SEARCH_MODEL, AI_SEARCH_REASONING, buildAiSearchPrompt, takeFilmTitles } from './aiSearch';

describe('ai film search', () => {
  it('keeps the model on a small budget with reasoning off', () => {
    expect(AI_SEARCH_MODEL).toBe('grok-4.3');
    expect(AI_SEARCH_REASONING).toBe('none');
    expect(AI_SEARCH_MAX_TOKENS).toBeLessThanOrEqual(480);
  });

  it('asks for a JSON array and nothing else', () => {
    const prompt = buildAiSearchPrompt('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('JSON array');
    expect(prompt).not.toContain('```');
  });

  it('yields each film as soon as its object closes', () => {
    const chunks = [
      '[',
      '{"title":"Edge of Tomorrow","year":"2014"}',
      ',{"title":"Knight and Day","ye',
      'ar":"2010"}]',
    ];
    let pending = '';
    const found: { title: string; year: string }[] = [];
    for (const chunk of chunks) {
      pending += chunk;
      const next = takeFilmTitles(pending);
      found.push(...next.titles);
      pending = next.rest;
    }
    expect(found).toEqual([
      { title: 'Edge of Tomorrow', year: '2014' },
      { title: 'Knight and Day', year: '2010' },
    ]);
    expect(pending).toBe('');
  });

  it('reads a fenced array and numeric years', () => {
    const text = '```json\n[{"title":"Heat","year":1995}]\n```';
    expect(takeFilmTitles(text).titles).toEqual([{ title: 'Heat', year: '1995' }]);
  });

  it('holds an unfinished object', () => {
    const next = takeFilmTitles('[{"title":"He');
    expect(next.titles).toEqual([]);
    expect(next.rest).toBe('{"title":"He');
  });
});
