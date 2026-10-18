import { describe, expect, it } from 'vitest';
import { toE164 } from './phone';

describe('toE164', () => {
  it('accepts a real number with or without punctuation', () => {
    expect(toE164('+1 202 555 0100')).toBe('+12025550100');
    expect(toE164('(202) 555-0100')).toBe('+12025550100');
    expect(toE164('+12315257644')).toBe('+12315257644');
  });

  it('rejects blanks and strings that are not phone numbers', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('   ')).toBeNull();
    expect(toE164('555')).toBeNull();
    expect(toE164('not a phone')).toBeNull();
    expect(toE164('123')).toBeNull();
  });
});
