import { describe, expect, it } from 'vitest';
import { AI_SEARCH_MAX_TOKENS, AI_SEARCH_MODEL, AI_SEARCH_REASONING, AI_SEARCH_SERVICE_TIER, AI_SEARCH_SYSTEM, buildAiSearchPrompt, takeFilmTitles } from './aiSearch';

describe('ai film search', () => {
  it('uses grok 4.7 low reasoning, priority, and a token cap', () => {
    expect(AI_SEARCH_MODEL).toBe('grok-4.7');
    expect(AI_SEARCH_REASONING).toBe('low');
    expect(AI_SEARCH_SERVICE_TIER).toBe('priority');
    expect(AI_SEARCH_MAX_TOKENS).toBeLessThanOrEqual(512);
    expect(AI_SEARCH_SYSTEM.length).toBeLessThan(16);
  });

  it('leads with one hit, then asks the list to spread out', () => {
    const prompt = buildAiSearchPrompt('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('1=obvious');
    expect(prompt).toContain('Vary decade');
    expect(prompt).toContain('"t"');
    expect(prompt).not.toContain('```');
    expect(prompt.length).toBeLessThan(280);
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

  it('reads short keys and the longer title and year keys', () => {
    expect(takeFilmTitles('[{"t":"Heat","y":1995}]').titles).toEqual([{ title: 'Heat', year: '1995' }]);
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
