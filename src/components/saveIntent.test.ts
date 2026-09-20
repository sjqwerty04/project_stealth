import { describe, expect, it } from 'vitest';
import { openSavePicker } from './saveIntent';

describe('openSavePicker', () => {
  it('opens the picker and publishes one save intent, in that order', () => {
    const calls: string[] = [];
    openSavePicker({
      openPicker: () => calls.push('picker'),
      onSaveIntent: () => calls.push('intent'),
    });
    expect(calls).toEqual(['picker', 'intent']);
  });

  it('publishes one intent per press', () => {
    let intents = 0;
    const deps = { openPicker: () => {}, onSaveIntent: () => (intents += 1) };
    openSavePicker(deps);
    openSavePicker(deps);
    expect(intents).toBe(2);
  });

  it('still opens the picker where no caller is listening', () => {
    let opened = 0;
    openSavePicker({ openPicker: () => (opened += 1) });
    expect(opened).toBe(1);
  });
});
