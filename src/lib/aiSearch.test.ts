import { describe, expect, it } from 'vitest';
import { AI_SEARCH_MAX_TOKENS, AI_SEARCH_MODEL, AI_SEARCH_REASONING, AI_SEARCH_SYSTEM, buildAiSearchPrompt, buildRecencyPrompt, takeFilmTitles } from './aiSearch';

describe('ai film search', () => {
  it('uses grok 4.3 with reasoning off and a token cap', () => {
    expect(AI_SEARCH_MODEL).toBe('grok-4.3');
    expect(AI_SEARCH_REASONING).toBe('none');
    expect(AI_SEARCH_MAX_TOKENS).toBeLessThanOrEqual(512);
    expect(AI_SEARCH_SYSTEM.length).toBeLessThan(24);
  });

  it('asks the later pass only for films from the last 18 months', () => {
    const prompt = buildRecencyPrompt('Brad Pitt survival films with a combat dog');
    expect(prompt).toContain('Brad Pitt survival films with a combat dog');
    expect(prompt).toContain('last 18 months');
    expect(prompt).not.toContain('Heart of the Beast');
  });

  it('leads with one hit, then asks the list to spread out', () => {
    const prompt = buildAiSearchPrompt('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('Tom Cruise action films with a little comedy');
    expect(prompt).toContain('1=obvious');
    expect(prompt).toContain('Vary decade');
    expect(prompt).toContain('real films');
    expect(prompt).toContain('"t"');
    expect(prompt).not.toContain('```');
    expect(prompt.length).toBeLessThan(320);
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
