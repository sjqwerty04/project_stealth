import { describe, expect, it, vi } from 'vitest';
import { executeSelectReplacement, replacePickAtSlot } from './selectReplacement';

type Pick = { movieId: number; title: string };
type RawPick = { title: string; id: string };

const picks: [Pick, Pick, Pick] = [
  { movieId: 1, title: 'Heat' },
  { movieId: 2, title: 'Zodiac' },
  { movieId: 3, title: 'Thief' },
];

describe('select replacement', () => {
  it('patches one stable slot without changing its siblings', () => {
    expect(replacePickAtSlot(picks, 1, { movieId: 4, title: 'Manhunter' })).toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);
  });

  it('excludes every visible card and persists one replacement', async () => {
    const requestPick = vi.fn(async () => [{ title: 'Manhunter', id: '4' }]);
    const persistPicks = vi.fn(async () => {});

    const next = await executeSelectReplacement<Pick, RawPick, { profile: string }>({
      slotId: 1,
      picks,
      extraExcluded: [{ id: '263115', title: 'Logan' }],
      feedbackSaved: true,
      saveFeedback: vi.fn(async () => {}),
      onFeedbackSaved: vi.fn(),
      readContext: async () => ({ profile: 'crime' }),
      requestPicks: requestPick,
      hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
      persistPicks,
    });

    expect(requestPick).toHaveBeenCalledWith(
      { profile: 'crime' },
      [
        { id: '1', title: 'Heat' },
        { id: '2', title: 'Zodiac' },
        { id: '3', title: 'Thief' },
        { id: '263115', title: 'Logan' },
      ],
    );
    expect(next).toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);
    expect(persistPicks).toHaveBeenCalledWith(next);
  });

  it('retries generation without saving feedback twice', async () => {
    const saveFeedback = vi.fn(async () => {});
    const onFeedbackSaved = vi.fn();
    const requestPicks = vi
      .fn<() => Promise<RawPick[]>>()
      .mockRejectedValueOnce(new Error('generation failed'))
      .mockResolvedValueOnce([{ title: 'Manhunter', id: '4' }]);
    const common = {
      slotId: 1 as const,
      picks,
      saveFeedback,
      onFeedbackSaved,
      readContext: async () => ({ profile: 'crime' }),
      requestPicks,
      hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
      persistPicks: async () => {},
    };

    await expect(
      executeSelectReplacement({ ...common, feedbackSaved: false }),
    ).rejects.toThrow('generation failed');
    await expect(
      executeSelectReplacement({ ...common, feedbackSaved: true }),
    ).resolves.toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);

    expect(saveFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedbackSaved).toHaveBeenCalledTimes(1);
    expect(requestPicks).toHaveBeenCalledTimes(2);
  });

  it('rejects a hydrated film that is not the recommended title', async () => {
    await expect(
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId: 1,
        picks,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => ({}),
        requestPicks: async () => [{ title: 'Manhunter', id: '4' }],
        hydratePick: async () => ({ movieId: 99, title: 'Se7en' }),
        persistPicks: async () => {},
      }),
    ).rejects.toThrow('No new select available');
  });

  it('rejects a hydrated duplicate of any visible card', async () => {
    await expect(
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId: 1,
        picks,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => ({}),
        requestPicks: async () => [{ title: 'HEAT', id: '1' }],
        hydratePick: async () => ({ movieId: 1, title: 'Heat' }),
        persistPicks: async () => {},
      }),
    ).rejects.toThrow('No new select available');
  });
});
