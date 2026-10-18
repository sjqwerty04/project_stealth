import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CALL_CAP_MS, TEXT_QUESTION, VOICE_NAME, WRAP_UP_MS, instructionsFor, sessionUpdate } from './sessionPlan';

describe('Liora session plan', () => {
  it('uses Liora, barge-in, a 10 minute cap, and the text question', () => {
    const session = sessionUpdate([{ title: 'Heat', reason: 'the telephoto across the street' }]);
    expect(session.voice).toBe(VOICE_NAME);
    expect(session.turn_detection).toMatchObject({
      type: 'server_vad',
      create_response: true,
      interrupt_response: true,
    });
    expect(CALL_CAP_MS).toBe(10 * 60 * 1000);
    expect(WRAP_UP_MS).toBe(8 * 60 * 1000);
    expect(session.instructions).toContain('Hey this is selects... um sooo what do you want to watch?');
    expect(session.instructions).toContain(TEXT_QUESTION);
    expect(session.instructions).toContain('Heat: the telephoto across the street');
    expect(session.instructions).toContain('say the title out loud as ordinary words');
    expect(session.instructions).toContain('A tool call is not saying it');
    expect(session.instructions).toContain('have not seen and they want to watch');
    expect(session.instructions).toContain('Do not keep interviewing once you can pick');
    expect(session.instructions).toContain('Call web_search with that title before you answer');
    expect(session.instructions).not.toContain('say it again');
    expect(session.instructions).not.toContain('before you suggest anything');
    expect(session.instructions).not.toMatch(/[—–]/);
    expect(session.tools.map((tool) => ('name' in tool ? tool.name : tool.type))).toEqual([
      'web_search',
      'remember_film',
      'note_suggestion',
      'save_picks',
    ]);
  });

  it('keeps a first-time caller on the base script', () => {
    expect(instructionsFor()).not.toContain('called before');
    expect(instructionsFor()).toContain('Hey this is selects... um sooo what do you want to watch?');
  });

  it('names the last film when the caller has been here before', () => {
    const text = instructionsFor([], 'Sicario');
    expect(text).toContain('Hey, it\'s nice to see you again. Did you like Sicario?');
    expect(text).toContain('Do not use the first-time opening.');
    expect(text).not.toMatch(/[—–]/);
  });

  it('the sandbox runner enforces the same cap and does not embed a key', () => {
    const src = readFileSync(new URL('../../../voice/session.mjs', import.meta.url), 'utf8');
    expect(src).toContain('10 * 60 * 1000');
    expect(src).toContain('8 * 60 * 1000');
    expect(src).not.toMatch(/xai-[A-Za-z0-9]/);
    expect(src).not.toMatch(/[—–]/);
  });
});
